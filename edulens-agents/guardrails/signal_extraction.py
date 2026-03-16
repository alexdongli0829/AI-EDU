"""Signal extraction — extracts educational signals from conversations for analytics and memory."""

import re
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import List

SKILL_PATTERNS = {
    "math": ["math", "maths", "mathematics", "arithmetic"],
    "math.number_patterns": ["number pattern", "pattern", "sequence", "multiply"],
    "math.fractions": ["fraction", "numerator", "denominator", "half", "quarter"],
    "math.geometry": ["geometry", "shape", "angle", "triangle", "rectangle"],
    "math.word_problems": ["word problem", "story problem"],
    "reading": ["reading", "comprehension", "passage"],
    "reading.inference": ["inference", "infer", "implies", "suggest"],
    "reading.vocabulary": ["vocabulary", "word meaning", "definition"],
    "reading.main_idea": ["main idea", "theme", "central"],
    "thinking": ["thinking skills", "general ability"],
    "thinking.spatial": ["spatial", "rotation", "flip", "mirror"],
    "thinking.analogies": ["analogy", "analogies", "is to"],
    "thinking.logic": ["logic", "logical", "reasoning"],
}

CONCERN_KEYWORDS = [
    "worried", "concerned", "struggling", "falling behind", "not improving",
    "frustrated", "doesn't like", "hates", "refuses", "won't study", "giving up",
]


@dataclass
class EducationalSignal:
    type: str  # topic_discussed, skill_mentioned, concern_raised, etc.
    value: str
    confidence: float
    timestamp: str


def extract_signals(text: str) -> List[EducationalSignal]:
    """Extract educational signals from conversation text."""
    signals = []
    lower = text.lower()
    now = datetime.now(timezone.utc).isoformat()

    # Extract skill mentions
    for skill, keywords in SKILL_PATTERNS.items():
        for kw in keywords:
            if kw in lower:
                signals.append(EducationalSignal(
                    type="skill_mentioned",
                    value=skill,
                    confidence=0.8,
                    timestamp=now,
                ))
                break  # one signal per skill

    # Detect parent concerns
    for kw in CONCERN_KEYWORDS:
        if kw in lower:
            signals.append(EducationalSignal(
                type="concern_raised",
                value=kw,
                confidence=0.75,
                timestamp=now,
            ))

    # Detect language preference (Chinese)
    if re.search(r"[\u4e00-\u9fff]", text):
        signals.append(EducationalSignal(
            type="language_preference",
            value="chinese",
            confidence=0.95,
            timestamp=now,
        ))

    # Detect student understanding indicators
    understanding_phrases = ["i get it", "oh i see", "makes sense", "i understand"]
    if any(phrase in lower for phrase in understanding_phrases):
        signals.append(EducationalSignal(
            type="understanding_demonstrated",
            value="self_reported",
            confidence=0.7,
            timestamp=now,
        ))

    # Detect confusion
    confusion_phrases = ["i don't understand", "i don't get it", "confused", "i don't know", "what do you mean"]
    if any(phrase in lower for phrase in confusion_phrases):
        signals.append(EducationalSignal(
            type="confusion_detected",
            value="self_reported",
            confidence=0.8,
            timestamp=now,
        ))

    return signals
