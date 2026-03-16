"""
Lambda Handler: Get Aggregate Error Patterns
REST API endpoint for comprehensive error pattern analysis
"""

import json
from typing import Dict, Any, List
from datetime import datetime, timedelta, timezone

from ..database import (
    get_db_session,
    init_database,
    SessionResponseRepository,
    StudentStageRepository,
    TestSessionRepository,
)
from ..services.error_classifier import ErrorClassifier
from ..models.skill_node import ErrorPattern

# Initialize on cold start
init_database()


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    API Gateway handler for GET /api/students/:id/error-patterns/aggregate
    
    Returns comprehensive error pattern analysis across all sessions
    """

    try:
        # Extract student ID from path parameters
        student_id = event.get("pathParameters", {}).get("studentId") or event.get("pathParameters", {}).get("id")
        
        CORS_HEADERS = {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": "true",
        }

        if not student_id:
            return {
                "statusCode": 400,
                "headers": CORS_HEADERS,
                "body": json.dumps({
                    "success": False,
                    "error": {
                        "code": "MISSING_STUDENT_ID", 
                        "message": "Student ID is required"
                    }
                })
            }

        # Parse query parameters
        query_params = event.get("queryStringParameters", {}) or {}
        days_back = int(query_params.get("days", 30))  # Default to last 30 days
        include_correct = query_params.get("includeCorrect", "false").lower() == "true"
        stage_id = query_params.get("stageId") or None

        # Fetch student responses from database
        with get_db_session() as db:
            response_repo = SessionResponseRepository(db)
            session_repo = TestSessionRepository(db)

            # Resolve stageId="active" to the student's current active stage
            if stage_id == "active":
                stage_repo = StudentStageRepository(db)
                active = stage_repo.get_active_stage(student_id)
                stage_id = active["stage_id"] if active else None

            # Get responses, optionally scoped to a stage
            responses = response_repo.get_student_responses(
                student_id=student_id,
                stage_id=stage_id,
                limit=500,
            )
            
            # Filter by date range
            now_utc = datetime.now(timezone.utc)
            cutoff_date = now_utc - timedelta(days=days_back)
            recent_responses = [
                r for r in responses
                if r["answered_at"] is not None and (
                    r["answered_at"].replace(tzinfo=timezone.utc) if r["answered_at"].tzinfo is None else r["answered_at"]
                ) >= cutoff_date
            ]
            
            if not recent_responses:
                return {
                    "statusCode": 200,
                    "headers": CORS_HEADERS,
                    "body": json.dumps({
                        "success": True,
                        "data": {
                            "studentId": student_id,
                            "stageId": stage_id,
                            "dateRange": {
                                "from": cutoff_date.isoformat(),
                                "to": now_utc.isoformat(),
                                "days": days_back
                            },
                            "totalResponses": 0,
                            "incorrectResponses": 0,
                            "errorPatterns": [],
                            "skillErrorMapping": {},
                            "timeAnalysis": {
                                "averageTimePerQuestion": 0,
                                "rushingIndicator": 0,
                                "hesitationSkills": []
                            },
                            "recommendations": []
                        }
                    })
                }

        # Initialize error classifier
        classifier = ErrorClassifier()
        
        # Filter to incorrect responses for error analysis
        incorrect_responses = [r for r in recent_responses if not r["is_correct"]]
        
        # Classify errors
        classified_errors = []
        for response in incorrect_responses:
            error_type = classifier.classify_error(
                question_type=response["question_type"] or "multiple_choice",
                skill_tags=response["skill_tags"] or [],
                time_spent=response["time_spent"] or 0,
                estimated_time=response["estimated_time"] or 60,
                student_answer=str(response["student_answer"] or ""),
                correct_answer=str(response["correct_answer"] or "")
            )
            
            # Normalize timestamp to UTC-aware for consistent min/max comparison
            ts = response["answered_at"]
            if ts is not None and ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)

            classified_errors.append({
                "error_type": error_type,
                "skill_tags": response["skill_tags"] or [],
                "question_id": str(response["question_id"]),
                "session_id": str(response["session_id"]),
                "timestamp": ts or datetime.now(timezone.utc),
                "time_spent": response["time_spent"],
                "estimated_time": response["estimated_time"]
            })

        # Aggregate into patterns
        error_patterns = classifier.aggregate_error_patterns(classified_errors)
        
        # Build skill-error mapping
        skill_error_mapping = {}
        for error in classified_errors:
            for skill in error["skill_tags"]:
                if skill not in skill_error_mapping:
                    skill_error_mapping[skill] = {
                        "total_errors": 0,
                        "error_types": {}
                    }
                
                skill_error_mapping[skill]["total_errors"] += 1
                
                error_type = error["error_type"]
                if error_type not in skill_error_mapping[skill]["error_types"]:
                    skill_error_mapping[skill]["error_types"][error_type] = 0
                skill_error_mapping[skill]["error_types"][error_type] += 1

        # Time analysis
        total_time = sum(r["time_spent"] for r in recent_responses)
        avg_time = total_time / len(recent_responses) if recent_responses else 0
        
        # Calculate rushing indicator (percentage of responses answered too quickly)
        rushed_count = sum(
            1 for r in recent_responses 
            if r["time_spent"] < r["estimated_time"] * 0.5
        )
        rushing_indicator = rushed_count / len(recent_responses) if recent_responses else 0
        
        # Find hesitation skills (skills where avg time > 1.5x estimated)
        skill_times = {}
        for response in recent_responses:
            for skill in response["skill_tags"]:
                if skill not in skill_times:
                    skill_times[skill] = {"total_time": 0, "count": 0, "estimated_total": 0}
                skill_times[skill]["total_time"] += response["time_spent"]
                skill_times[skill]["estimated_total"] += response["estimated_time"]
                skill_times[skill]["count"] += 1
        
        hesitation_skills = []
        for skill, times in skill_times.items():
            if times["count"] > 0:
                avg_actual = times["total_time"] / times["count"]
                avg_estimated = times["estimated_total"] / times["count"]
                if avg_actual > avg_estimated * 1.5:
                    hesitation_skills.append(skill)

        # Generate recommendations
        recommendations = classifier.get_recommendations(error_patterns)

        # Format response
        response_data = {
            "success": True,
            "data": {
                "studentId": student_id,
                "stageId": stage_id,
                "dateRange": {
                    "from": cutoff_date.isoformat(),
                    "to": now_utc.isoformat(),
                    "days": days_back
                },
                "totalResponses": len(recent_responses),
                "incorrectResponses": len(incorrect_responses),
                "errorPatterns": [
                    {
                        "errorType": pattern.error_type,
                        "frequency": pattern.frequency,
                        "skillsAffected": pattern.skills_affected,
                        "examples": pattern.examples,
                        "severity": pattern.severity,
                        "firstSeen": pattern.first_seen.isoformat(),
                        "lastSeen": pattern.last_seen.isoformat()
                    }
                    for pattern in error_patterns
                ],
                "skillErrorMapping": skill_error_mapping,
                "timeAnalysis": {
                    "averageTimePerQuestion": round(avg_time, 1),
                    "rushingIndicator": round(rushing_indicator, 2),
                    "hesitationSkills": hesitation_skills
                },
                "recommendations": recommendations
            }
        }

        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Credentials": "true",
                "Cache-Control": "no-store",
            },
            "body": json.dumps(response_data)
        }

    except Exception as e:
        print(f"Error aggregating error patterns: {str(e)}")

        return {
            "statusCode": 500,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Credentials": "true",
            },
            "body": json.dumps({
                "success": False,
                "error": {
                    "code": "INTERNAL_ERROR",
                    "message": "Failed to aggregate error patterns"
                }
            })
        }