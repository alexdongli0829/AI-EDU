"""
SQS Handler: Summarize Conversation
Processes completed chat sessions and generates summaries
"""

import json
from typing import Dict, Any
from datetime import datetime

from ..database import (
    get_db_session,
    init_database,
    ChatRepository,
    ConversationMemoryRepository
)
from ..services import ConversationSummarizer, AnthropicClient

# Initialize on cold start
init_database()
anthropic_client = AnthropicClient()
summarizer = ConversationSummarizer(anthropic_client)


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    SQS handler for conversation summarization

    SQS Message format:
    {
        "job_type": "summarize_conversation",
        "session_id": "uuid",
        "student_id": "uuid"
    }

    Triggered when:
    - Chat session ends
    - Periodic batch processing of unsummarized sessions
    """
    success_count = 0
    failure_count = 0
    errors = []

    # Process each SQS record
    for record in event.get("Records", []):
        try:
            # Parse message body
            body = json.loads(record["body"])
            session_id = body.get("session_id")
            student_id = body.get("student_id")

            if not session_id or not student_id:
                raise ValueError("Missing session_id or student_id in message")

            print(f"Processing summarization for session {session_id}")

            # Check if already summarized
            with get_db_session() as db:
                memory_repo = ConversationMemoryRepository(db)

                if memory_repo.memory_exists(session_id):
                    print(f"Session {session_id} already has a summary, skipping")
                    success_count += 1
                    continue

            # Fetch session and messages
            session_data = fetch_session_data(session_id)

            if not session_data:
                raise ValueError(f"Session {session_id} not found")

            # Generate summary
            summary = summarizer.summarize_session(
                session_id=session_id,
                student_id=student_id,
                messages=session_data["messages"],
                session_duration=session_data["duration"]
            )

            # Save to database
            save_summary(summary)

            print(f"Successfully summarized session {session_id}: {len(session_data['messages'])} messages")
            success_count += 1

        except Exception as e:
            error_msg = f"Error processing record: {str(e)}"
            print(error_msg)
            errors.append(error_msg)
            failure_count += 1

    # Return summary
    return {
        "statusCode": 200 if failure_count == 0 else 207,  # Multi-Status
        "body": json.dumps({
            "success_count": success_count,
            "failure_count": failure_count,
            "errors": errors
        })
    }


def fetch_session_data(session_id: str) -> Dict[str, Any]:
    """
    Fetch session and all messages from database

    Returns:
        Dictionary with 'messages' and 'duration'
    """
    with get_db_session() as db:
        chat_repo = ChatRepository(db)

        # Get session
        session = chat_repo.get_session(session_id)
        if not session:
            return None

        # Get messages
        messages = chat_repo.get_session_messages(session_id)

        # Calculate duration
        duration = 0
        if session.get("started_at") and session.get("ended_at"):
            start = session["started_at"]
            end = session["ended_at"]
            duration = int((end - start).total_seconds())

        return {
            "messages": messages,
            "duration": duration
        }


def save_summary(summary) -> None:
    """
    Save conversation summary to database

    Args:
        summary: ConversationSummary object
    """
    with get_db_session() as db:
        memory_repo = ConversationMemoryRepository(db)

        # Combine key questions and concepts for key_points
        key_points = []
        if summary.key_questions:
            key_points.extend(summary.key_questions[:3])
        if summary.concepts_explained:
            key_points.extend(summary.concepts_explained[:3])

        memory_repo.create_memory(
            session_id=summary.session_id,
            student_id=summary.student_id,
            summary_text=summary.summary_text,
            topics_discussed=summary.topics_discussed,
            key_points=key_points
        )

        print(f"Saved summary to conversation_memory: {summary.session_id}")


def batch_process_unsummarized() -> Dict[str, int]:
    """
    Batch process sessions that don't have summaries yet

    Called by scheduled EventBridge rule

    Returns:
        Dictionary with success/failure counts
    """
    with get_db_session() as db:
        chat_repo = ChatRepository(db)

        # Get sessions without summaries
        unsummarized_sessions = chat_repo.get_sessions_without_summary(limit=50)

        print(f"Found {len(unsummarized_sessions)} unsummarized sessions")

        success_count = 0
        failure_count = 0

        for session_id in unsummarized_sessions:
            try:
                # Fetch session
                session = chat_repo.get_session(session_id)
                if not session:
                    continue

                student_id = session["student_id"]

                # Fetch data and generate summary
                session_data = fetch_session_data(session_id)
                if not session_data:
                    continue

                summary = summarizer.summarize_session(
                    session_id=session_id,
                    student_id=student_id,
                    messages=session_data["messages"],
                    session_duration=session_data["duration"]
                )

                # Save summary
                save_summary(summary)

                success_count += 1

            except Exception as e:
                print(f"Error processing session {session_id}: {str(e)}")
                failure_count += 1

        return {
            "success_count": success_count,
            "failure_count": failure_count,
            "total_processed": success_count + failure_count
        }
