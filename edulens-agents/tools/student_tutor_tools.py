"""EduLens tools for Student Tutor agent — Strands @tool decorators."""

import json

from strands import tool

from .mock_data import MOCK_STUDENT, MOCK_QUESTION


@tool
def load_question_context(question_id: str) -> str:
    """Load the question text, the correct answer, and the student's wrong answer for the current tutoring session.

    Args:
        question_id: The question ID to load.
    """
    q = MOCK_QUESTION
    correct_option = next((o for o in q["options"] if o["isCorrect"]), None)
    student_option = next((o for o in q["options"] if o["label"] == q["studentAnswer"]), None)

    return json.dumps({
        "questionId": q["questionId"],
        "questionText": q["text"],
        "options": [f"{o['label']}. {o['text']}" for o in q["options"]],
        "correctAnswer": q["correctAnswer"],
        "correctAnswerText": correct_option["text"] if correct_option else None,
        "explanation": q["explanation"],
        "studentAnswer": q["studentAnswer"],
        "studentAnswerText": student_option["text"] if student_option else None,
        "studentTimeSpent": f"{q['studentTimeSpent']} seconds (expected {q['estimatedTime']}s)",
        "skillTags": q["skillTags"],
        "difficulty": q["difficulty"],
    }, indent=2)


@tool
def query_student_level(student_id: str) -> str:
    """Get the student's current overall mastery level and mastery for skills relevant to the current question.

    Args:
        student_id: The student ID.
    """
    relevant_skills = []
    for tag in MOCK_QUESTION["skillTags"]:
        parts = tag.split(".")
        if len(parts) == 2:
            subject, skill = parts
            breakdown = MOCK_STUDENT["skillBreakdown"].get(subject, {})
            mastery = breakdown.get(skill)
            relevant_skills.append({
                "tag": tag,
                "mastery": f"{mastery * 100:.0f}%" if mastery is not None else "unknown",
            })

    return json.dumps({
        "studentName": MOCK_STUDENT["name"],
        "overallMastery": f"{MOCK_STUDENT['overallMastery'] * 100:.0f}%",
        "relevantSkills": relevant_skills,
    }, indent=2)


@tool
def record_understanding(
    student_id: str,
    question_id: str,
    understood: bool,
    notes: str = "",
) -> str:
    """Record whether the student demonstrated understanding of the concept during this tutoring exchange.

    Args:
        student_id: The student ID.
        question_id: The question ID.
        understood: Whether the student demonstrated understanding.
        notes: Optional notes about the student's understanding.
    """
    # In production, this would write to AgentCore Memory
    return json.dumps({
        "recorded": True,
        "studentId": student_id,
        "questionId": question_id,
        "understood": understood,
        "notes": notes or None,
    }, indent=2)
