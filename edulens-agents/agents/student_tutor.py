"""Student Tutor Agent — Strands Agent with Bedrock AgentCore Runtime entry point.

A patient, encouraging Socratic tutor that helps primary school students
understand questions they got wrong on NSW OC or Selective School practice tests.
"""

import json
import logging
import os

from bedrock_agentcore import BedrockAgentCoreApp

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = BedrockAgentCoreApp(debug=True)

# ---- System prompt ----

STUDENT_TUTOR_SYSTEM_PROMPT = """You are a patient, encouraging Socratic tutor for EduLens, helping a primary school student understand a question they got wrong on a NSW OC or Selective School practice test.

YOUR METHOD — STRICTLY SOCRATIC:
- NEVER give the correct answer directly, even if the student asks.
- Guide the student to discover it themselves through questions and hints.
- Start with the most minimal hint. Only go deeper if still stuck.
- After 3 exchanges of being stuck, you may reveal the answer with a clear explanation.
- If the student gets it right, celebrate briefly and explain WHY it's right.

LANGUAGE:
- Always respond in English (students are preparing for English-language exams).

TONE:
- Age-appropriate for 9-12 year olds.
- Encouraging but honest.
- Keep responses short: 2-4 sentences maximum.
- Use simple vocabulary.

CONSTRAINTS:
- You may ONLY discuss the specific question loaded via your tools.
- Do NOT answer unrelated questions or engage in general tutoring.
- Do NOT discuss other subjects unless the student asks about the specific question.
- If the student tries to go off-topic, gently redirect: "Let's focus on this question first!"

IMPORTANT: At the start of the conversation, ALWAYS call load_question_context first to understand which question the student got wrong and what their answer was. Then begin your Socratic guidance."""

# ---- Model config ----

MODEL_ID = os.environ.get("MODEL_ID", "us.anthropic.claude-sonnet-4-20250514-v1:0")

# ---- Lazy-initialised agent (avoids heavy work at import time) ----

_agent = None


def _get_agent():
    """Return the singleton Agent, creating it on first call."""
    global _agent
    if _agent is None:
        from strands import Agent
        from strands.models import BedrockModel
        from tools.student_tutor_tools import (
            load_question_context,
            query_student_level,
            record_understanding,
        )
        from tools.memory_tools import retrieve_memories

        model = BedrockModel(
            model_id=MODEL_ID,
            temperature=0.5,  # Slightly more creative for tutoring
            streaming=True,
        )
        _agent = Agent(
            model=model,
            tools=[
                load_question_context,
                query_student_level,
                retrieve_memories,
                record_understanding,
            ],
            system_prompt=STUDENT_TUTOR_SYSTEM_PROMPT,
        )
    return _agent


@app.entrypoint
def invoke(payload: dict) -> str:
    """Student Tutor agent entry point for AgentCore Runtime."""
    user_input = payload.get("prompt", "I don't know how to solve this.")
    student_id = payload.get("studentId", "mock-student-001")
    question_id = payload.get("questionId", "mock-q-001")

    logger.info("Student Tutor received: %s (student: %s, question: %s)",
                user_input[:100], student_id, question_id)

    # Lazy import signal extraction
    from guardrails.signal_extraction import extract_signals

    # Run the agent (lazy init on first call)
    agent = _get_agent()
    result = agent(user_input)
    response_text = result.message["content"][0]["text"]

    # Extract signals for analytics
    signals = extract_signals(user_input + " " + response_text)
    if signals:
        logger.info(
            "Extracted %d signals: %s",
            len(signals),
            ", ".join(f"{s.type}:{s.value}" for s in signals),
        )

    return json.dumps({
        "response": response_text,
        "signals": [
            {"type": s.type, "value": s.value, "confidence": s.confidence}
            for s in signals
        ] if signals else [],
    })


if __name__ == "__main__":
    app.run()
