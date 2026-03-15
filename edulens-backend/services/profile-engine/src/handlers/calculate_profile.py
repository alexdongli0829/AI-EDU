"""
Lambda Handler: Calculate Student Profile (Learning DNA)

Triggered after test completion (via SQS) or called directly via API Gateway.
Wires together BayesianMasteryCalculator, ErrorClassifier, and TimeAnalyzer
to build/update the full Learning DNA for a student.
"""

import json
from collections import defaultdict
from typing import Any, Dict, List, Optional, Tuple

# ---------------------------------------------------------------------------
# NSW Stage-aware skill taxonomies (mirrors frontend STAGE_SKILLS)
# ---------------------------------------------------------------------------

STAGE_SKILLS: Dict[str, Dict[str, List[str]]] = {
    "oc_prep": {
        "math":            ["Number & Algebra", "Fractions & Decimals", "Measurement & Geometry", "Statistics & Probability", "Problem Solving", "Working Mathematically"],
        "general_ability": ["Logical Reasoning", "Pattern Recognition", "Spatial Reasoning", "Verbal Reasoning", "Abstract Reasoning", "Critical Thinking"],
        "english":         ["Reading Comprehension", "Vocabulary", "Inference & Interpretation", "Grammar & Language", "Text Structure", "Language & Expression"],
    },
    "selective": {
        # Mathematical Reasoning — 35q / 40min / no calculator
        "math":            ["Number & Algebra", "Measurement & Space", "Statistics & Probability", "Working Mathematically", "Problem Solving", "Financial Maths"],
        # Thinking Skills — 40q / 40min / no prior knowledge
        "general_ability": ["Abstract Reasoning", "Logical Deduction", "Pattern Recognition", "Spatial Reasoning", "Verbal Reasoning", "Critical Analysis"],
        # Reading — 17 questions (38 answers) / 45min
        "english":         ["Reading Comprehension", "Inference & Interpretation", "Vocabulary in Context", "Text Analysis", "Literary Techniques", "Author's Purpose"],
        # Writing — 1 open-response task / 30min
        "writing":         ["Ideas & Content", "Text Structure", "Language Features", "Grammar & Punctuation", "Vocabulary", "Writing for Audience"],
    },
    "hsc": {
        "math":            ["Functions & Graphs", "Calculus", "Financial Maths", "Statistics & Data", "Algebra & Equations", "Measurement & Geometry"],
        "general_ability": ["Scientific Reasoning", "Data Analysis", "Experiment Design", "Chemical Concepts", "Physical Concepts", "Biological Concepts"],
        "english":         ["Textual Analysis", "Essay Writing", "Creative Writing", "Vocabulary & Language", "Literary Techniques", "Text & Context"],
    },
    "lifelong": {
        "math":            ["Statistical Analysis", "Mathematical Modelling", "Logical Reasoning", "Financial Literacy", "Data Interpretation", "Quantitative Analysis"],
        "general_ability": ["Argumentation", "Evidence Evaluation", "Logical Fallacies", "Analytical Reasoning", "Synthesis & Inference", "Problem Framing"],
        "english":         ["Academic Reading", "Academic Writing", "Rhetorical Analysis", "Vocabulary & Register", "Text Critique", "Communication"],
    },
}

STAGE_SKILL_KEYWORDS: Dict[str, Dict[str, Dict[str, List[str]]]] = {
    "oc_prep": {
        "math": {
            "Number & Algebra":         ["number", "algebra", "equation", "integer", "arithmetic", "numeral", "digit"],
            "Fractions & Decimals":     ["fraction", "decimal", "percent", "ratio", "proportion", "percentage"],
            "Measurement & Geometry":   ["measure", "geometry", "shape", "area", "perimeter", "volume", "angle", "length", "weight", "mass"],
            "Statistics & Probability": ["statistic", "probability", "data", "graph", "chart", "average", "mean", "median", "chance"],
            "Problem Solving":          ["problem", "word problem", "application", "real-world", "reasoning"],
            "Working Mathematically":   ["pattern", "strategy", "working", "process", "communicate", "generalise"],
        },
        "general_ability": {
            "Logical Reasoning":   ["logic", "logical", "deduction", "induction", "argument", "conclusion", "premise"],
            "Pattern Recognition": ["pattern", "sequence", "series", "next", "continue", "rule"],
            "Spatial Reasoning":   ["spatial", "space", "rotation", "reflection", "fold", "net", "shape", "3d", "visual"],
            "Verbal Reasoning":    ["verbal", "word", "analogy", "synonym", "antonym", "vocabulary", "language"],
            "Abstract Reasoning":  ["abstract", "matrix", "figure", "diagram", "symbol", "non-verbal"],
            "Critical Thinking":   ["critical", "evaluate", "analyse", "assess", "judge", "inference"],
        },
        "english": {
            "Reading Comprehension":      ["comprehension", "passage", "read", "understand", "main idea", "purpose"],
            "Vocabulary":                 ["vocabulary", "word", "meaning", "definition", "context clue", "synonym"],
            "Inference & Interpretation": ["inference", "infer", "interpret", "imply", "suggest", "deduce"],
            "Grammar & Language":         ["grammar", "punctuation", "spelling", "sentence", "verb", "noun", "tense"],
            "Text Structure":             ["structure", "text type", "genre", "feature", "paragraph", "author purpose"],
            "Language & Expression":      ["expression", "figurative", "metaphor", "simile", "language feature", "technique"],
        },
    },
    "selective": {
        "math": {
            "Number & Algebra":         ["number", "algebra", "equation", "integer", "arithmetic", "index", "surds", "numeral"],
            "Measurement & Space":      ["measure", "space", "geometry", "shape", "area", "perimeter", "volume", "angle", "coordinate", "length"],
            "Statistics & Probability": ["statistic", "probability", "data", "graph", "chart", "average", "mean", "median", "chance"],
            "Working Mathematically":   ["working", "strategy", "process", "communicate", "generalise", "justify", "explain"],
            "Problem Solving":          ["problem", "word problem", "application", "multi-step", "real-world"],
            "Financial Maths":          ["financial", "money", "profit", "loss", "interest", "tax", "budget", "cost", "price"],
        },
        "general_ability": {
            "Abstract Reasoning":  ["abstract", "matrix", "figure", "diagram", "symbol", "non-verbal", "pattern set"],
            "Logical Deduction":   ["logic", "deduction", "syllogism", "if then", "conclusion", "argument", "valid"],
            "Pattern Recognition": ["pattern", "sequence", "series", "next term", "continue", "rule"],
            "Spatial Reasoning":   ["spatial", "rotation", "reflection", "fold", "net", "3d", "visual", "mirror"],
            "Verbal Reasoning":    ["verbal", "analogy", "synonym", "antonym", "word relationship", "odd one out"],
            "Critical Analysis":   ["critical", "analyse", "evaluate", "assess", "flaw", "assumption", "strengthen"],
        },
        "english": {
            "Reading Comprehension":      ["comprehension", "passage", "read", "understand", "main idea", "summary"],
            "Inference & Interpretation": ["inference", "infer", "interpret", "imply", "suggest", "deduce"],
            "Vocabulary in Context":      ["vocabulary", "context", "meaning", "definition", "connotation", "denotation"],
            "Text Analysis":              ["analyse text", "structure", "genre", "text type", "purpose", "form"],
            "Literary Techniques":        ["technique", "figurative", "metaphor", "simile", "imagery", "alliteration", "personification"],
            "Author's Purpose":           ["purpose", "intent", "audience", "perspective", "point of view", "bias"],
        },
        "writing": {
            "Ideas & Content":       ["idea", "content", "creativity", "originality", "detail", "development", "elaborate"],
            "Text Structure":        ["structure", "paragraph", "introduction", "conclusion", "organisation", "cohesion"],
            "Language Features":     ["language", "technique", "figurative", "metaphor", "simile", "imagery", "tone", "style"],
            "Grammar & Punctuation": ["grammar", "punctuation", "sentence", "tense", "syntax", "spelling", "mechanics"],
            "Vocabulary":            ["vocabulary", "word choice", "diction", "expression", "precise", "varied"],
            "Writing for Audience":  ["audience", "purpose", "persuade", "narrative", "creative", "engage", "voice"],
        },
    },
    "hsc": {
        "math": {
            "Functions & Graphs":     ["function", "graph", "curve", "domain", "range", "polynomial", "asymptote"],
            "Calculus":               ["calculus", "derivative", "integral", "differentiation", "integration", "limit", "rate of change"],
            "Financial Maths":        ["financial", "annuity", "compound interest", "depreciation", "investment", "superannuation"],
            "Statistics & Data":      ["statistic", "data", "distribution", "probability", "regression", "z-score", "normal"],
            "Algebra & Equations":    ["algebra", "equation", "inequation", "logarithm", "exponential", "quadratic", "simultaneous"],
            "Measurement & Geometry": ["measurement", "geometry", "trigonometry", "pythagoras", "area", "volume", "surface area"],
        },
        "general_ability": {
            "Scientific Reasoning": ["scientific", "hypothesis", "theory", "model", "evidence", "peer review"],
            "Data Analysis":        ["data", "graph", "trend", "table", "analyse results", "interpret", "relationship"],
            "Experiment Design":    ["experiment", "variable", "control", "method", "reliability", "validity", "procedure"],
            "Chemical Concepts":    ["chemical", "chemistry", "reaction", "element", "compound", "bond", "periodic"],
            "Physical Concepts":    ["physics", "force", "energy", "motion", "wave", "electricity", "magnetism", "momentum"],
            "Biological Concepts":  ["biology", "cell", "genetics", "evolution", "ecosystem", "organism", "dna"],
        },
        "english": {
            "Textual Analysis":       ["analyse", "text", "passage", "close reading", "extract", "textual"],
            "Essay Writing":          ["essay", "thesis", "argument", "body paragraph", "conclusion", "introduction"],
            "Creative Writing":       ["creative", "narrative", "story", "character", "setting", "plot"],
            "Vocabulary & Language":  ["vocabulary", "language", "word choice", "diction", "tone", "register"],
            "Literary Techniques":    ["technique", "metaphor", "simile", "imagery", "symbolism", "irony", "allusion"],
            "Text & Context":         ["context", "historical", "cultural", "social", "composer", "audience", "reception"],
        },
    },
    "lifelong": {
        "math": {
            "Statistical Analysis":    ["statistic", "hypothesis test", "confidence", "p-value", "regression", "variance"],
            "Mathematical Modelling":  ["model", "modelling", "simulation", "optimisation", "function", "predict"],
            "Logical Reasoning":       ["logic", "proof", "formal", "deductive", "inductive", "valid"],
            "Financial Literacy":      ["financial", "investment", "risk", "return", "market", "budget", "compound"],
            "Data Interpretation":     ["data", "interpret", "visualisation", "chart", "trend", "insight", "dashboard"],
            "Quantitative Analysis":   ["quantitative", "measure", "number", "calculate", "estimate", "numerical"],
        },
        "general_ability": {
            "Argumentation":        ["argument", "claim", "premise", "conclusion", "thesis", "contention"],
            "Evidence Evaluation":  ["evidence", "source", "reliability", "validity", "credibility", "cite"],
            "Logical Fallacies":    ["fallacy", "ad hominem", "straw man", "false dichotomy", "circular", "slippery slope"],
            "Analytical Reasoning": ["analysis", "break down", "component", "systemic", "framework", "structure"],
            "Synthesis & Inference":["synthesis", "inference", "combine", "deduce", "integrate", "draw conclusion"],
            "Problem Framing":      ["problem", "frame", "define", "scope", "constraints", "objectives"],
        },
        "english": {
            "Academic Reading":      ["academic", "journal", "article", "scholarly", "literature review", "research"],
            "Academic Writing":      ["academic writing", "report", "essay", "citation", "reference", "apa", "harvard"],
            "Rhetorical Analysis":   ["rhetoric", "persuasion", "appeal", "ethos", "pathos", "logos", "rhetorical"],
            "Vocabulary & Register": ["vocabulary", "register", "formal", "technical", "discipline-specific", "jargon"],
            "Text Critique":         ["critique", "evaluate text", "assess", "strengths", "limitations", "critically"],
            "Communication":         ["communicate", "clarity", "coherence", "concise", "audience", "presentation"],
        },
    },
}


def _map_tags_to_skills(tags: List[str], subject: str, stage_id: str) -> List[str]:
    """Map raw skill_tags from a question to canonical stage-specific skill names."""
    stage_subjects = STAGE_SKILLS.get(stage_id) or STAGE_SKILLS["oc_prep"]
    subject_skills = stage_subjects.get(subject, [])
    if not subject_skills:
        return []
    if not tags:
        return [subject_skills[0]]

    stage_keywords = STAGE_SKILL_KEYWORDS.get(stage_id) or STAGE_SKILL_KEYWORDS["oc_prep"]
    keyword_map = stage_keywords.get(subject, {})
    matched = set()

    for tag in tags:
        tag_lower = tag.lower().replace("_", " ").strip()
        found = False
        for skill, keywords in keyword_map.items():
            if any(tag_lower in kw or kw in tag_lower for kw in keywords):
                matched.add(skill)
                found = True
        if not found:
            # Direct match against canonical skill names
            for skill in subject_skills:
                if skill.lower() in tag_lower or tag_lower in skill.lower().split(" ")[0]:
                    matched.add(skill)

    return list(matched) if matched else [subject_skills[0]]

from ..algorithms.bayesian_mastery import BayesianMasteryCalculator
from ..lib.system_config import get_system_config, cfg_float, cfg_int
from ..database import (
    CoreProfileRepository,
    ProfileSnapshotRepository,
    SessionResponseRepository,
    StudentProfileRepository,
    StudentStageRepository,
    get_db_session,
    init_database,
)
from ..models.skill_node import SkillNode
from ..services.error_classifier import ErrorClassifier
from ..services.time_analyzer import TimeAnalyzer

# Initialise once per Lambda cold start
init_database()

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

        # Load runtime config (cached 5 min)
        cfg = get_system_config()
        mastery_calc = BayesianMasteryCalculator(
            prior_alpha=cfg_float(cfg, "profileBayesianPriorAlpha"),
            prior_beta=cfg_float(cfg, "profileBayesianPriorBeta"),
            mastery_threshold=cfg_float(cfg, "profileMasteryThreshold"),
            min_attempts_for_confidence=cfg_int(cfg, "profileMinAttemptsForConfidence"),
        )
        min_responses = cfg_int(cfg, "profileMinResponsesForCalc")

        with get_db_session() as db:
            response_repo = SessionResponseRepository(db)
            profile_repo = StudentProfileRepository(db)
            snapshot_repo = ProfileSnapshotRepository(db)
            stage_repo = StudentStageRepository(db)
            core_repo = CoreProfileRepository(db)

            # --- Core Layer: all lifetime responses ---
            all_responses = response_repo.get_student_responses(
                student_id, limit=500
            )

            if not all_responses:
                return _error(
                    404, f"No completed responses found for student {student_id}"
                )

            if len(all_responses) < min_responses:
                return _error(
                    422,
                    f"Insufficient data: {len(all_responses)} responses found, "
                    f"minimum {min_responses} required for a meaningful profile calculation",
                )

            # Lifetime error patterns and time behavior → Core Layer
            error_patterns = _build_error_patterns(all_responses)
            time_behavior = time_analyzer.analyze_time_behavior(all_responses)
            error_patterns_data = _serialise(error_patterns)
            time_behavior_data = json.loads(time_behavior.json())

            core_repo.update_error_profile(
                student_id=student_id,
                error_patterns=error_patterns_data,
                time_behavior=time_behavior_data,
            )

            # --- Stage Layer: active-stage-scoped skill graph ---
            active_stage = stage_repo.get_active_stage(student_id)

            if active_stage:
                stage_responses = response_repo.get_student_responses(
                    student_id,
                    stage_id=active_stage["stage_id"],
                    limit=500,
                )
                skill_source = stage_responses if stage_responses else all_responses
            else:
                skill_source = all_responses

            skill_nodes = _build_skill_graph(skill_source, mastery_calc, active_stage["stage_id"] if active_stage else None)
            overall_mastery = mastery_calc.calculate_overall_mastery(skill_nodes)
            strengths, weaknesses = mastery_calc.identify_strengths_and_weaknesses(
                skill_nodes
            )
            skill_graph_data = _serialise(skill_nodes)

            if active_stage:
                # Summarise error distribution for the stage
                stage_error_stats = _build_stage_error_stats(
                    _build_error_patterns(
                        [r for r in skill_source if not r.get("is_correct")]
                        if skill_source is not all_responses
                        else [r for r in all_responses if not r.get("is_correct")]
                    )
                )
                stage_repo.upsert_stage_profile(
                    student_id=student_id,
                    stage_id=active_stage["stage_id"],
                    skill_graph=skill_graph_data,
                    overall_mastery=overall_mastery,
                    strengths=strengths,
                    weaknesses=weaknesses,
                    stage_error_stats=stage_error_stats,
                )

            # --- Legacy profile write (backward compat) ---
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
                        "stage_id": active_stage["stage_id"] if active_stage else None,
                        "trigger": "test_completed",
                    },
                )

        print(
            f"Profile calculated — student={student_id} "
            f"stage={active_stage['stage_id'] if active_stage else 'none'} "
            f"mastery={overall_mastery:.2f} "
            f"skills={len(skill_nodes)} "
            f"patterns={len(error_patterns)}"
        )

        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true"},
            "body": json.dumps(
                {
                    "success": True,
                    "data": {
                        "studentId": student_id,
                        "stageId": active_stage["stage_id"] if active_stage else None,
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


def _build_skill_graph(
    responses: List[Dict],
    mastery_calc: BayesianMasteryCalculator,
    stage_id: Optional[str] = None,
) -> List[SkillNode]:
    """
    Group responses by canonical stage skill name and build a SkillNode for each,
    then run Bayesian mastery estimation.

    Raw skill_tags from questions are mapped to the canonical skill names defined
    in STAGE_SKILLS for the student's active stage (defaults to oc_prep).
    """
    effective_stage = stage_id if (stage_id and stage_id in STAGE_SKILLS) else "oc_prep"
    stage_subjects = STAGE_SKILLS[effective_stage]

    # skill_id format: "{subject}.{canonical_skill_name}" (spaces → hyphens for ID safety)
    skill_stats: Dict[str, Dict[str, Any]] = defaultdict(
        lambda: {"correct": 0, "total": 0, "subject": "general", "skill_name": ""}
    )

    for response in responses:
        is_correct = bool(response.get("is_correct", False))
        raw_tags: List[str] = response.get("skill_tags", [])
        subject: str = response.get("subject", "")

        if subject not in stage_subjects:
            # Fall back to tagging the raw tags directly so no data is lost
            for tag in raw_tags or ["unknown"]:
                skill_id = f"{subject}.{tag.lower().replace(' ', '-')}"
                skill_stats[skill_id]["total"] += 1
                skill_stats[skill_id]["subject"] = subject
                skill_stats[skill_id]["skill_name"] = tag
                if is_correct:
                    skill_stats[skill_id]["correct"] += 1
            continue

        canonical_skills = _map_tags_to_skills(raw_tags, subject, effective_stage)
        for skill_name in canonical_skills:
            skill_id = f"{subject}.{skill_name.lower().replace(' ', '-').replace('&', 'and').replace(\"'\", '')}"
            skill_stats[skill_id]["total"] += 1
            skill_stats[skill_id]["subject"] = subject
            skill_stats[skill_id]["skill_name"] = skill_name
            if is_correct:
                skill_stats[skill_id]["correct"] += 1

    skill_nodes: List[SkillNode] = []
    for skill_id, stats in skill_stats.items():
        node = SkillNode(
            skill_id=skill_id,
            skill_name=stats["skill_name"] or skill_id,
            subject=stats["subject"],
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


def _build_stage_error_stats(error_patterns: List) -> Dict:
    """Summarise error patterns into a compact stats dict for stage_profile."""
    by_type: Dict[str, int] = {}
    total = 0
    for pattern in error_patterns:
        et = getattr(pattern, "error_type", None) or pattern.get("error_type", "unknown")
        freq = getattr(pattern, "frequency", None) or pattern.get("frequency", 1)
        by_type[et] = by_type.get(et, 0) + freq
        total += freq
    return {"total_errors": total, "by_type": by_type}


def _error(status_code: int, message: str) -> Dict:
    return {
        "statusCode": status_code,
        "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true"},
        "body": json.dumps({"success": False, "error": {"message": message}}),
    }
