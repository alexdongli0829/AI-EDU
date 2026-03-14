"""
Unit tests for Conversation Summarizer
"""

import pytest
from unittest.mock import Mock, patch
from src.services.summarizer import ConversationSummarizer
from src.services.anthropic_client import AnthropicClient
from src.models.summarization import ConversationSummary


class TestConversationSummarizer:
    """Test suite for conversation summarization"""

    def setup_method(self):
        """Set up test fixtures"""
        self.mock_anthropic = Mock(spec=AnthropicClient)
        self.summarizer = ConversationSummarizer(self.mock_anthropic)

    def test_build_transcript(self):
        """Test transcript building from messages"""
        messages = [
            {"role": "user", "content": "What is 2+2?"},
            {"role": "assistant", "content": "2+2 equals 4."},
            {"role": "user", "content": "Thanks!"}
        ]

        transcript = self.summarizer._build_transcript(messages)

        assert "Student: What is 2+2?" in transcript
        assert "AI Tutor: 2+2 equals 4." in transcript
        assert "Student: Thanks!" in transcript

    def test_summarize_session(self):
        """Test session summarization"""
        # Mock API response
        mock_response = {
            "topics_discussed": ["addition", "arithmetic"],
            "key_questions": ["What is 2+2?"],
            "concepts_explained": ["Basic addition"],
            "areas_of_struggle": [],
            "summary_text": "Student learned basic addition."
        }

        self.mock_anthropic.extract_structured_data.return_value = mock_response

        # Test messages
        messages = [
            {"role": "user", "content": "What is 2+2?"},
            {"role": "assistant", "content": "2+2 equals 4."}
        ]

        # Summarize
        summary = self.summarizer.summarize_session(
            session_id="session-1",
            student_id="student-1",
            messages=messages,
            session_duration=300
        )

        # Assertions
        assert isinstance(summary, ConversationSummary)
        assert summary.session_id == "session-1"
        assert summary.student_id == "student-1"
        assert "addition" in summary.topics_discussed
        assert summary.message_count == 2
        assert summary.duration_seconds == 300

        # Verify API was called
        self.mock_anthropic.extract_structured_data.assert_called_once()

    def test_empty_messages(self):
        """Test handling of empty messages"""
        mock_response = {
            "topics_discussed": [],
            "key_questions": [],
            "concepts_explained": [],
            "areas_of_struggle": [],
            "summary_text": "No conversation."
        }

        self.mock_anthropic.extract_structured_data.return_value = mock_response

        summary = self.summarizer.summarize_session(
            session_id="session-1",
            student_id="student-1",
            messages=[],
            session_duration=0
        )

        assert summary.message_count == 0
        assert summary.topics_discussed == []

    def test_create_cross_session_summary(self):
        """Test creating meta-summary from multiple sessions"""
        summaries = [
            ConversationSummary(
                session_id="s1",
                student_id="student-1",
                topics_discussed=["fractions", "division"],
                key_questions=["How do I divide fractions?"],
                concepts_explained=["Keep-Change-Flip"],
                areas_of_struggle=["reciprocals"],
                summary_text="Learned fraction division.",
                message_count=10,
                duration_seconds=600
            ),
            ConversationSummary(
                session_id="s2",
                student_id="student-1",
                topics_discussed=["fractions", "word problems"],
                key_questions=["How do I solve word problems?"],
                concepts_explained=["Problem-solving steps"],
                areas_of_struggle=["word problems"],
                summary_text="Practiced word problems.",
                message_count=8,
                duration_seconds=500
            )
        ]

        context = self.summarizer.create_cross_session_summary(summaries)

        assert "fractions" in context.lower()
        assert "reciprocals" in context.lower() or "word problems" in context.lower()
        assert len(context) <= 500

    def test_cross_session_summary_empty(self):
        """Test cross-session summary with no summaries"""
        context = self.summarizer.create_cross_session_summary([])

        assert context == ""

    def test_cross_session_summary_truncation(self):
        """Test that cross-session summary truncates long text"""
        summaries = [
            ConversationSummary(
                session_id=f"s{i}",
                student_id="student-1",
                topics_discussed=[f"topic-{i}" for i in range(20)],
                key_questions=[],
                concepts_explained=[],
                areas_of_struggle=[f"struggle-{i}" for i in range(20)],
                summary_text="A" * 200,
                message_count=10,
                duration_seconds=600
            )
            for i in range(10)
        ]

        context = self.summarizer.create_cross_session_summary(
            summaries,
            max_length=200
        )

        assert len(context) <= 203  # 200 + "..."

    def test_summarize_multiple_sessions(self):
        """Test batch summarization"""
        mock_response = {
            "topics_discussed": ["math"],
            "key_questions": [],
            "concepts_explained": [],
            "areas_of_struggle": [],
            "summary_text": "Summary"
        }

        self.mock_anthropic.extract_structured_data.return_value = mock_response

        sessions = [
            {
                "session_id": "s1",
                "student_id": "student-1",
                "messages": [{"role": "user", "content": "Hello"}],
                "duration": 300
            },
            {
                "session_id": "s2",
                "student_id": "student-1",
                "messages": [{"role": "user", "content": "Hi"}],
                "duration": 200
            }
        ]

        summaries = self.summarizer.summarize_multiple_sessions(sessions)

        assert len(summaries) == 2
        assert all(isinstance(s, ConversationSummary) for s in summaries)

    def test_summarize_multiple_sessions_with_errors(self):
        """Test batch summarization handles errors gracefully"""
        # First call succeeds, second fails
        self.mock_anthropic.extract_structured_data.side_effect = [
            {
                "topics_discussed": ["math"],
                "key_questions": [],
                "concepts_explained": [],
                "areas_of_struggle": [],
                "summary_text": "Summary"
            },
            Exception("API Error")
        ]

        sessions = [
            {
                "session_id": "s1",
                "student_id": "student-1",
                "messages": [{"role": "user", "content": "Hello"}],
                "duration": 300
            },
            {
                "session_id": "s2",
                "student_id": "student-1",
                "messages": [{"role": "user", "content": "Hi"}],
                "duration": 200
            }
        ]

        summaries = self.summarizer.summarize_multiple_sessions(sessions)

        # Should have 1 successful summary, 1 skipped due to error
        assert len(summaries) == 1
