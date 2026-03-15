"""
Lambda Handler: Get Skill Detail
REST API endpoint for detailed skill analysis
"""

import json
from typing import Dict, Any, List

from ..database import (
    get_db_session,
    init_database,
    SessionResponseRepository,
    StudentProfileRepository
)
from ..algorithms.bayesian_mastery import BayesianMasteryCalculator

# Initialize on cold start
init_database()
bayesian_calculator = BayesianMasteryCalculator()


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    API Gateway handler for GET /api/students/:id/skills/:skillId

    Returns detailed analysis for a specific skill including:
    - Current mastery and confidence
    - Credible interval
    - Recent performance history
    - Recommendations
    """

    try:
        # Extract parameters
        student_id = event.get("pathParameters", {}).get("id")
        skill_id = event.get("pathParameters", {}).get("skillId")

        if not student_id or not skill_id:
            return {
                "statusCode": 400,
                "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true"},
                "body": json.dumps({
                    "success": False,
                    "error": {
                        "code": "MISSING_PARAMETERS",
                        "message": "Student ID and Skill ID are required"
                    }
                })
            }

        with get_db_session() as db:
            # Get current profile
            profile_repo = StudentProfileRepository(db)
            profile = profile_repo.get_profile(student_id)

            if not profile:
                return {
                    "statusCode": 404,
                    "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true"},
                    "body": json.dumps({
                        "success": False,
                        "error": {
                            "code": "PROFILE_NOT_FOUND",
                            "message": f"No profile found for student {student_id}"
                        }
                    })
                }

            # Find skill in skill graph
            skill_data = None
            for skill in profile["skill_graph"]:
                if skill["skill_id"] == skill_id:
                    skill_data = skill
                    break

            if not skill_data:
                return {
                    "statusCode": 404,
                    "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true"},
                    "body": json.dumps({
                        "success": False,
                        "error": {
                            "code": "SKILL_NOT_FOUND",
                            "message": f"Skill {skill_id} not found in profile"
                        }
                    })
                }

            # Get recent responses for this skill
            response_repo = SessionResponseRepository(db)
            recent_responses = response_repo.get_student_responses(
                student_id=student_id,
                skill_id=skill_id,
                limit=20
            )

        # Calculate credible interval
        alpha = skill_data["alpha"]
        beta = skill_data["beta"]
        credible_lower, credible_upper = bayesian_calculator.calculate_credible_interval(
            alpha, beta, confidence_level=0.95
        )

        # Check if mastered
        is_mastered = bayesian_calculator.is_mastered(
            skill_data["mastery_level"],
            skill_data["confidence"],
            min_confidence=0.6
        )

        # Calculate performance trend (last 5 vs previous 5)
        trend = calculate_trend(recent_responses)

        # Generate recommendations
        recommendations = generate_skill_recommendations(
            skill_data, is_mastered, trend
        )

        # Format response
        response_data = {
            "success": True,
            "data": {
                "skill": {
                    "skillId": skill_data["skill_id"],
                    "skillName": skill_data["skill_name"],
                    "subject": skill_data["subject"],
                    "masteryLevel": skill_data["mastery_level"],
                    "confidence": skill_data["confidence"],
                    "attempts": skill_data["attempts"],
                    "correctAttempts": skill_data["correct_attempts"],
                    "isMastered": is_mastered,
                    "lastUpdated": skill_data["last_updated"]
                },
                "statistics": {
                    "credibleInterval": {
                        "lower": round(credible_lower, 3),
                        "upper": round(credible_upper, 3),
                        "level": 0.95
                    },
                    "betaParameters": {
                        "alpha": alpha,
                        "beta": beta
                    },
                    "successRate": round(
                        skill_data["correct_attempts"] / skill_data["attempts"], 3
                    ) if skill_data["attempts"] > 0 else 0
                },
                "recentPerformance": {
                    "responses": format_responses(recent_responses[:10]),
                    "trend": trend
                },
                "recommendations": recommendations
            }
        }

        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json",
                "Cache-Control": "max-age=60"
            },
            "body": json.dumps(response_data)
        }

    except Exception as e:
        print(f"Error fetching skill detail: {str(e)}")

        return {
            "statusCode": 500,
            "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true"},
            "body": json.dumps({
                "success": False,
                "error": {
                    "code": "INTERNAL_ERROR",
                    "message": "Failed to fetch skill detail"
                }
            })
        }


def calculate_trend(responses: List[Dict]) -> str:
    """
    Calculate performance trend from recent responses

    Returns: "improving", "stable", or "declining"
    """
    if len(responses) < 6:
        return "insufficient_data"

    # Split into recent (last 5) and previous (5 before that)
    recent = responses[:5]
    previous = responses[5:10]

    recent_accuracy = sum(1 for r in recent if r["is_correct"]) / len(recent)
    previous_accuracy = sum(1 for r in previous if r["is_correct"]) / len(previous)

    diff = recent_accuracy - previous_accuracy

    if diff > 0.2:
        return "improving"
    elif diff < -0.2:
        return "declining"
    else:
        return "stable"


def format_responses(responses: List[Dict]) -> List[Dict]:
    """Format responses for API response"""
    return [
        {
            "questionId": r["question_id"],
            "isCorrect": r["is_correct"],
            "timeSpent": r["time_spent"],
            "answeredAt": r["answered_at"].isoformat()
        }
        for r in responses
    ]


def generate_skill_recommendations(
    skill_data: Dict,
    is_mastered: bool,
    trend: str
) -> List[str]:
    """Generate recommendations based on skill performance"""
    recommendations = []

    if is_mastered:
        recommendations.append(
            f"Great work! You've mastered {skill_data['skill_name']}. "
            "Continue practicing to maintain proficiency."
        )
    elif skill_data["mastery_level"] >= 0.6:
        recommendations.append(
            f"You're doing well with {skill_data['skill_name']}. "
            "A few more practice sessions should solidify this skill."
        )
    else:
        recommendations.append(
            f"Focus on improving {skill_data['skill_name']}. "
            "Consider reviewing fundamental concepts."
        )

    if trend == "declining":
        recommendations.append(
            "Your recent performance shows a decline. "
            "Review previous material and practice consistently."
        )
    elif trend == "improving":
        recommendations.append(
            "Great progress! Your performance is improving. Keep it up!"
        )

    if skill_data["confidence"] < 0.5:
        recommendations.append(
            "More practice needed to build confidence. "
            f"Complete {5 - skill_data['attempts']} more questions."
        )

    return recommendations
