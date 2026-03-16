// Input validation guardrail hook (UserPromptSubmit)
// Runs before the user's message is sent to the LLM.

import type {
  HookCallback,
  HookCallbackMatcher,
  HookJSONOutput,
  SyncHookJSONOutput,
} from "@anthropic-ai/claude-agent-sdk";

// Medical / psychological keywords that should trigger a redirect
const MEDICAL_KEYWORDS = [
  "adhd",
  "autism",
  "dyslexia",
  "anxiety",
  "depression",
  "medication",
  "therapy",
  "therapist",
  "psychiatrist",
  "psychologist",
  "diagnosis",
  "disorder",
  "behavioral issue",
  "behavioural issue",
  "mental health",
  "special needs",
  "learning disability",
];

// Inappropriate content patterns
const INAPPROPRIATE_PATTERNS = [
  /\b(fuck|shit|damn|ass|bitch|bastard)\b/i,
  /\b(kill|hurt|abuse|violence)\b/i,
  /\b(sex|porn|nude|naked)\b/i,
];

// Educational topic indicators
const EDUCATIONAL_KEYWORDS = [
  "test",
  "score",
  "math",
  "reading",
  "thinking",
  "practice",
  "study",
  "learn",
  "exam",
  "question",
  "homework",
  "school",
  "grade",
  "skill",
  "mastery",
  "tutor",
  "performance",
  "improve",
  "weakness",
  "strength",
  "subject",
  "pattern",
  "vocabulary",
  "inference",
  "geometry",
  "fraction",
  "spatial",
  "oc",
  "selective",
  "mia",
  "result",
  "time",
  "speed",
  "error",
  "mistake",
  "focus",
  "prepare",
  "preparation",
  "rushing",
  "stamina",
  "progress",
  "how is",
  "how are",
  "what should",
  "report",
  "analyse",
  "analyze",
  "chinese",
  "她", "他", "数学", "成绩", "考试", "学习", "练习", "阅读",
];

const MAX_MESSAGE_LENGTH = 2000;

export function checkInputGuardrails(message: string): {
  blocked: boolean;
  reason?: string;
  redirectMessage?: string;
} {
  const lower = message.toLowerCase();

  // Rule 1: Medical keywords → redirect to professional
  for (const keyword of MEDICAL_KEYWORDS) {
    if (lower.includes(keyword)) {
      return {
        blocked: true,
        reason: "medical_redirect",
        redirectMessage:
          "I appreciate you sharing that concern. Questions about " +
          `${keyword.toUpperCase()} and similar topics are best addressed by ` +
          "a qualified healthcare or educational psychology professional. " +
          "I'm here to help with academic performance, test preparation, " +
          "and learning strategies. Is there anything about your child's " +
          "academic progress I can help with?",
      };
    }
  }

  // Rule 2: Inappropriate content → block
  for (const pattern of INAPPROPRIATE_PATTERNS) {
    if (pattern.test(message)) {
      return {
        blocked: true,
        reason: "inappropriate_content",
        redirectMessage:
          "I'm here to help with educational topics. " +
          "Could you please rephrase your question?",
      };
    }
  }

  // Rule 3: Message too long → ask to shorten
  if (message.length > MAX_MESSAGE_LENGTH) {
    return {
      blocked: true,
      reason: "message_too_long",
      redirectMessage:
        `Your message is ${message.length} characters long. ` +
        `Please shorten it to under ${MAX_MESSAGE_LENGTH} characters ` +
        "so I can give you a focused response.",
    };
  }

  // Rule 4: Off-topic detection (only for messages with 3+ words)
  const words = message.trim().split(/\s+/);
  if (words.length >= 3) {
    const hasEducationalKeyword = EDUCATIONAL_KEYWORDS.some((kw) =>
      lower.includes(kw),
    );
    if (!hasEducationalKeyword) {
      return {
        blocked: true,
        reason: "off_topic",
        redirectMessage:
          "I'm an educational advisor focused on your child's learning " +
          "progress and test preparation. Could you ask me something about " +
          "their academic performance, test results, or study strategies?",
      };
    }
  }

  return { blocked: false };
}

// Hook callback for the Agent SDK hooks system
const inputGuardrailCallback: HookCallback = async (input): Promise<HookJSONOutput> => {
  // UserPromptSubmit hook receives the user's message
  if (input.hook_event_name !== "UserPromptSubmit") {
    return {};
  }

  const hookInput = input as typeof input & { user_prompt?: string };
  const userMessage = hookInput.user_prompt ?? "";

  const result = checkInputGuardrails(userMessage);

  if (result.blocked) {
    const output: SyncHookJSONOutput = {
      decision: "block",
      ...(result.reason ? { reason: result.reason } : {}),
      ...(result.redirectMessage
        ? {
            hookSpecificOutput: {
              hookEventName: "UserPromptSubmit" as const,
              additionalContext: result.redirectMessage,
            },
          }
        : {}),
    };
    return output;
  }

  return {};
};

export const inputGuardrailMatcher: HookCallbackMatcher = {
  hooks: [inputGuardrailCallback],
  timeout: 5,
};
