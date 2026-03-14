"""
Lambda Handler: Get Student Profile
REST API endpoint for retrieving Learning DNA
"""

import json
from typing import Dict, Any

from ..database import (
    get_db_session,
    init_database,
    StudentProfileRepository
)

# Initialize on cold start
init_database()


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    API Gateway handler for GET /api/students/:id/profile

    Returns the current Learning DNA for a student
    """

    try:
        # Extract student ID from path parameters
        student_id = event.get("pathParameters", {}).get("id")

        if not student_id:
            return {
                "statusCode": 400,
                "headers": {"Content-Type": "application/json"},
                "body": json.dumps({
                    "success": False,
                    "error": {
                        "code": "MISSING_STUDENT_ID",
                        "message": "Student ID is required"
                    }
                })
            }

        # Fetch profile from database
        with get_db_session() as db:
            profile_repo = StudentProfileRepository(db)
            profile = profile_repo.get_profile(student_id)

        if not profile:
            return {
                "statusCode": 404,
                "headers": {"Content-Type": "application/json"},
                "body": json.dumps({
                    "success": False,
                    "error": {
                        "code": "PROFILE_NOT_FOUND",
                        "message": f"No profile found for student {student_id}"
                    }
                })
            }

        # Format response
        response_data = {
            "success": True,
            "data": {
                "studentId": profile["student_id"],
                "skillGraph": profile["skill_graph"],
                "errorPatterns": profile["error_patterns"],
                "timeBehavior": profile["time_behavior"],
                "overallMastery": profile["overall_mastery"],
                "strengths": profile["strengths"],
                "weaknesses": profile["weaknesses"],
                "lastCalculated": profile["last_calculated"].isoformat()
            }
        }

        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json",
                "Cache-Control": "max-age=300"  # Cache for 5 minutes
            },
            "body": json.dumps(response_data)
        }

    except Exception as e:
        print(f"Error fetching profile: {str(e)}")

        return {
            "statusCode": 500,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({
                "success": False,
                "error": {
                    "code": "INTERNAL_ERROR",
                    "message": "Failed to fetch student profile"
                }
            })
        }
