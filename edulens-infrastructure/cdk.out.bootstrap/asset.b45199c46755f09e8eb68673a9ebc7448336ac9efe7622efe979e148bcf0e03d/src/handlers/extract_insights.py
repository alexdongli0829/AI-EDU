"""
SQS Handler: Extract Learning Insights
Analyzes conversation patterns to generate learning insights
"""

import json
from typing import Dict, Any
from datetime import datetime, timedelta

from ..database import (
    get_db_session,
    init_database,
    ChatRepository,
    ConversationMemoryRepository
)
from ..services import InsightExtractor, AnthropicClient
from ..models.summarization import ConversationSummary

# Initialize on cold start
init_database()
anthropic_client = AnthropicClient()
insight_extractor = InsightExtractor(anthropic_client)


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    SQS handler for insight extraction

    SQS Message format:
    {
        "job_type": "extract_insights",
        "student_id": "uuid",
        "trigger": "milestone" | "scheduled"
    }

    Triggered when:
    - Student completes N sessions (e.g., 5)
    - Weekly scheduled analysis
    - Parent requests insights
    """
    success_count = 0
    failure_count = 0
    errors = []

    # Process each SQS record
    for record in event.get("Records", []):
        try:
            # Parse message body
            body = json.loads(record["body"])
            student_id = body.get("student_id")

            if not student_id:
                raise ValueError("Missing student_id in message")

            print(f"Extracting insights for student {student_id}")

            # Fetch recent conversation data
            recent_data = fetch_recent_conversation_data(student_id, days=30)

            if not recent_data["summaries"]:
                print(f"No conversation data for student {student_id}, skipping")
                success_count += 1
                continue

            # Extract insights
            insights = insight_extractor.extract_insights(
                student_id=student_id,
                summaries=recent_data["summaries"],
                messages=recent_data["messages"]
            )

            # Save insights to database
            save_insights(student_id, insights)

            print(f"Successfully extracted insights for student {student_id}")
            print(f"  Engagement: {insights.engagement_level:.2f}")
            print(f"  Learning style: {insights.preferred_learning_style}")
            print(f"  Confidence: {insights.confidence:.2f}")

            success_count += 1

        except Exception as e:
            error_msg = f"Error processing record: {str(e)}"
            print(error_msg)
            errors.append(error_msg)
            failure_count += 1

    # Return summary
    return {
        "statusCode": 200 if failure_count == 0 else 207,
        "body": json.dumps({
            "success_count": success_count,
            "failure_count": failure_count,
            "errors": errors
        })
    }


def fetch_recent_conversation_data(
    student_id: str,
    days: int = 30
) -> Dict[str, Any]:
    """
    Fetch recent conversation summaries and messages

    Args:
        student_id: Student ID
        days: Number of days to look back

    Returns:
        Dictionary with 'summaries' and 'messages'
    """
    with get_db_session() as db:
        memory_repo = ConversationMemoryRepository(db)
        chat_repo = ChatRepository(db)

        # Get recent memories
        since_date = datetime.utcnow() - timedelta(days=days)
        memories = memory_repo.get_memories_since(
            student_id=student_id,
            since=since_date,
            limit=10
        )

        # Convert to ConversationSummary objects
        summaries = []
        for mem in memories:
            summary = ConversationSummary(
                session_id=mem["session_id"],
                student_id=student_id,
                topics_discussed=mem["topics_discussed"] or [],
                key_questions=mem["key_points"] or [],
                concepts_explained=[],
                areas_of_struggle=[],
                summary_text=mem["summary_text"],
                message_count=0,
                duration_seconds=0,
                created_at=mem["created_at"]
            )
            summaries.append(summary)

        # Get recent sessions for message analysis
        recent_sessions = chat_repo.get_recent_sessions(
            student_id=student_id,
            limit=5
        )

        # Fetch messages from recent sessions
        all_messages = []
        for session in recent_sessions[:3]:  # Only last 3 for performance
            messages = chat_repo.get_session_messages(
                session_id=session["id"],
                limit=50
            )
            all_messages.extend(messages)

        return {
            "summaries": summaries,
            "messages": all_messages
        }


def save_insights(student_id: str, insights) -> None:
    """
    Save insights to database

    Note: In production, this would update a student_insights table
    For now, we'll log and could publish to EventBridge
    """
    # Convert to dict for storage
    insights_dict = insights.model_dump(mode="json")

    print(f"Insights for student {student_id}:")
    print(json.dumps(insights_dict, indent=2))

    # TODO: Save to student_insights table or publish to EventBridge
    # For now, just log the insights

    # Optionally, publish event
    # publish_insights_event(student_id, insights_dict)


def publish_insights_event(student_id: str, insights_dict: Dict) -> None:
    """
    Publish insights as EventBridge event

    This allows other services to react to new insights
    """
    import boto3

    try:
        eventbridge = boto3.client("events")

        eventbridge.put_events(
            Entries=[
                {
                    "Source": "edulens.background-jobs",
                    "DetailType": "insights.extracted",
                    "Detail": json.dumps({
                        "student_id": student_id,
                        "insights": insights_dict,
                        "timestamp": datetime.utcnow().isoformat()
                    })
                }
            ]
        )

        print(f"Published insights event for student {student_id}")

    except Exception as e:
        print(f"Error publishing insights event: {str(e)}")


def calculate_engagement_trends(student_id: str) -> Dict[str, Any]:
    """
    Calculate engagement trends over time

    Compares recent vs historical engagement

    Returns:
        Dictionary with trend data
    """
    with get_db_session() as db:
        chat_repo = ChatRepository(db)

        # Get all sessions
        all_sessions = chat_repo.get_recent_sessions(
            student_id=student_id,
            limit=20
        )

        if len(all_sessions) < 4:
            return {"trend": "insufficient_data"}

        # Split into recent (last 5) and historical (5 before that)
        recent = all_sessions[:5]
        historical = all_sessions[5:10]

        # Calculate average message counts
        recent_avg = sum(s["message_count"] for s in recent) / len(recent)
        historical_avg = sum(s["message_count"] for s in historical) / len(historical)

        # Determine trend
        if recent_avg > historical_avg * 1.2:
            trend = "increasing"
        elif recent_avg < historical_avg * 0.8:
            trend = "decreasing"
        else:
            trend = "stable"

        return {
            "trend": trend,
            "recent_avg_messages": recent_avg,
            "historical_avg_messages": historical_avg,
            "change_percent": ((recent_avg - historical_avg) / historical_avg * 100)
            if historical_avg > 0 else 0
        }
