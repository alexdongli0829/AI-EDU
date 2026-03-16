"""EduLens tools for Parent Advisor agent — Strands @tool decorators.
Each tool returns structured JSON data from mock data (replace with Aurora queries later)."""

import json

from strands import tool

from .mock_data import MOCK_STUDENT


@tool
def query_student_profile(student_id: str) -> str:
    """Get the student's Learning DNA overview including mastery level, strengths, weaknesses, and recent trends.

    Args:
        student_id: The student ID to look up.
    """
    s = MOCK_STUDENT
    history = s["testHistory"]
    if len(history) >= 2:
        diff = history[0]["score"] - history[1]["score"]
        trend = "improving" if diff > 0 else ("stable" if diff == 0 else "declining")
    else:
        trend = "insufficient data"

    return json.dumps({
        "studentId": s["studentId"],
        "name": s["name"],
        "gradeLevel": s["gradeLevel"],
        "overallMastery": f"{s['overallMastery'] * 100:.0f}%",
        "strengths": s["strengths"],
        "weaknesses": s["weaknesses"],
        "recentTrend": trend,
        "lastThreeTests": history,
    }, indent=2)


@tool
def query_test_results(student_id: str, limit: int = 5) -> str:
    """Get recent test scores and details for a student.

    Args:
        student_id: The student ID.
        limit: Number of recent tests to return (default 5).
    """
    tests = MOCK_STUDENT["testHistory"][:limit]
    return json.dumps({
        "studentName": MOCK_STUDENT["name"],
        "testCount": len(tests),
        "tests": [
            {
                **t,
                "percentage": f"{t['score']}%",
                "accuracy": f"{t['correct']}/{t['total']}",
            }
            for t in tests
        ],
    }, indent=2)


@tool
def query_skill_breakdown(student_id: str, subject: str) -> str:
    """Get per-skill mastery percentages for a given subject.

    Args:
        student_id: The student ID.
        subject: The subject — one of 'reading', 'math', or 'thinking'.
    """
    breakdown = MOCK_STUDENT["skillBreakdown"].get(subject, {})
    skills = []
    for skill_name, mastery in breakdown.items():
        status = "strong" if mastery >= 0.75 else ("developing" if mastery >= 0.55 else "needs_focus")
        skills.append({
            "skill": skill_name,
            "mastery": f"{mastery * 100:.0f}%",
            "status": status,
        })
    return json.dumps({
        "studentName": MOCK_STUDENT["name"],
        "subject": subject,
        "skills": skills,
    }, indent=2)


@tool
def query_time_behavior(student_id: str) -> str:
    """Get time management analysis including average time per question, rushing indicators, and stamina curve.

    Args:
        student_id: The student ID.
    """
    tb = MOCK_STUDENT["timeBehavior"]
    return json.dumps({
        "studentName": MOCK_STUDENT["name"],
        "avgTimePerQuestion": f"{tb['avgTimePerQuestion']} seconds",
        "rushingIndicator": f"{tb['rushingIndicator'] * 100:.0f}% of answers show rushing",
        "staminaCurve": tb["staminaCurve"],
        "fastAnswers": f"{tb['fastAnswers']} questions answered in under 15 seconds",
    }, indent=2)


@tool
def query_error_patterns(student_id: str) -> str:
    """Get error classification breakdown showing error types and their frequencies.

    Args:
        student_id: The student ID.
    """
    patterns = MOCK_STUDENT["errorPatterns"]
    total_errors = sum(e["frequency"] for e in patterns)
    return json.dumps({
        "studentName": MOCK_STUDENT["name"],
        "totalErrors": total_errors,
        "patterns": [
            {
                "type": e["type"],
                "count": e["frequency"],
                "percentage": f"{(e['frequency'] / total_errors) * 100:.0f}%",
                "severity": e["severity"],
            }
            for e in patterns
        ],
    }, indent=2)
