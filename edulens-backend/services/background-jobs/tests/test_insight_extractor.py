"""
Unit tests for Insight Extractor
"""

import pytest
from unittest.mock import Mock
from src.services.insight_extractor import InsightExtractor
from src.services.anthropic_client import AnthropicClient
from src.models.summarization import ConversationSummary, InsightExtraction


class TestInsightExtractor:
    """Test suite for insight extraction"""

    def setup_method(self):
        """Set up test fixtures"""
        self.mock_anthropic = Mock(spec=AnthropicClient)
        self.extractor = InsightExtractor(self.mock_anthropic)

    def test_build_analysis_context(self):
        """Test building analysis context"""
        summaries = [
            ConversationSummary(
                session_id="s1",
                student_id="student-1",
                topics_discussed=["fractions"],
                key_questions=["How?"],
                concepts_explained=["Division"],
                areas_of_struggle=["Reciprocals"],
                summary_text="Learned fractions.",
                message_count=10,
                duration_seconds=600
            )
        ]

        messages = [
            {"role": "user", "content": "What is a fraction?"},
            {"role": "assistant", "content": "A fraction is..."},
            {"role": "user", "content": "How do I divide fractions?"}
        ]

        context = self.extractor._build_analysis_context(summaries, messages)

        assert "SESSION SUMMARIES" in context
        assert "fractions" in context.lower()
        assert "BEHAVIORAL PATTERNS" in context
        assert "Questions asked: 2" in context  # 2 questions with "?"

    def test_extract_insights(self):
        """Test insight extraction"""
        # Mock API response
        mock_response = {
            "preferred_learning_style": "example-based",
            "engagement_level": 0.75,
            "question_asking_frequency": "high",
            "persistence_level": "medium",
            "common_misconceptions": ["Confuses division and multiplication"],
            "strength_indicators": ["Quick learner"],
            "recommended_interventions": ["Provide more examples"],
            "confidence": 0.8
        }

        self.mock_anthropic.extract_structured_data.return_value = mock_response

        # Test data
        summaries = [
            ConversationSummary(
                session_id="s1",
                student_id="student-1",
                topics_discussed=["math"],
                key_questions=[],
                concepts_explained=[],
                areas_of_struggle=[],
                summary_text="Math session.",
                message_count=10,
                duration_seconds=600
            )
        ]

        messages = [
            {"role": "user", "content": "Hello"},
            {"role": "assistant", "content": "Hi there!"}
        ]

        # Extract insights
        insights = self.extractor.extract_insights(
            student_id="student-1",
            summaries=summaries,
            messages=messages
        )

        # Assertions
        assert isinstance(insights, InsightExtraction)
        assert insights.student_id == "student-1"
        assert insights.preferred_learning_style == "example-based"
        assert insights.engagement_level == 0.75
        assert insights.question_asking_frequency == "high"
        assert insights.sessions_analyzed == 1
        assert insights.confidence == 0.8

        # Verify API was called
        self.mock_anthropic.extract_structured_data.assert_called_once()

    def test_calculate_engagement_metrics(self):
        """Test engagement metrics calculation"""
        messages = [
            {"role": "user", "content": "What is 2+2?"},
            {"role": "assistant", "content": "2+2 is 4."},
            {"role": "user", "content": "How about 3+3?"},
            {"role": "assistant", "content": "3+3 is 6."},
            {"role": "user", "content": "Thanks!"}
        ]

        metrics = self.extractor.calculate_engagement_metrics(messages)

        assert metrics["message_count"] == 3  # 3 student messages
        assert metrics["avg_message_length"] > 0
        assert metrics["question_frequency"] == 2/3  # 2 questions out of 3 messages
        assert metrics["response_rate"] == 3/5  # 3 student messages out of 5 total

    def test_calculate_engagement_metrics_empty(self):
        """Test engagement metrics with no messages"""
        metrics = self.extractor.calculate_engagement_metrics([])

        assert metrics["message_count"] == 0
        assert metrics["avg_message_length"] == 0
        assert metrics["question_frequency"] == 0
        assert metrics["response_rate"] == 0

    def test_calculate_engagement_metrics_no_student_messages(self):
        """Test engagement metrics with only assistant messages"""
        messages = [
            {"role": "assistant", "content": "Hello!"},
            {"role": "assistant", "content": "How can I help?"}
        ]

        metrics = self.extractor.calculate_engagement_metrics(messages)

        assert metrics["message_count"] == 0
        assert metrics["response_rate"] == 0

    def test_extract_insights_with_high_engagement(self):
        """Test insight extraction with high engagement"""
        mock_response = {
            "preferred_learning_style": "verbal",
            "engagement_level": 0.9,
            "question_asking_frequency": "high",
            "persistence_level": "high",
            "common_misconceptions": [],
            "strength_indicators": ["Highly engaged", "Asks great questions"],
            "recommended_interventions": [],
            "confidence": 0.85
        }

        self.mock_anthropic.extract_structured_data.return_value = mock_response

        summaries = [
            ConversationSummary(
                session_id=f"s{i}",
                student_id="student-1",
                topics_discussed=["math"],
                key_questions=[],
                concepts_explained=[],
                areas_of_struggle=[],
                summary_text="Session.",
                message_count=20,
                duration_seconds=1200
            )
            for i in range(5)
        ]

        messages = [
            {"role": "user", "content": f"Question {i}?"}
            for i in range(50)
        ]

        insights = self.extractor.extract_insights(
            student_id="student-1",
            summaries=summaries,
            messages=messages
        )

        assert insights.engagement_level >= 0.8
        assert insights.question_asking_frequency == "high"
        assert insights.sessions_analyzed == 5

    def test_extract_insights_with_low_engagement(self):
        """Test insight extraction with low engagement"""
        mock_response = {
            "preferred_learning_style": "visual",
            "engagement_level": 0.3,
            "question_asking_frequency": "low",
            "persistence_level": "low",
            "common_misconceptions": ["Lacks focus"],
            "strength_indicators": [],
            "recommended_interventions": ["Increase engagement", "Use more visuals"],
            "confidence": 0.7
        }

        self.mock_anthropic.extract_structured_data.return_value = mock_response

        summaries = [
            ConversationSummary(
                session_id="s1",
                student_id="student-1",
                topics_discussed=["math"],
                key_questions=[],
                concepts_explained=[],
                areas_of_struggle=[],
                summary_text="Short session.",
                message_count=3,
                duration_seconds=120
            )
        ]

        messages = [
            {"role": "user", "content": "ok"},
            {"role": "assistant", "content": "Let me explain..."},
            {"role": "user", "content": "thanks"}
        ]

        insights = self.extractor.extract_insights(
            student_id="student-1",
            summaries=summaries,
            messages=messages
        )

        assert insights.engagement_level < 0.5
        assert insights.question_asking_frequency == "low"
        assert len(insights.recommended_interventions) > 0
