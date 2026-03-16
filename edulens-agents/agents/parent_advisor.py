"""Parent Advisor Agent — Strands Agent with Bedrock AgentCore Runtime entry point.

An experienced, caring AI educational advisor that speaks with parents about
their child's learning progress for NSW OC and Selective School exam prep.
"""

import json
import logging
import os

from bedrock_agentcore import BedrockAgentCoreApp
from strands import Agent
from strands.models import BedrockModel

from tools.parent_advisor_tools import (
    query_student_profile,
    query_test_results,
    query_skill_breakdown,
    query_time_behavior,
    query_error_patterns,
)
from tools.memory_tools import retrieve_memories
from guardrails.input_guardrail import check_input_guardrails
from guardrails.output_guardrail import check_output_guardrails
from guardrails.signal_extraction import extract_signals

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = BedrockAgentCoreApp(debug=True)

# ---- System prompt ----

PARENT_ADVISOR_SYSTEM_PROMPT = """You are an experienced, caring AI educational advisor for EduLens, speaking with a parent about their child's learning progress for NSW OC and Selective School exam preparation.

VOICE & TONE:
- Speak like a trusted teacher at a parent-teacher conference.
- Be warm but direct. Parents want clarity, not vagueness.
- Use the student's first name, never "the student".
- Acknowledge effort and progress before discussing weaknesses.
- Frame weaknesses as opportunities, not deficits.

LANGUAGE:
- Default to English.
- If the parent writes in Chinese, respond in Chinese.
- If the parent writes in any other language, respond in English.

DATA GROUNDING (CRITICAL):
- ONLY reference data returned by your tools. Never invent statistics.
- When citing numbers, be specific: "scored 7/10 on inference questions across the last 3 tests" not "did well on inference".
- If data is insufficient, say so: "I don't have enough data on that yet. After a few more tests, I'll have a clearer picture."
- Always call the relevant tool to get data before making claims.

CONSTRAINTS:
- Do NOT make predictions about exam outcomes or school admissions.
- Do NOT provide medical, psychological, or behavioral advice.
- Do NOT compare the child to other students or benchmarks.
- Provide actionable recommendations: specific skills to practice, question types to focus on, time management tips.

FOLLOW-UP QUESTIONS:
- After each response, suggest 1-2 natural follow-up questions the parent might want to ask, based on areas of the profile not yet discussed."""

# ---- Model config ----

MODEL_ID = os.environ.get("MODEL_ID", "us.anthropic.claude-sonnet-4-20250514-v1:0")

model = BedrockModel(
    model_id=MODEL_ID,
    temperature=0.3,
    streaming=True,
)

# ---- Agent ----

agent = Agent(
    model=model,
    tools=[
        query_student_profile,
        query_test_results,
        query_skill_breakdown,
        query_time_behavior,
        query_error_patterns,
        retrieve_memories,
    ],
    system_prompt=PARENT_ADVISOR_SYSTEM_PROMPT,
)


@app.entrypoint
def invoke(payload: dict) -> str:
    """Parent Advisor agent entry point for AgentCore Runtime."""
    user_input = payload.get("prompt", "")
    student_id = payload.get("studentId", "mock-student-001")

    logger.info("Parent Advisor received: %s (student: %s)", user_input[:100], student_id)

    # Pre-check input guardrails
    guardrail_result = check_input_guardrails(user_input)
    if guardrail_result.blocked:
        logger.info("Input blocked by guardrail: %s", guardrail_result.reason)
        return json.dumps({
            "response": guardrail_result.redirect_message,
            "blocked": True,
            "reason": guardrail_result.reason,
        })

    # Run the agent
    result = agent(user_input)
    response_text = result.message["content"][0]["text"]

    # Post-check output guardrails
    violations = check_output_guardrails(response_text)
    if violations:
        violation_summary = "; ".join(f"[{v.type}] {v.message}" for v in violations)
        logger.warning("Output guardrail violations: %s", violation_summary)
        # Re-run with guardrail instructions appended
        retry_prompt = (
            f"{user_input}\n\n"
            f"IMPORTANT: Your previous response violated these rules: {violation_summary}. "
            f"Please respond without making predictions, comparisons, or medical advice."
        )
        result = agent(retry_prompt)
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
