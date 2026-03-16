"""
Conversation Summarizer
Generates concise summaries of chat sessions using Claude Haiku
"""

from typing import List, Dict
from datetime import datetime
from ..models.summarization import ConversationSummary
from .anthropic_client import AnthropicClient


class ConversationSummarizer:
    """
    Summarizes chat sessions for cross-session recall
    Uses Claude Haiku for cost-effective summarization
    """

    def __init__(self, anthropic_client: AnthropicClient):
        """
        Initialize summarizer

        Args:
            anthropic_client: Anthropic API client
        """
        self.anthropic_client = anthropic_client

    def summarize_session(
        self,
        session_id: str,
        student_id: str,
        messages: List[Dict],
        session_duration: int
    ) -> ConversationSummary:
        """
        Summarize a complete chat session

        Args:
            session_id: Chat session ID
            student_id: Student ID
            messages: List of message dicts with 'role' and 'content'
            session_duration: Session duration in seconds

        Returns:
            ConversationSummary object
        """
        # Build conversation transcript
        transcript = self._build_transcript(messages)

        # Generate summary using Claude Haiku
        system_prompt = self._get_summarization_prompt()
        user_prompt = f"Summarize this tutoring conversation:\n\n{transcript}"

        structured_data = self.anthropic_client.extract_structured_data(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            max_tokens=1500,
            temperature=0.2
        )

        # Parse structured response
        return ConversationSummary(
            session_id=session_id,
            student_id=student_id,
            topics_discussed=structured_data.get("topics_discussed", []),
            key_questions=structured_data.get("key_questions", []),
            concepts_explained=structured_data.get("concepts_explained", []),
            areas_of_struggle=structured_data.get("areas_of_struggle", []),
            summary_text=structured_data.get("summary_text", ""),
            message_count=len(messages),
            duration_seconds=session_duration,
            created_at=datetime.utcnow()
        )

    def _build_transcript(self, messages: List[Dict]) -> str:
        """
        Build a readable transcript from messages

        Args:
            messages: List of message dicts with 'role' and 'content'

        Returns:
            Formatted transcript string
        """
        lines = []

        for msg in messages:
            role = msg.get("role", "unknown")
            content = msg.get("content", "")

            # Map roles to readable labels
            label = {
                "user": "Student",
                "assistant": "AI Tutor",
                "system": "System"
            }.get(role, role.title())

            lines.append(f"{label}: {content}")

        return "\n\n".join(lines)

    def _get_summarization_prompt(self) -> str:
        """
        Get system prompt for summarization

        Returns:
            System prompt string
        """
        return """You are an expert at analyzing educational conversations between students and AI tutors.

Your task is to summarize tutoring sessions into structured data that will help provide context in future sessions.

Analyze the conversation and extract:
1. **topics_discussed**: Main subjects or concepts discussed (list of strings)
2. **key_questions**: Important questions the student asked (list of strings, max 5)
3. **concepts_explained**: Specific concepts that were taught (list of strings)
4. **areas_of_struggle**: Topics where the student struggled or needed extra help (list of strings)
5. **summary_text**: A concise 2-3 sentence summary of the session

Focus on educational content, not pleasantries. Be specific and actionable.

Return your response as valid JSON with these exact keys:
{
  "topics_discussed": [...],
  "key_questions": [...],
  "concepts_explained": [...],
  "areas_of_struggle": [...],
  "summary_text": "..."
}"""

    def summarize_multiple_sessions(
        self,
        sessions: List[Dict]
    ) -> List[ConversationSummary]:
        """
        Summarize multiple sessions in batch

        Args:
            sessions: List of session dicts with session_id, student_id, messages, duration

        Returns:
            List of ConversationSummary objects
        """
        summaries = []

        for session in sessions:
            try:
                summary = self.summarize_session(
                    session_id=session["session_id"],
                    student_id=session["student_id"],
                    messages=session["messages"],
                    session_duration=session.get("duration", 0)
                )
                summaries.append(summary)
            except Exception as e:
                print(f"Error summarizing session {session['session_id']}: {str(e)}")
                continue

        return summaries

    def create_cross_session_summary(
        self,
        recent_summaries: List[ConversationSummary],
        max_length: int = 500
    ) -> str:
        """
        Create a meta-summary of recent sessions for context building

        Used for cross-session recall in conversation engine

        Args:
            recent_summaries: List of recent ConversationSummary objects
            max_length: Maximum characters for output

        Returns:
            Combined summary text
        """
        if not recent_summaries:
            return ""

        # Extract key information
        all_topics = []
        all_struggles = []

        for summary in recent_summaries:
            all_topics.extend(summary.topics_discussed)
            all_struggles.extend(summary.areas_of_struggle)

        # Deduplicate and take most common
        unique_topics = list(set(all_topics))[:5]
        unique_struggles = list(set(all_struggles))[:3]

        # Build context text
        parts = []

        if unique_topics:
            parts.append(f"Recent topics: {', '.join(unique_topics)}")

        if unique_struggles:
            parts.append(f"Areas needing support: {', '.join(unique_struggles)}")

        # Add most recent session summary
        if recent_summaries:
            latest = recent_summaries[0]
            parts.append(f"Last session: {latest.summary_text}")

        context = ". ".join(parts)

        # Truncate if too long
        if len(context) > max_length:
            context = context[:max_length - 3] + "..."

        return context
