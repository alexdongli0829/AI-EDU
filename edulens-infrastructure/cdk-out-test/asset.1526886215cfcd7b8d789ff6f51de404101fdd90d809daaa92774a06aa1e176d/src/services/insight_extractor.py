"""
Insight Extractor
Analyzes conversation patterns to extract learning insights
"""

from typing import List, Dict
from datetime import datetime
from ..models.summarization import InsightExtraction, ConversationSummary
from .anthropic_client import AnthropicClient


class InsightExtractor:
    """
    Extracts learning insights from multiple conversation sessions
    Uses Claude Haiku to identify patterns and behaviors
    """

    def __init__(self, anthropic_client: AnthropicClient):
        """
        Initialize insight extractor

        Args:
            anthropic_client: Anthropic API client
        """
        self.anthropic_client = anthropic_client

    def extract_insights(
        self,
        student_id: str,
        summaries: List[ConversationSummary],
        messages: List[Dict]
    ) -> InsightExtraction:
        """
        Extract learning insights from conversation data

        Args:
            student_id: Student ID
            summaries: List of recent ConversationSummary objects
            messages: Combined messages from recent sessions

        Returns:
            InsightExtraction object
        """
        # Build analysis context
        analysis_context = self._build_analysis_context(summaries, messages)

        # Generate insights using Claude Haiku
        system_prompt = self._get_insight_prompt()
        user_prompt = f"Analyze this student's learning patterns:\n\n{analysis_context}"

        structured_data = self.anthropic_client.extract_structured_data(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            max_tokens=2000,
            temperature=0.2
        )

        # Parse response
        return InsightExtraction(
            student_id=student_id,
            preferred_learning_style=structured_data.get("preferred_learning_style"),
            engagement_level=float(structured_data.get("engagement_level", 0.5)),
            question_asking_frequency=structured_data.get(
                "question_asking_frequency", "medium"
            ),
            persistence_level=structured_data.get("persistence_level", "medium"),
            common_misconceptions=structured_data.get("common_misconceptions", []),
            strength_indicators=structured_data.get("strength_indicators", []),
            recommended_interventions=structured_data.get(
                "recommended_interventions", []
            ),
            sessions_analyzed=len(summaries),
            confidence=float(structured_data.get("confidence", 0.7)),
            generated_at=datetime.utcnow()
        )

    def _build_analysis_context(
        self,
        summaries: List[ConversationSummary],
        messages: List[Dict]
    ) -> str:
        """
        Build context for insight analysis

        Args:
            summaries: Conversation summaries
            messages: Recent messages

        Returns:
            Formatted context string
        """
        parts = []

        # Session summaries
        parts.append("=== SESSION SUMMARIES ===")
        for i, summary in enumerate(summaries, 1):
            parts.append(f"\nSession {i}:")
            parts.append(f"  Topics: {', '.join(summary.topics_discussed)}")
            parts.append(f"  Struggles: {', '.join(summary.areas_of_struggle)}")
            parts.append(f"  Summary: {summary.summary_text}")
            parts.append(f"  Messages: {summary.message_count}")

        # Behavioral indicators from messages
        parts.append("\n=== BEHAVIORAL PATTERNS ===")

        # Count question marks (question asking frequency)
        question_count = sum(
            1 for msg in messages
            if msg.get("role") == "user" and "?" in msg.get("content", "")
        )
        parts.append(f"Questions asked: {question_count}")

        # Count messages (engagement)
        student_messages = [m for m in messages if m.get("role") == "user"]
        parts.append(f"Student messages: {len(student_messages)}")

        # Average message length (engagement indicator)
        avg_length = (
            sum(len(m.get("content", "")) for m in student_messages) /
            len(student_messages)
            if student_messages else 0
        )
        parts.append(f"Average message length: {int(avg_length)} characters")

        return "\n".join(parts)

    def _get_insight_prompt(self) -> str:
        """
        Get system prompt for insight extraction

        Returns:
            System prompt string
        """
        return """You are an educational psychologist analyzing student learning patterns.

Based on conversation summaries and behavioral data, extract insights about:

1. **preferred_learning_style**: How does the student learn best?
   - "visual" - prefers diagrams, images, visual explanations
   - "verbal" - prefers text explanations, discussions
   - "example-based" - learns best from worked examples
   - "hands-on" - prefers trying things out, experimentation

2. **engagement_level**: How engaged is the student? (0.0-1.0 scale)
   - Based on message count, length, question frequency
   - 0.8-1.0 = highly engaged
   - 0.5-0.7 = moderately engaged
   - 0.0-0.4 = low engagement

3. **question_asking_frequency**: How often does student ask questions?
   - "high" - 5+ questions per session
   - "medium" - 2-4 questions per session
   - "low" - 0-1 questions per session

4. **persistence_level**: How persistent when facing difficulty?
   - "high" - continues trying, asks follow-ups
   - "medium" - some follow-through
   - "low" - gives up easily

5. **common_misconceptions**: Recurring misunderstandings (list of strings)

6. **strength_indicators**: Signs of understanding or talent (list of strings)

7. **recommended_interventions**: Suggestions for parents/teachers (list of strings, max 3)

8. **confidence**: How confident are you in these insights? (0.0-1.0)
   - More sessions = higher confidence
   - Clear patterns = higher confidence

Return valid JSON:
{
  "preferred_learning_style": "...",
  "engagement_level": 0.75,
  "question_asking_frequency": "medium",
  "persistence_level": "high",
  "common_misconceptions": [...],
  "strength_indicators": [...],
  "recommended_interventions": [...],
  "confidence": 0.8
}"""

    def calculate_engagement_metrics(
        self,
        messages: List[Dict]
    ) -> Dict[str, float]:
        """
        Calculate engagement metrics from messages

        Args:
            messages: List of message dicts

        Returns:
            Dictionary of metrics
        """
        student_messages = [m for m in messages if m.get("role") == "user"]

        if not student_messages:
            return {
                "message_count": 0,
                "avg_message_length": 0,
                "question_frequency": 0,
                "response_rate": 0
            }

        # Calculate metrics
        message_count = len(student_messages)

        total_length = sum(len(m.get("content", "")) for m in student_messages)
        avg_message_length = total_length / message_count if message_count > 0 else 0

        question_count = sum(
            1 for m in student_messages if "?" in m.get("content", "")
        )
        question_frequency = question_count / message_count if message_count > 0 else 0

        # Response rate (student messages / total messages)
        total_messages = len(messages)
        response_rate = message_count / total_messages if total_messages > 0 else 0

        return {
            "message_count": message_count,
            "avg_message_length": avg_message_length,
            "question_frequency": question_frequency,
            "response_rate": response_rate
        }
