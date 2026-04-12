"""Input guardrails — validates user messages before sending to the agent.
Blocks medical/psychological content, inappropriate language, off-topic, and overly long messages."""

import re
from typing import Optional

# Medical / psychological keywords that should trigger a redirect
MEDICAL_KEYWORDS = [
    "adhd", "autism", "dyslexia", "anxiety", "depression", "medication",
    "therapy", "therapist", "psychiatrist", "psychologist", "diagnosis",
    "disorder", "behavioral issue", "behavioural issue", "mental health",
    "special needs", "learning disability",
]

# Inappropriate content patterns (use word-start boundary to catch inflections like "fucking")
INAPPROPRIATE_PATTERNS = [
    re.compile(r"\b(fuck|shit|damn|ass|bitch|bastard)", re.IGNORECASE),
    re.compile(r"\b(kill|hurt|abuse|violence)\b", re.IGNORECASE),
    re.compile(r"\b(sex|porn|nude|naked)\b", re.IGNORECASE),
]

# Educational topic indicators
EDUCATIONAL_KEYWORDS = [
    "test", "score", "math", "reading", "thinking", "practice", "study",
    "learn", "exam", "question", "homework", "school", "grade", "skill",
    "mastery", "tutor", "performance", "improve", "weakness", "strength",
    "subject", "pattern", "vocabulary", "inference", "geometry", "fraction",
    "spatial", "oc", "selective", "mia", "result", "time", "speed", "error",
    "mistake", "focus", "prepare", "preparation", "rushing", "stamina",
    "progress", "how is", "how are", "what should", "report", "analyse",
    "analyze", "chinese",
    "她", "他", "数学", "成绩", "考试", "学习", "练习", "阅读",
]

MAX_MESSAGE_LENGTH = 2000


class GuardrailResult:
    """Result of a guardrail check."""

    def __init__(self, blocked: bool, reason: Optional[str] = None, redirect_message: Optional[str] = None):
        self.blocked = blocked
        self.reason = reason
        self.redirect_message = redirect_message


def check_input_guardrails(message: str) -> GuardrailResult:
    """Run all input guardrail checks on a user message."""
    lower = message.lower()

    # Rule 1: Medical keywords → redirect to professional
    for keyword in MEDICAL_KEYWORDS:
        if keyword in lower:
            return GuardrailResult(
                blocked=True,
                reason="medical_redirect",
                redirect_message=(
                    f"I appreciate you sharing that concern. Questions about "
                    f"{keyword.upper()} and similar topics are best addressed by "
                    f"a qualified healthcare or educational psychology professional. "
                    f"I'm here to help with academic performance, test preparation, "
                    f"and learning strategies. Is there anything about your child's "
                    f"academic progress I can help with?"
                ),
            )

    # Rule 2: Inappropriate content → block
    for pattern in INAPPROPRIATE_PATTERNS:
        if pattern.search(message):
            return GuardrailResult(
                blocked=True,
                reason="inappropriate_content",
                redirect_message="I'm here to help with educational topics. Could you please rephrase your question?",
            )

    # Rule 3: Message too long → ask to shorten
    if len(message) > MAX_MESSAGE_LENGTH:
        return GuardrailResult(
            blocked=True,
            reason="message_too_long",
            redirect_message=(
                f"Your message is {len(message)} characters long. "
                f"Please shorten it to under {MAX_MESSAGE_LENGTH} characters "
                f"so I can give you a focused response."
            ),
        )

    # Rule 4: Off-topic detection (only for messages with 3+ words)
    words = message.strip().split()
    if len(words) >= 3:
        has_educational = any(kw in lower for kw in EDUCATIONAL_KEYWORDS)
        if not has_educational:
            return GuardrailResult(
                blocked=True,
                reason="off_topic",
                redirect_message=(
                    "I'm an educational advisor focused on your child's learning "
                    "progress and test preparation. Could you ask me something about "
                    "their academic performance, test results, or study strategies?"
                ),
            )

    return GuardrailResult(blocked=False)
