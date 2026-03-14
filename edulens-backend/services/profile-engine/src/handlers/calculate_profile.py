"""
Lambda Handler: Calculate Student Profile (Learning DNA)

Triggered after test completion (via SQS) or called directly via API Gateway.
Wires together BayesianMasteryCalculator, ErrorClassifier, and TimeAnalyzer
to build/update the full Learning DNA for a student.
"""

import json
from collections import defaultdict
from typing import Any, Dict, List, Optional, Tuple

from ..algorithms.bayesian_mastery import BayesianMasteryCalculator
from ..database import (
    ProfileSnapshotRepository,
    SessionResponseRepository,
    StudentProfileRepository,
    get_db_session,
    init_database,
)
from ..models.skill_node import SkillNode
from ..services.error_classifier import ErrorClassifier
from ..services.time_analyzer import TimeAnalyzer

# Initialise once per Lambda cold start
init_database()

mastery_calc = BayesianMasteryCalculator()
error_classifier = ErrorClassifier()
time_analyzer = TimeAnalyzer()


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Calculate and persist a student's Learning DNA.

    Invocation sources:
      1. SQS (after test_completed event):
           event = {"Records": [{"body": '{"student_id": "...", "session_id": "..."}'}]}
      2. API Gateway (manual / admin trigger):
           event = {"pathParameters": {"id": "<student_id>"},
                    "queryStringParameters": {"sessionId": "<session_id>"}}
    """
    try:
        student_id, session_id = _extract_params(event)

        if not student_id:
            return _error(400, "student_id is required")

        with get_db_session() as db:
            response_repo = SessionResponseRepository(db)
            profile_repo = StudentProfileRepository(db)
            snapshot_repo = ProfileSnapshotRepository(db)

            # Load all responses across every completed session for this student
            all_responses = response_repo.get_student_responses(
                student_id, limit=500
            )

            if not all_responses:
                return _error(
                    404, f"No completed responses found for student {student_id}"
                )

            # --- Build the three Learning DNA components ---
            skill_nodes = _build_skill_graph(all_responses)
            error_patterns = _build_error_patterns(all_responses)
            time_behavior = time_analyzer.analyze_time_behavior(all_responses)

            # --- Aggregate metrics ---
            overall_mastery = mastery_calc.calculate_overall_mastery(skill_nodes)
            strengths, weaknesses = mastery_calc.identify_strengths_and_weaknesses(
                skill_nodes
            )

            # --- Serialise to plain dicts (handles datetime fields) ---
            skill_graph_data = _serialise(skill_nodes)
            error_patterns_data = _serialise(error_patterns)
            time_behavior_data = json.loads(time_behavior.json())

            # --- Persist profile ---
            profile_repo.upsert_profile(
                student_id=student_id,
                skill_graph=skill_graph_data,
                error_patterns=error_patterns_data,
                time_behavior=time_behavior_data,
                overall_mastery=overall_mastery,
                strengths=strengths,
                weaknesses=weaknesses,
            )

            # --- Create snapshot if we know which test triggered this ---
            if session_id:
                snapshot_repo.create_snapshot(
                    student_id=student_id,
                    session_id=session_id,
                    snapshot_data={
                        "skill_graph": skill_graph_data,
                        "error_patterns": error_patterns_data,
                        "time_behavior": time_behavior_data,
                        "overall_mastery": overall_mastery,
                        "strengths": strengths,
                        "weaknesses": weaknesses,
                        "trigger": "test_completed",
                    },
                )

        print(
            f"Profile calculated — student={student_id} "
            f"mastery={overall_mastery:.2f} "
            f"skills={len(skill_nodes)} "
            f"patterns={len(error_patterns)}"
        )

        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps(
                {
                    "success": True,
                    "data": {
                        "studentId": student_id,
                        "overallMastery": round(overall_mastery, 4),
                        "skillCount": len(skill_nodes),
                        "errorPatternCount": len(error_patterns),
                        "strengths": strengths,
                        "weaknesses": weaknesses,
                    },
                }
            ),
        }

    except Exception as e:
        print(f"Error calculating profile: {e}")
        return _error(500, "Failed to calculate student profile")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _extract_params(event: Dict) -> Tuple[Optional[str], Optional[str]]:
    """Return (student_id, session_id) from either SQS or API Gateway event."""
    # SQS trigger — body is a JSON string
    if "Records" in event:
        try:
            body = json.loads(event["Records"][0]["body"])
            return body.get("student_id"), body.get("session_id")
        except (KeyError, json.JSONDecodeError):
            pass

    # API Gateway
    path_params = event.get("pathParameters") or {}
    query_params = event.get("queryStringParameters") or {}
    student_id = path_params.get("id") or event.get("student_id")
    session_id = query_params.get("sessionId") or event.get("session_id")
    return student_id, session_id


def _build_skill_graph(responses: List[Dict]) -> List[SkillNode]:
    """
    Group all responses by skill_tag and build a SkillNode for each one,
    then run Bayesian mastery estimation.
    """
    skill_stats: Dict[str, Dict[str, int]] = defaultdict(
        lambda: {"correct": 0, "total": 0}
    )

    for response in responses:
        is_correct = bool(response.get("is_correct", False))
        for skill_tag in response.get("skill_tags", []):
            skill_stats[skill_tag]["total"] += 1
            if is_correct:
                skill_stats[skill_tag]["correct"] += 1

    skill_nodes: List[SkillNode] = []
    for skill_id, stats in skill_stats.items():
        parts = skill_id.split(".")
        subject = parts[0] if parts else "general"
        skill_name = " ".join(p.replace("-", " ").title() for p in parts)

        node = SkillNode(
            skill_id=skill_id,
            skill_name=skill_name,
            subject=subject,
            attempts=stats["total"],
            correct_attempts=stats["correct"],
        )
        mastery_calc.update_skill_node(node)
        skill_nodes.append(node)

    return skill_nodes


def _build_error_patterns(responses: List[Dict]) -> List:
    """
    For each incorrect response, classify the error type, then aggregate
    into recurring ErrorPattern objects.
    """
    classified: List[Dict] = []

    for response in responses:
        if response.get("is_correct"):
            continue

        estimated_time = response.get("estimated_time") or 60

        error_type = error_classifier.classify_error(
            question_type=response.get("question_type", "multiple_choice"),
            skill_tags=response.get("skill_tags", []),
            time_spent=response.get("time_spent", 60),
            estimated_time=estimated_time,
            student_answer=str(response.get("student_answer", "")),
            correct_answer=str(response.get("correct_answer", "")),
        )

        classified.append(
            {
                "error_type": error_type,
                "skill_tags": response.get("skill_tags", []),
                "question_id": response.get("question_id", ""),
                "timestamp": response.get("answered_at"),
            }
        )

    return error_classifier.aggregate_error_patterns(classified)


def _serialise(models: List) -> List[Dict]:
    """Convert a list of pydantic models to plain JSON-safe dicts."""
    return [json.loads(m.json()) for m in models]


def _error(status_code: int, message: str) -> Dict:
    return {
        "statusCode": status_code,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps({"success": False, "error": {"message": message}}),
    }
