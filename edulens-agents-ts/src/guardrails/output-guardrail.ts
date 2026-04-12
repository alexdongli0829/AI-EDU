/**
 * Output guardrails — validates agent responses to catch:
 * 1. Prediction language ("will definitely pass", "guaranteed")
 * 2. Comparison language ("better than other students", "top 10%")
 * 3. Sibling comparison language
 * 4. Medical/psychological advice
 * 5. Student ID exposure (internal IDs leaking to user-facing text)
 */

import { OutputViolation } from '../shared/types.js';

const PREDICTION_PATTERNS = [
  /will (definitely|certainly|surely) (pass|get in|be accepted|make it)/i,
  /guaranteed/i,
  /100% (chance|certain|sure)/i,
  /no doubt (she|he|they) will/i,
  /i('m| am) (certain|sure|confident) (she|he|they) will (pass|get in)/i,
  /predict (she|he|they) will/i,
  /will (pass|get in|be selected)/i,
  /chances are (very )?(high|good|excellent)/i,
  /almost certain to/i,
];

const COMPARISON_PATTERNS = [
  /better than (other|most|many) students/i,
  /top \d+%/i,
  /above average/i,
  /below average/i,
  /ranks? (higher|lower|above|below)/i,
  /compared to (other|her|his) (peers|classmates|students)/i,
  /percentile/i,
  /outperform/i,
  /behind (other|her|his) (peers|classmates)/i,
];

const SIBLING_COMPARISON_PATTERNS = [
  /(\w+) (scored|did|performed|is doing) (better|worse|higher|lower) than (\w+)/i,
  /(brother|sister|sibling) (scored|did|performed|is) (better|worse|higher|lower)/i,
  /unlike (your|his|her) (brother|sister|sibling)/i,
  /not as (good|strong|advanced) as (his|her) (brother|sister|sibling)/i,
  /compared to (his|her) (brother|sister|sibling)/i,
];

const MEDICAL_PATTERNS = [
  /should (see|consult|visit) a (doctor|therapist|psychologist|psychiatrist)/i,
  /i (recommend|suggest) (therapy|counseling|medication)/i,
  /sounds like (adhd|autism|dyslexia|anxiety|depression)/i,
  /may have (adhd|autism|dyslexia|a learning disability)/i,
  /symptoms of/i,
  /diagnos/i,
];

// Matches internal student/family IDs that should never appear in user-facing text
const STUDENT_ID_PATTERNS = [
  /\bstu_[a-zA-Z0-9]+\b/,
  /\bstudent_id\s*[=:]\s*["']?[a-zA-Z0-9_-]+["']?/i,
  /\bfamily_[a-zA-Z0-9]+\b/,
  /\bfam_[a-zA-Z0-9]+\b/,
];

export function checkOutputGuardrails(text: string): OutputViolation[] {
  const violations: OutputViolation[] = [];

  for (const pattern of PREDICTION_PATTERNS) {
    const match = pattern.exec(text);
    if (match) {
      violations.push({
        type: 'prediction',
        pattern: match[0],
        message: 'Response contains prediction language. Do not make predictions about exam outcomes or admissions.',
      });
    }
  }

  for (const pattern of COMPARISON_PATTERNS) {
    const match = pattern.exec(text);
    if (match) {
      violations.push({
        type: 'comparison',
        pattern: match[0],
        message: 'Response contains comparison language. Do not compare the student to other students or benchmarks.',
      });
    }
  }

  for (const pattern of SIBLING_COMPARISON_PATTERNS) {
    const match = pattern.exec(text);
    if (match) {
      violations.push({
        type: 'sibling_comparison',
        pattern: match[0],
        message: 'Response compares siblings. Never compare children within a family — discuss each child\'s progress individually.',
      });
    }
  }

  for (const pattern of MEDICAL_PATTERNS) {
    const match = pattern.exec(text);
    if (match) {
      violations.push({
        type: 'medical_advice',
        pattern: match[0],
        message: 'Response contains medical/psychological advice. Do not provide medical or psychological guidance.',
      });
    }
  }

  for (const pattern of STUDENT_ID_PATTERNS) {
    const match = pattern.exec(text);
    if (match) {
      violations.push({
        type: 'student_id_exposure',
        pattern: match[0],
        message: 'Response exposes an internal student or family ID. Never show IDs to users — use names only.',
      });
    }
  }

  return violations;
}