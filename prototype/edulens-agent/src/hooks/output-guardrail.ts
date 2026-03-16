// Output validation guardrail hook (PostToolUse)
// Validates agent responses after generation to catch:
// 1. Prediction language ("will definitely pass", "guaranteed")
// 2. Comparison language ("better than other students", "top 10%")
// 3. Medical/psychological advice

import type {
  HookCallback,
  HookCallbackMatcher,
  HookJSONOutput,
} from "@anthropic-ai/claude-agent-sdk";

// Prediction patterns that should be flagged
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

// Comparison patterns
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

// Medical/psychological advice patterns
const MEDICAL_PATTERNS = [
  /should (see|consult|visit) a (doctor|therapist|psychologist|psychiatrist)/i,
  /i (recommend|suggest) (therapy|counseling|medication)/i,
  /sounds like (adhd|autism|dyslexia|anxiety|depression)/i,
  /may have (adhd|autism|dyslexia|a learning disability)/i,
  /symptoms of/i,
  /diagnos/i,
];

export type OutputViolation = {
  type: "prediction" | "comparison" | "medical_advice";
  pattern: string;
  message: string;
};

export function checkOutputGuardrails(text: string): OutputViolation[] {
  const violations: OutputViolation[] = [];

  for (const pattern of PREDICTION_PATTERNS) {
    const match = pattern.exec(text);
    if (match) {
      violations.push({
        type: "prediction",
        pattern: match[0],
        message:
          "Response contains prediction language. " +
          "Do not make predictions about exam outcomes or admissions.",
      });
    }
  }

  for (const pattern of COMPARISON_PATTERNS) {
    const match = pattern.exec(text);
    if (match) {
      violations.push({
        type: "comparison",
        pattern: match[0],
        message:
          "Response contains comparison language. " +
          "Do not compare the student to other students or benchmarks.",
      });
    }
  }

  for (const pattern of MEDICAL_PATTERNS) {
    const match = pattern.exec(text);
    if (match) {
      violations.push({
        type: "medical_advice",
        pattern: match[0],
        message:
          "Response contains medical/psychological advice. " +
          "Do not provide medical or psychological guidance.",
      });
    }
  }

  return violations;
}

// Hook callback for the Agent SDK PostToolUse hooks system
// This is used to monitor agent text outputs after each tool use
const outputGuardrailCallback: HookCallback = async (input): Promise<HookJSONOutput> => {
  if (input.hook_event_name !== "PostToolUse") {
    return {};
  }

  const hookInput = input as typeof input & { tool_response?: unknown };
  const response = hookInput.tool_response;

  // Only check text-based tool responses
  if (typeof response !== "string") {
    return {};
  }

  const violations = checkOutputGuardrails(response);

  if (violations.length > 0) {
    const violationSummary = violations
      .map((v) => `[${v.type}] ${v.message}`)
      .join("; ");

    return {
      hookSpecificOutput: {
        hookEventName: "PostToolUse" as const,
        additionalContext:
          `OUTPUT GUARDRAIL VIOLATION DETECTED: ${violationSummary}. ` +
          "Please regenerate your response without the flagged content.",
      },
    };
  }

  return {};
};

export const outputGuardrailMatcher: HookCallbackMatcher = {
  hooks: [outputGuardrailCallback],
  timeout: 5,
};
