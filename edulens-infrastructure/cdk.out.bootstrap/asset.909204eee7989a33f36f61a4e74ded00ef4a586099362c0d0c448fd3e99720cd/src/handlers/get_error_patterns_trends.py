"""
Lambda Handler: Get Error Pattern Trends
REST API endpoint for error trend analysis over time
"""

import json
from typing import Dict, Any, List
from datetime import datetime, timedelta
from collections import defaultdict

from ..database import (
    get_db_session,
    init_database,
    SessionResponseRepository,
    StudentStageRepository,
    TestSessionRepository,
)
from ..services.error_classifier import ErrorClassifier

# Initialize on cold start
init_database()


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    API Gateway handler for GET /api/students/:id/error-patterns/trends
    
    Returns error trend analysis over time periods
    """

    try:
        # Extract student ID from path parameters
        student_id = event.get("pathParameters", {}).get("studentId") or event.get("pathParameters", {}).get("id")
        
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

        # Parse query parameters
        query_params = event.get("queryStringParameters", {}) or {}
        period = query_params.get("period", "weekly")  # weekly, daily, monthly
        days_back = int(query_params.get("days", 90))  # Default to last 90 days
        stage_id = query_params.get("stageId") or None

        # Fetch student responses from database
        with get_db_session() as db:
            response_repo = SessionResponseRepository(db)

            # Resolve stageId="active" to the student's current active stage
            if stage_id == "active":
                stage_repo = StudentStageRepository(db)
                active = stage_repo.get_active_stage(student_id)
                stage_id = active["stage_id"] if active else None

            # Get historical responses, optionally scoped to a stage
            responses = response_repo.get_student_responses(
                student_id=student_id,
                stage_id=stage_id,
                limit=1000,
            )
            
            # Filter by date range
            cutoff_date = datetime.utcnow() - timedelta(days=days_back)
            recent_responses = [
                r for r in responses 
                if r["answered_at"] >= cutoff_date and not r["is_correct"]
            ]
            
            if not recent_responses:
                return {
                    "statusCode": 200,
                    "headers": {"Content-Type": "application/json"},
                    "body": json.dumps({
                        "success": True,
                        "data": {
                            "studentId": student_id,
                            "stageId": stage_id,
                            "period": period,
                            "dateRange": {
                                "from": cutoff_date.isoformat(),
                                "to": datetime.utcnow().isoformat(),
                                "days": days_back
                            },
                            "trends": {},
                            "timeline": [],
                            "improvement_indicators": []
                        }
                    })
                }

        # Initialize error classifier
        classifier = ErrorClassifier()
        
        # Classify all errors
        classified_errors = []
        for response in recent_responses:
            error_type = classifier.classify_error(
                question_type=response["question_type"],
                skill_tags=response["skill_tags"],
                time_spent=response["time_spent"],
                estimated_time=response["estimated_time"],
                student_answer=response["student_answer"],
                correct_answer=response["correct_answer"]
            )
            
            classified_errors.append({
                "error_type": error_type,
                "skill_tags": response["skill_tags"],
                "question_id": response["question_id"],
                "session_id": response["session_id"],
                "timestamp": response["answered_at"],
                "date": response["answered_at"].date()
            })

        # Group by time period
        def get_period_key(date: datetime) -> str:
            if period == "daily":
                return date.strftime("%Y-%m-%d")
            elif period == "weekly":
                # Get start of week (Monday)
                days_since_monday = date.weekday()
                start_of_week = date - timedelta(days=days_since_monday)
                return start_of_week.strftime("%Y-%m-%d")
            elif period == "monthly":
                return date.strftime("%Y-%m")
            else:
                return date.strftime("%Y-%m-%d")

        # Build timeline data
        error_timeline = defaultdict(lambda: defaultdict(int))
        
        for error in classified_errors:
            period_key = get_period_key(error["timestamp"])
            error_timeline[period_key][error["error_type"]] += 1

        # Convert to sorted timeline
        timeline_data = []
        for period_key in sorted(error_timeline.keys()):
            period_errors = error_timeline[period_key]
            total_errors = sum(period_errors.values())
            
            timeline_data.append({
                "period": period_key,
                "total_errors": total_errors,
                "error_breakdown": dict(period_errors),
                "date": period_key
            })

        # Calculate trends for each error type
        error_trends = {}
        
        # Split data into two halves for trend comparison
        mid_point = len(timeline_data) // 2
        if mid_point > 0:
            first_half = timeline_data[:mid_point]
            second_half = timeline_data[mid_point:]
            
            # Aggregate error counts for each half
            first_half_totals = defaultdict(int)
            second_half_totals = defaultdict(int)
            
            for period_data in first_half:
                for error_type, count in period_data["error_breakdown"].items():
                    first_half_totals[error_type] += count
                    
            for period_data in second_half:
                for error_type, count in period_data["error_breakdown"].items():
                    second_half_totals[error_type] += count
            
            # Calculate trends
            all_error_types = set(first_half_totals.keys()) | set(second_half_totals.keys())
            
            for error_type in all_error_types:
                first_count = first_half_totals.get(error_type, 0)
                second_count = second_half_totals.get(error_type, 0)
                
                if first_count == 0 and second_count == 0:
                    trend = "stable"
                    change_percent = 0
                elif first_count == 0:
                    trend = "worsening"
                    change_percent = 100
                elif second_count == 0:
                    trend = "improving"
                    change_percent = -100
                else:
                    change_percent = ((second_count - first_count) / first_count) * 100
                    if change_percent < -20:
                        trend = "improving"
                    elif change_percent > 20:
                        trend = "worsening"
                    else:
                        trend = "stable"
                
                error_trends[error_type] = {
                    "trend": trend,
                    "change_percent": round(change_percent, 1),
                    "first_half_count": first_count,
                    "second_half_count": second_count
                }

        # Generate improvement indicators
        improvement_indicators = []
        
        for error_type, trend_data in error_trends.items():
            if trend_data["trend"] == "improving":
                improvement_indicators.append({
                    "type": "improvement",
                    "error_type": error_type,
                    "message": f"{error_type.replace('_', ' ').title()} errors reduced by {abs(trend_data['change_percent']):.0f}%",
                    "change_percent": trend_data["change_percent"]
                })
            elif trend_data["trend"] == "worsening":
                improvement_indicators.append({
                    "type": "concern", 
                    "error_type": error_type,
                    "message": f"{error_type.replace('_', ' ').title()} errors increased by {trend_data['change_percent']:.0f}%",
                    "change_percent": trend_data["change_percent"]
                })

        # Sort indicators by significance
        improvement_indicators.sort(key=lambda x: abs(x["change_percent"]), reverse=True)

        # Format response
        response_data = {
            "success": True,
            "data": {
                "studentId": student_id,
                "stageId": stage_id,
                "period": period,
                "dateRange": {
                    "from": cutoff_date.isoformat(),
                    "to": datetime.utcnow().isoformat(),
                    "days": days_back
                },
                "trends": error_trends,
                "timeline": timeline_data,
                "improvement_indicators": improvement_indicators[:10]  # Top 10 most significant changes
            }
        }

        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json",
                "Cache-Control": "max-age=600"  # Cache for 10 minutes
            },
            "body": json.dumps(response_data)
        }

    except Exception as e:
        print(f"Error analyzing error trends: {str(e)}")

        return {
            "statusCode": 500,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({
                "success": False,
                "error": {
                    "code": "INTERNAL_ERROR",
                    "message": "Failed to analyze error trends"
                }
            })
        }