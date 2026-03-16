#!/usr/bin/env npx tsx
// Parent Advisor Agent — uses Agent SDK query() with custom MCP tools and hooks

import { query } from "@anthropic-ai/claude-agent-sdk";
import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { parentAdvisorMcpServer } from "../tools/mcp-server.js";
import { inputGuardrailMatcher } from "../hooks/input-guardrail.js";
import { outputGuardrailMatcher } from "../hooks/output-guardrail.js";
import { signalExtractionMatcher } from "../hooks/signal-extraction.js";
import { checkInputGuardrails } from "../hooks/input-guardrail.js";

// System prompt from the spec
const PARENT_ADVISOR_SYSTEM_PROMPT = `You are an experienced, caring AI educational advisor for EduLens, speaking with a parent about their child's learning progress for NSW OC and Selective School exam preparation.

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
- After each response, suggest 1-2 natural follow-up questions the parent might want to ask, based on areas of the profile not yet discussed.`;

// ---------------------------------------------------------------------------
// Run a single parent advisor conversation turn
// ---------------------------------------------------------------------------
export async function runParentAdvisor(userMessage: string): Promise<string> {
  // Pre-check input guardrails before sending to agent
  const guardrailCheck = checkInputGuardrails(userMessage);
  if (guardrailCheck.blocked) {
    return guardrailCheck.redirectMessage ?? "I can only help with educational topics.";
  }

  const conversation = query({
    prompt: userMessage,
    options: {
      systemPrompt: PARENT_ADVISOR_SYSTEM_PROMPT,
      model: "sonnet",
      maxTurns: 10,
      permissionMode: "bypassPermissions",
      mcpServers: {
        "edulens-tools": parentAdvisorMcpServer,
      },
      hooks: {
        UserPromptSubmit: [inputGuardrailMatcher],
        PostToolUse: [outputGuardrailMatcher, signalExtractionMatcher],
      },
      allowedTools: [
        "mcp__edulens-tools__query_student_profile",
        "mcp__edulens-tools__query_test_results",
        "mcp__edulens-tools__query_skill_breakdown",
        "mcp__edulens-tools__query_time_behavior",
        "mcp__edulens-tools__query_error_patterns",
        "mcp__edulens-tools__retrieve_memories",
      ],
    },
  });

  let finalResult = "";

  for await (const message of conversation) {
    const msg = message as SDKMessage & { subtype?: string; result?: string };
    if (msg.type === "result" && msg.subtype === "success" && msg.result) {
      finalResult = msg.result;
    }
  }

  return finalResult;
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  const userMessage = process.argv[2];
  if (!userMessage) {
    console.log("Usage: npx tsx src/agents/parent-advisor.ts \"<message>\"");
    console.log("Example: npx tsx src/agents/parent-advisor.ts \"How is Mia performing overall?\"");
    process.exit(1);
  }

  console.log("=== EduLens Parent Advisor ===\n");
  console.log(`Parent: ${userMessage}\n`);

  try {
    const response = await runParentAdvisor(userMessage);
    console.log(`Advisor: ${response}\n`);
  } catch (error) {
    console.error("Error running parent advisor:", error);
    process.exit(1);
  }
}

// Run if executed directly
const isDirectRun = process.argv[1]?.includes("parent-advisor");
if (isDirectRun) {
  main();
}
