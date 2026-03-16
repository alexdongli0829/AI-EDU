"""Output guardrails — validates agent responses to catch:
1. Prediction language ("will definitely pass", "guaranteed")
2. Comparison language ("better than other students", "top 10%")
3. Medical/psychological advice"""

import re
from dataclasses import dataclass
from typing import List

PREDICTION_PATTERNS = [
    re.compile(r"will (definitely|certainly|surely) (pass|get in|be accepted|make it)", re.IGNORECASE),
    re.compile(r"guaranteed", re.IGNORECASE),
    re.compile(r"100% (chance|certain|sure)", re.IGNORECASE),
    re.compile(r"no doubt (she|he|they) will", re.IGNORECASE),
    re.compile(r"i('m| am) (certain|sure|confident) (she|he|they) will (pass|get in)", re.IGNORECASE),
    re.compile(r"predict (she|he|they) will", re.IGNORECASE),
    re.compile(r"will (pass|get in|be selected)", re.IGNORECASE),
    re.compile(r"chances are (very )?(high|good|excellent)", re.IGNORECASE),
    re.compile(r"almost certain to", re.IGNORECASE),
]

COMPARISON_PATTERNS = [
    re.compile(r"better than (other|most|many) students", re.IGNORECASE),
    re.compile(r"top \d+%", re.IGNORECASE),
    re.compile(r"above average", re.IGNORECASE),
    re.compile(r"below average", re.IGNORECASE),
    re.compile(r"ranks? (higher|lower|above|below)", re.IGNORECASE),
    re.compile(r"compared to (other|her|his) (peers|classmates|students)", re.IGNORECASE),
    re.compile(r"percentile", re.IGNORECASE),
    re.compile(r"outperform", re.IGNORECASE),
    re.compile(r"behind (other|her|his) (peers|classmates)", re.IGNORECASE),
]

MEDICAL_PATTERNS = [
    re.compile(r"should (see|consult|visit) a (doctor|therapist|psychologist|psychiatrist)", re.IGNORECASE),
    re.compile(r"i (recommend|suggest) (therapy|counseling|medication)", re.IGNORECASE),
    re.compile(r"sounds like (adhd|autism|dyslexia|anxiety|depression)", re.IGNORECASE),
    re.compile(r"may have (adhd|autism|dyslexia|a learning disability)", re.IGNORECASE),
    re.compile(r"symptoms of", re.IGNORECASE),
    re.compile(r"diagnos", re.IGNORECASE),
]


@dataclass
class OutputViolation:
    type: str  # "prediction", "comparison", "medical_advice"
    pattern: str
    message: str


def check_output_guardrails(text: str) -> List[OutputViolation]:
    """Check agent output text for guardrail violations."""
    violations = []

    for pattern in PREDICTION_PATTERNS:
        match = pattern.search(text)
        if match:
            violations.append(OutputViolation(
                type="prediction",
                pattern=match.group(0),
                message="Response contains prediction language. Do not make predictions about exam outcomes or admissions.",
            ))

    for pattern in COMPARISON_PATTERNS:
        match = pattern.search(text)
        if match:
            violations.append(OutputViolation(
                type="comparison",
                pattern=match.group(0),
                message="Response contains comparison language. Do not compare the student to other students or benchmarks.",
            ))

    for pattern in MEDICAL_PATTERNS:
        match = pattern.search(text)
        if match:
            violations.append(OutputViolation(
                type="medical_advice",
                pattern=match.group(0),
                message="Response contains medical/psychological advice. Do not provide medical or psychological guidance.",
            ))

    return violations
