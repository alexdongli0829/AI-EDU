#!/usr/bin/env npx tsx
// Student Tutor Agent (Socratic) — uses Agent SDK query() with custom MCP tools

import { query } from "@anthropic-ai/claude-agent-sdk";
import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { createStudentTutorMcpServer } from "../tools/mcp-server.js";
import { signalExtractionMatcher } from "../hooks/signal-extraction.js";

// System prompt from the spec
const STUDENT_TUTOR_SYSTEM_PROMPT = `You are a patient, encouraging Socratic tutor for EduLens, helping a primary school student understand a question they got wrong on a NSW OC or Selective School practice test.

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

IMPORTANT: At the start of the conversation, ALWAYS call load_question_context first to understand which question the student got wrong and what their answer was. Then begin your Socratic guidance.`;

// ---------------------------------------------------------------------------
// Run a single student tutor conversation turn
// ---------------------------------------------------------------------------
export async function runStudentTutor(userMessage: string): Promise<string> {
  const conversation = query({
    prompt: userMessage,
    options: {
      systemPrompt: STUDENT_TUTOR_SYSTEM_PROMPT,
      model: "sonnet",
      maxTurns: 10,
      permissionMode: "bypassPermissions",
      mcpServers: {
        "edulens-tutor-tools": createStudentTutorMcpServer(),
      },
      hooks: {
        PostToolUse: [signalExtractionMatcher],
      },
      allowedTools: [
        "mcp__edulens-tutor-tools__load_question_context",
        "mcp__edulens-tutor-tools__query_student_level",
        "mcp__edulens-tutor-tools__retrieve_memories",
        "mcp__edulens-tutor-tools__record_understanding",
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
  const userMessage = process.argv[2] ?? "I don't know how to solve this.";

  console.log("=== EduLens Student Tutor (Socratic) ===\n");
  console.log(`Student: ${userMessage}\n`);

  try {
    const response = await runStudentTutor(userMessage);
    console.log(`Tutor: ${response}\n`);
  } catch (error) {
    console.error("Error running student tutor:", error);
    process.exit(1);
  }
}

// Run if executed directly
const isDirectRun = process.argv[1]?.includes("student-tutor");
if (isDirectRun) {
  main();
}
