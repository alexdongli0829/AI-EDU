"""Unit tests for EduLens agents — guardrails, tools, and signal extraction.
These tests don't require Bedrock access (no model invocation)."""

import json
import pytest

# ---- Guardrail Tests ----

from guardrails.input_guardrail import check_input_guardrails
from guardrails.output_guardrail import check_output_guardrails
from guardrails.signal_extraction import extract_signals


class TestInputGuardrails:
    """Test input message validation."""

    def test_educational_message_passes(self):
        result = check_input_guardrails("How is Mia doing on her math tests?")
        assert not result.blocked

    def test_chinese_educational_passes(self):
        result = check_input_guardrails("她的数学成绩怎么样？")
        assert not result.blocked

    def test_medical_keyword_blocked(self):
        result = check_input_guardrails("Does Mia have ADHD?")
        assert result.blocked
        assert result.reason == "medical_redirect"
        assert "ADHD" in result.redirect_message

    def test_inappropriate_content_blocked(self):
        # Include educational keyword so it doesn't hit off_topic first
        result = check_input_guardrails("This test is fucking stupid")
        assert result.blocked
        assert result.reason == "inappropriate_content"

    def test_off_topic_blocked(self):
        result = check_input_guardrails("What is the weather like today in Sydney?")
        assert result.blocked
        assert result.reason == "off_topic"

    def test_short_message_passes(self):
        # Short messages (< 3 words) bypass off-topic check
        result = check_input_guardrails("Hi there")
        assert not result.blocked

    def test_long_message_blocked(self):
        result = check_input_guardrails("x" * 2001)
        assert result.blocked
        assert result.reason == "message_too_long"

    def test_depression_keyword_blocked(self):
        result = check_input_guardrails("I think my child has depression and needs therapy")
        assert result.blocked
        assert result.reason == "medical_redirect"


class TestOutputGuardrails:
    """Test output response validation."""

    def test_clean_response_passes(self):
        violations = check_output_guardrails(
            "Mia scored 72% on her latest test, showing improvement in reading inference."
        )
        assert len(violations) == 0

    def test_prediction_detected(self):
        violations = check_output_guardrails("Mia will definitely pass the OC test!")
        assert any(v.type == "prediction" for v in violations)

    def test_guaranteed_detected(self):
        violations = check_output_guardrails("Success is guaranteed with enough practice.")
        assert any(v.type == "prediction" for v in violations)

    def test_comparison_detected(self):
        violations = check_output_guardrails("Mia is better than most students in her class.")
        assert any(v.type == "comparison" for v in violations)

    def test_percentile_detected(self):
        violations = check_output_guardrails("She is in the 90th percentile for reading.")
        assert any(v.type == "comparison" for v in violations)

    def test_medical_advice_detected(self):
        violations = check_output_guardrails("Mia should see a psychologist about her focus issues.")
        assert any(v.type == "medical_advice" for v in violations)

    def test_multiple_violations(self):
        text = "She will definitely pass and is better than most students. She should see a therapist."
        violations = check_output_guardrails(text)
        types = {v.type for v in violations}
        assert "prediction" in types
        assert "comparison" in types
        assert "medical_advice" in types


class TestSignalExtraction:
    """Test educational signal extraction."""

    def test_math_skill_detected(self):
        signals = extract_signals("How is Mia doing on math number patterns?")
        types = [(s.type, s.value) for s in signals]
        assert ("skill_mentioned", "math") in types
        assert ("skill_mentioned", "math.number_patterns") in types

    def test_concern_detected(self):
        signals = extract_signals("I'm worried about her struggling in geometry")
        types = [(s.type, s.value) for s in signals]
        assert ("concern_raised", "worried") in types
        assert ("concern_raised", "struggling") in types

    def test_chinese_language_detected(self):
        signals = extract_signals("她的阅读能力怎么样？")
        types = [(s.type, s.value) for s in signals]
        assert ("language_preference", "chinese") in types

    def test_understanding_detected(self):
        signals = extract_signals("Oh I see, it makes sense now!")
        types = [s.type for s in signals]
        assert "understanding_demonstrated" in types

    def test_confusion_detected(self):
        signals = extract_signals("I don't understand this at all, I'm confused")
        types = [s.type for s in signals]
        assert "confusion_detected" in types

    def test_no_signals_for_generic(self):
        signals = extract_signals("Hello")
        assert len(signals) == 0


# ---- Tool Tests ----

from tools.parent_advisor_tools import (
    query_student_profile,
    query_test_results,
    query_skill_breakdown,
    query_time_behavior,
    query_error_patterns,
)
from tools.student_tutor_tools import (
    load_question_context,
    query_student_level,
    record_understanding,
)
from tools.memory_tools import retrieve_memories


class TestParentAdvisorTools:
    """Test Parent Advisor data tools."""

    def test_query_student_profile(self):
        result = json.loads(query_student_profile(student_id="mock-student-001"))
        assert result["name"] == "Mia"
        assert result["overallMastery"] == "68%"
        assert result["recentTrend"] == "improving"
        assert len(result["lastThreeTests"]) == 3

    def test_query_test_results(self):
        result = json.loads(query_test_results(student_id="mock-student-001", limit=2))
        assert result["testCount"] == 2
        assert result["tests"][0]["percentage"] == "72%"

    def test_query_skill_breakdown_math(self):
        result = json.loads(query_skill_breakdown(student_id="mock-student-001", subject="math"))
        assert result["subject"] == "math"
        skills = {s["skill"]: s for s in result["skills"]}
        assert skills["number_patterns"]["status"] == "needs_focus"
        assert skills["number_patterns"]["mastery"] == "45%"

    def test_query_skill_breakdown_reading(self):
        result = json.loads(query_skill_breakdown(student_id="mock-student-001", subject="reading"))
        skills = {s["skill"]: s for s in result["skills"]}
        assert skills["inference"]["status"] == "strong"

    def test_query_time_behavior(self):
        result = json.loads(query_time_behavior(student_id="mock-student-001"))
        assert result["avgTimePerQuestion"] == "48 seconds"
        assert "35%" in result["rushingIndicator"]

    def test_query_error_patterns(self):
        result = json.loads(query_error_patterns(student_id="mock-student-001"))
        assert result["totalErrors"] == 28
        types = {p["type"] for p in result["patterns"]}
        assert "careless_error" in types
        assert "time_pressure" in types


class TestStudentTutorTools:
    """Test Student Tutor data tools."""

    def test_load_question_context(self):
        result = json.loads(load_question_context(question_id="mock-q-001"))
        assert result["correctAnswer"] == "B"
        assert result["studentAnswer"] == "A"
        assert "162" in result["correctAnswerText"]
        assert "108" in result["studentAnswerText"]
        assert "math.number_patterns" in result["skillTags"]

    def test_query_student_level(self):
        result = json.loads(query_student_level(student_id="mock-student-001"))
        assert result["overallMastery"] == "68%"
        assert len(result["relevantSkills"]) > 0
        assert result["relevantSkills"][0]["mastery"] == "45%"

    def test_record_understanding(self):
        result = json.loads(record_understanding(
            student_id="mock-student-001",
            question_id="mock-q-001",
            understood=True,
            notes="Got it after second hint",
        ))
        assert result["recorded"] is True
        assert result["understood"] is True


class TestMemoryTools:
    """Test memory retrieval tool."""

    def test_retrieve_math_memories(self):
        result = json.loads(retrieve_memories(query="math number patterns"))
        assert result["resultCount"] > 0
        assert any("math" in r["content"].lower() for r in result["records"])

    def test_retrieve_with_namespace(self):
        result = json.loads(retrieve_memories(
            query="tutoring session patterns",
            namespace="tutoring-sessions",
        ))
        assert all(r["namespace"] == "tutoring-sessions" for r in result["records"])

    def test_retrieve_no_results(self):
        result = json.loads(retrieve_memories(query="xyznonexistent"))
        assert result["resultCount"] == 0

    def test_retrieve_time_management(self):
        result = json.loads(retrieve_memories(query="time management rushing"))
        assert result["resultCount"] > 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
