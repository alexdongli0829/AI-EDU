// Signal extraction hook — extracts educational signals from conversations
// to feed into memory and analytics.

import type {
  HookCallback,
  HookCallbackMatcher,
  HookJSONOutput,
} from "@anthropic-ai/claude-agent-sdk";

export interface EducationalSignal {
  type:
    | "topic_discussed"
    | "skill_mentioned"
    | "concern_raised"
    | "recommendation_given"
    | "understanding_demonstrated"
    | "confusion_detected"
    | "language_preference";
  value: string;
  confidence: number;
  timestamp: string;
}

// Subject / skill detection keywords
const SKILL_PATTERNS: Record<string, string[]> = {
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
};

// Concern indicators
const CONCERN_KEYWORDS = [
  "worried",
  "concerned",
  "struggling",
  "falling behind",
  "not improving",
  "frustrated",
  "doesn't like",
  "hates",
  "refuses",
  "won't study",
  "giving up",
];

export function extractSignals(text: string): EducationalSignal[] {
  const signals: EducationalSignal[] = [];
  const lower = text.toLowerCase();
  const now = new Date().toISOString();

  // Extract skill mentions
  for (const [skill, keywords] of Object.entries(SKILL_PATTERNS)) {
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        signals.push({
          type: "skill_mentioned",
          value: skill,
          confidence: 0.8,
          timestamp: now,
        });
        break; // one signal per skill
      }
    }
  }

  // Detect parent concerns
  for (const kw of CONCERN_KEYWORDS) {
    if (lower.includes(kw)) {
      signals.push({
        type: "concern_raised",
        value: kw,
        confidence: 0.75,
        timestamp: now,
      });
    }
  }

  // Detect language preference
  const hasChinese = /[\u4e00-\u9fff]/.test(text);
  if (hasChinese) {
    signals.push({
      type: "language_preference",
      value: "chinese",
      confidence: 0.95,
      timestamp: now,
    });
  }

  // Detect student understanding indicators (for tutor sessions)
  if (
    lower.includes("i get it") ||
    lower.includes("oh i see") ||
    lower.includes("makes sense") ||
    lower.includes("i understand")
  ) {
    signals.push({
      type: "understanding_demonstrated",
      value: "self_reported",
      confidence: 0.7,
      timestamp: now,
    });
  }

  // Detect confusion
  if (
    lower.includes("i don't understand") ||
    lower.includes("i don't get it") ||
    lower.includes("confused") ||
    lower.includes("i don't know") ||
    lower.includes("what do you mean")
  ) {
    signals.push({
      type: "confusion_detected",
      value: "self_reported",
      confidence: 0.8,
      timestamp: now,
    });
  }

  return signals;
}

// Hook callback — runs on PostToolUse to extract signals from conversation flow
const signalExtractionCallback: HookCallback = async (input): Promise<HookJSONOutput> => {
  if (input.hook_event_name !== "PostToolUse") {
    return {};
  }

  const hookInput = input as typeof input & {
    tool_name?: string;
    tool_response?: unknown;
  };

  const response = hookInput.tool_response;
  if (typeof response !== "string") {
    return {};
  }

  const signals = extractSignals(response);
  if (signals.length > 0) {
    // Log extracted signals (in production, these would be sent to analytics)
    console.log(
      `[signal-extraction] Extracted ${signals.length} signals:`,
      signals.map((s) => `${s.type}:${s.value}`).join(", "),
    );
  }

  return {};
};

export const signalExtractionMatcher: HookCallbackMatcher = {
  hooks: [signalExtractionCallback],
  timeout: 5,
};
