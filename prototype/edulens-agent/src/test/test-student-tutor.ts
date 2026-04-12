#!/usr/bin/env npx tsx
// Test script for Student Tutor agent — runs all spec scenarios

import { runStudentTutor } from "../agents/student-tutor.js";
import { extractSignals } from "../hooks/signal-extraction.js";

interface TestCase {
  id: number;
  description: string;
  input: string;
  expectedBehavior: string;
}

const TEST_CASES: TestCase[] = [
  {
    id: 1,
    description: "Student says they don't know",
    input: "I don't know how to solve this.",
    expectedBehavior:
      "Should give a minimal hint about the pattern (look at how numbers change)",
  },
  {
    id: 2,
    description: "Student guesses 108 (wrong — that would be ×2)",
    input: "Is the answer 108?",
    expectedBehavior:
      "Should guide without revealing answer. May ask what operation turns 2 into 6.",
  },
  {
    id: 3,
    description: "Student thinks it doubles",
    input: "Each number doubles, right? So 54 times 2 is 108.",
    expectedBehavior:
      "Should redirect thinking — check if 2×2=6? It's ×3, not ×2.",
  },
  {
    id: 4,
    description: "Student tries to go off-topic",
    input: "Can we talk about something else? I'm bored of this question.",
    expectedBehavior:
      'Should redirect: "Let\'s focus on this question first!"',
  },
  {
    id: 5,
    description: "Student gets it right after hints",
    input: "Oh wait, each number is multiplied by 3! So 54 × 3 = 162. The answer is B!",
    expectedBehavior:
      "Should celebrate and explain why it's right.",
  },
];

// ---------------------------------------------------------------------------
// Signal extraction unit tests (fast, no agent call)
// ---------------------------------------------------------------------------
function runSignalTests(): void {
  console.log("━".repeat(60));
  console.log("SIGNAL EXTRACTION UNIT TESTS");
  console.log("━".repeat(60));

  let passed = 0;
  let failed = 0;

  const signalTests: Array<{
    input: string;
    expectedTypes: string[];
  }> = [
    {
      input: "I don't understand the number pattern question",
      expectedTypes: ["confusion_detected", "skill_mentioned"],
    },
    {
      input: "Oh I see! Each number is multiplied by 3!",
      expectedTypes: ["understanding_demonstrated"],
    },
    {
      input: "I'm worried she's falling behind in math",
      expectedTypes: ["concern_raised", "skill_mentioned"],
    },
    {
      input: "她数学成绩怎么样",
      expectedTypes: ["language_preference"],
    },
    {
      input: "What about her vocabulary skills?",
      expectedTypes: ["skill_mentioned"],
    },
  ];

  for (const test of signalTests) {
    const signals = extractSignals(test.input);
    const foundTypes = signals.map((s) => s.type);
    const allFound = test.expectedTypes.every((t) => foundTypes.includes(t as typeof foundTypes[number]));

    if (allFound) {
      console.log(
        `  ✓ "${test.input.slice(0, 50)}" → [${foundTypes.join(", ")}]`,
      );
      passed++;
    } else {
      console.log(
        `  ✗ "${test.input.slice(0, 50)}" → expected [${test.expectedTypes.join(", ")}], got [${foundTypes.join(", ")}]`,
      );
      failed++;
    }
  }

  console.log(`\nSignal tests: ${passed} passed, ${failed} failed\n`);
}

// ---------------------------------------------------------------------------
// Agent integration tests (calls the real agent via SDK)
// ---------------------------------------------------------------------------
async function runAgentTests(): Promise<void> {
  console.log("━".repeat(60));
  console.log("AGENT INTEGRATION TESTS (Student Tutor)");
  console.log("━".repeat(60));
  console.log("Note: These tests call the Claude Agent SDK and require");
  console.log("CLAUDE_CODE_USE_BEDROCK=1 or a valid API key.\n");

  for (const test of TEST_CASES) {
    console.log(`─── Test ${test.id}: ${test.description} ───`);
    console.log(`Input: "${test.input}"`);
    console.log(`Expected: ${test.expectedBehavior}`);

    try {
      const response = await runStudentTutor(test.input);
      console.log(`Response: ${response.slice(0, 500)}${response.length > 500 ? "..." : ""}`);

      // Basic checks for Socratic behavior
      if (test.id <= 3) {
        // Should NOT contain the direct answer "162" or "B" in early exchanges
        const revealsAnswer =
          response.includes("162") && response.includes("answer is");
        if (revealsAnswer) {
          console.log(
            "WARN: Tutor may have revealed the answer directly (Socratic violation)",
          );
        }
      }

      if (test.id === 4) {
        const redirects =
          response.toLowerCase().includes("focus") ||
          response.toLowerCase().includes("this question");
        console.log(
          `Redirect check: ${redirects ? "PASS (redirected to question)" : "WARN (may not have redirected)"}`,
        );
      }

      if (test.id === 5) {
        const celebrates =
          response.includes("!") ||
          response.toLowerCase().includes("great") ||
          response.toLowerCase().includes("correct") ||
          response.toLowerCase().includes("right") ||
          response.toLowerCase().includes("well done") ||
          response.toLowerCase().includes("nice");
        console.log(
          `Celebration check: ${celebrates ? "PASS (celebrated)" : "WARN (expected celebration)"}`,
        );
      }
    } catch (error) {
      console.log(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }

    console.log("");
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  const mode = process.argv[2] ?? "signals";

  console.log("╔════════════════════════════════════════════════════════╗");
  console.log("║        EduLens Student Tutor — Test Suite             ║");
  console.log("╚════════════════════════════════════════════════════════╝\n");

  if (mode === "signals" || mode === "all") {
    runSignalTests();
  }

  if (mode === "agent" || mode === "all") {
    await runAgentTests();
  }

  if (mode !== "signals" && mode !== "agent" && mode !== "all") {
    console.log("Usage: npx tsx src/test/test-student-tutor.ts [signals|agent|all]");
    console.log("  signals — Run fast signal extraction unit tests (default)");
    console.log("  agent   — Run agent integration tests (requires API key)");
    console.log("  all     — Run both");
  }
}

main().catch(console.error);
