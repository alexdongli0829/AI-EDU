"""
Unit tests for Error Classifier
"""

import pytest
from datetime import datetime
from src.services.error_classifier import ErrorClassifier
from src.models.skill_node import ErrorPattern


class TestErrorClassifier:
    """Test suite for error classification"""

    def setup_method(self):
        """Set up test fixtures"""
        self.classifier = ErrorClassifier(
            frequency_threshold=3,
            severity_thresholds={"low": 3, "medium": 5, "high": 8}
        )

    def test_time_pressure_classification(self):
        """Test that rushed answers are classified as time_pressure"""
        error_type = self.classifier.classify_error(
            question_type="multiple_choice",
            skill_tags=["reading.inference"],
            time_spent=20,  # Much less than estimated
            estimated_time=60,
            student_answer="option-a",
            correct_answer="option-b"
        )

        assert error_type == "time_pressure"

    def test_careless_mistake_classification(self):
        """Test that very quick wrong answers are careless mistakes"""
        error_type = self.classifier.classify_error(
            question_type="multiple_choice",
            skill_tags=["math.arithmetic"],
            time_spent=15,  # Less than 30% of estimated
            estimated_time=60,
            student_answer="42",
            correct_answer="43"
        )

        assert error_type == "careless_mistake"

    def test_conceptual_gap_classification(self):
        """Test that long time + wrong = conceptual gap"""
        error_type = self.classifier.classify_error(
            question_type="multiple_choice",
            skill_tags=["math.algebra"],
            time_spent=120,  # Much more than estimated
            estimated_time=60,
            student_answer="option-a",
            correct_answer="option-d"
        )

        assert error_type == "conceptual_gap"

    def test_calculation_error_detection(self):
        """Test that close numeric answers are calculation errors"""
        error_type = self.classifier.classify_error(
            question_type="short_answer",
            skill_tags=["math.arithmetic"],
            time_spent=45,
            estimated_time=60,
            student_answer="42",
            correct_answer="45"
        )

        assert error_type == "calculation_error"

    def test_partial_understanding_classification(self):
        """Test that incomplete answers show partial understanding"""
        error_type = self.classifier.classify_error(
            question_type="short_answer",
            skill_tags=["writing.essay"],
            time_spent=45,
            estimated_time=60,
            student_answer="Short answer",
            correct_answer="Much longer detailed correct answer"
        )

        assert error_type == "partial_understanding"

    def test_aggregate_error_patterns(self):
        """Test aggregating errors into patterns"""
        responses = [
            {
                "error_type": "misread_question",
                "skill_tags": ["reading.inference"],
                "question_id": "q1",
                "timestamp": datetime.utcnow()
            },
            {
                "error_type": "misread_question",
                "skill_tags": ["reading.main-idea"],
                "question_id": "q2",
                "timestamp": datetime.utcnow()
            },
            {
                "error_type": "misread_question",
                "skill_tags": ["reading.inference"],
                "question_id": "q3",
                "timestamp": datetime.utcnow()
            }
        ]

        patterns = self.classifier.aggregate_error_patterns(responses)

        assert len(patterns) == 1
        assert patterns[0].error_type == "misread_question"
        assert patterns[0].frequency == 3
        assert "reading.inference" in patterns[0].skills_affected

    def test_frequency_threshold_filtering(self):
        """Test that infrequent errors are not returned as patterns"""
        responses = [
            {
                "error_type": "time_pressure",
                "skill_tags": ["math.algebra"],
                "question_id": "q1",
                "timestamp": datetime.utcnow()
            },
            {
                "error_type": "time_pressure",
                "skill_tags": ["math.algebra"],
                "question_id": "q2",
                "timestamp": datetime.utcnow()
            }
        ]

        patterns = self.classifier.aggregate_error_patterns(responses)

        # Should be empty because frequency < threshold (3)
        assert len(patterns) == 0

    def test_severity_calculation(self):
        """Test severity level assignment"""
        responses_low = [
            {
                "error_type": "error1",
                "skill_tags": ["skill1"],
                "question_id": f"q{i}",
                "timestamp": datetime.utcnow()
            }
            for i in range(4)  # 4 occurrences = low severity
        ]

        responses_high = [
            {
                "error_type": "error2",
                "skill_tags": ["skill2"],
                "question_id": f"q{i}",
                "timestamp": datetime.utcnow()
            }
            for i in range(10)  # 10 occurrences = high severity
        ]

        patterns_low = self.classifier.aggregate_error_patterns(responses_low)
        patterns_high = self.classifier.aggregate_error_patterns(responses_high)

        assert patterns_low[0].severity == "low"
        assert patterns_high[0].severity == "high"

    def test_get_recommendations(self):
        """Test recommendation generation"""
        patterns = [
            ErrorPattern(
                error_type="conceptual_gap",
                frequency=10,
                skills_affected=["math.fractions", "math.decimals"],
                examples=["q1", "q2"],
                severity="high",
                first_seen=datetime.utcnow(),
                last_seen=datetime.utcnow()
            ),
            ErrorPattern(
                error_type="time_pressure",
                frequency=8,
                skills_affected=["reading.comprehension"],
                examples=["q3", "q4"],
                severity="high",
                first_seen=datetime.utcnow(),
                last_seen=datetime.utcnow()
            )
        ]

        recommendations = self.classifier.get_recommendations(patterns)

        assert len(recommendations) >= 2
        assert any("fundamental concepts" in rec.lower() for rec in recommendations)
        assert any("time management" in rec.lower() for rec in recommendations)

    def test_track_error_trends(self):
        """Test error trend tracking"""
        historical = [
            ErrorPattern(
                error_type="misread_question",
                frequency=10,
                skills_affected=["reading"],
                examples=[],
                severity="high",
                first_seen=datetime.utcnow(),
                last_seen=datetime.utcnow()
            )
        ]

        current_improving = [
            ErrorPattern(
                error_type="misread_question",
                frequency=5,  # Reduced from 10
                skills_affected=["reading"],
                examples=[],
                severity="medium",
                first_seen=datetime.utcnow(),
                last_seen=datetime.utcnow()
            )
        ]

        current_worsening = [
            ErrorPattern(
                error_type="misread_question",
                frequency=15,  # Increased from 10
                skills_affected=["reading"],
                examples=[],
                severity="high",
                first_seen=datetime.utcnow(),
                last_seen=datetime.utcnow()
            )
        ]

        trends_improving = self.classifier.track_error_trends(
            historical, current_improving
        )
        trends_worsening = self.classifier.track_error_trends(
            historical, current_worsening
        )

        assert trends_improving["misread_question"] == "improving"
        assert trends_worsening["misread_question"] == "worsening"
