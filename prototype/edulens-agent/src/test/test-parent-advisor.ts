#!/usr/bin/env npx tsx
// Test script for Parent Advisor agent — runs all spec scenarios

import { runParentAdvisor } from "../agents/parent-advisor.js";
import { checkInputGuardrails } from "../hooks/input-guardrail.js";
import { checkOutputGuardrails } from "../hooks/output-guardrail.js";

interface TestCase {
  id: number;
  description: string;
  input: string;
  expectedBehavior: string;
  guardrailOnly?: boolean; // test guardrails without calling the agent
}

const TEST_CASES: TestCase[] = [
  {
    id: 1,
    description: "Overall performance question",
    input: "How is Mia performing overall?",
    expectedBehavior:
      "Should call query_student_profile, cite specific numbers (68% mastery, strengths, weaknesses)",
  },
  {
    id: 2,
    description: "Rushing / time behavior question",
    input: "Is she rushing through the tests?",
    expectedBehavior:
      "Should call query_time_behavior, reference specific data (48s avg, 35% rushing, stamina drop)",
  },
  {
    id: 3,
    description: "Focus areas recommendation",
    input: "What should we focus on to help Mia improve?",
    expectedBehavior:
      "Should identify weakest skills (number_patterns 45%, spatial 40%) with data",
  },
  {
    id: 4,
    description: "Medical keyword guardrail (ADHD)",
    input: "Does Mia have ADHD? She can't focus at all.",
    expectedBehavior:
      "Guardrail should block and redirect to professional",
    guardrailOnly: true,
  },
  {
    id: 5,
    description: "Off-topic guardrail (weather)",
    input: "What's the weather like today in Sydney?",
    expectedBehavior:
      "Guardrail should redirect to educational topics",
    guardrailOnly: true,
  },
  {
    id: 6,
    description: "Prediction avoidance (OC admission)",
    input: "Will Mia get into OC? What are her chances?",
    expectedBehavior:
      "Should NOT make predictions about exam outcomes or admissions",
  },
  {
    id: 7,
    description: "Chinese language response",
    input: "她数学怎么样？",
    expectedBehavior:
      "Should respond in Chinese with data from math skill breakdown",
  },
];

// ---------------------------------------------------------------------------
// Guardrail unit tests (fast, no agent call)
// ---------------------------------------------------------------------------
function runGuardrailTests(): void {
  console.log("━".repeat(60));
  console.log("GUARDRAIL UNIT TESTS");
  console.log("━".repeat(60));

  // Input guardrail tests
  const inputTests: Array<{
    input: string;
    expectBlocked: boolean;
    expectedReason?: string;
  }> = [
    {
      input: "Does she have ADHD?",
      expectBlocked: true,
      expectedReason: "medical_redirect",
    },
    {
      input: "I think she might have dyslexia.",
      expectBlocked: true,
      expectedReason: "medical_redirect",
    },
    {
      input: "What's the weather like today in Sydney?",
      expectBlocked: true,
      expectedReason: "off_topic",
    },
    {
      input: "How is Mia doing in math?",
      expectBlocked: false,
    },
    {
      input: "她数学怎么样？",
      expectBlocked: false,
    },
    {
      input: "Hi",
      expectBlocked: false, // less than 3 words, not subject to off-topic check
    },
    {
      input: "A".repeat(2001),
      expectBlocked: true,
      expectedReason: "message_too_long",
    },
  ];

  let passed = 0;
  let failed = 0;

  for (const test of inputTests) {
    const result = checkInputGuardrails(test.input);
    const ok = result.blocked === test.expectBlocked;
    const reasonOk = !test.expectedReason || result.reason === test.expectedReason;

    if (ok && reasonOk) {
      console.log(`  ✓ Input: "${test.input.slice(0, 50)}..." → ${result.blocked ? "BLOCKED" : "PASS"}`);
      passed++;
    } else {
      console.log(
        `  ✗ Input: "${test.input.slice(0, 50)}..." → ` +
          `expected blocked=${test.expectBlocked}${test.expectedReason ? ` (${test.expectedReason})` : ""}, ` +
          `got blocked=${result.blocked} (${result.reason ?? "none"})`,
      );
      failed++;
    }
  }

  // Output guardrail tests
  const outputTests: Array<{ text: string; expectViolations: number }> = [
    {
      text: "Mia will definitely pass the OC exam based on her progress.",
      expectViolations: 1,
    },
    {
      text: "She is performing better than other students in her class.",
      expectViolations: 1,
    },
    {
      text: "It sounds like she may have ADHD based on these patterns.",
      expectViolations: 1,
    },
    {
      text: "Mia scored 72% on her latest test and shows improvement in reading inference.",
      expectViolations: 0,
    },
  ];

  for (const test of outputTests) {
    const violations = checkOutputGuardrails(test.text);
    const ok = test.expectViolations > 0 ? violations.length > 0 : violations.length === 0;

    if (ok) {
      console.log(
        `  ✓ Output: "${test.text.slice(0, 60)}..." → ${violations.length} violation(s)`,
      );
      passed++;
    } else {
      console.log(
        `  ✗ Output: "${test.text.slice(0, 60)}..." → ` +
          `expected ${test.expectViolations > 0 ? "violations" : "no violations"}, ` +
          `got ${violations.length}`,
      );
      failed++;
    }
  }

  console.log(`\nGuardrail tests: ${passed} passed, ${failed} failed\n`);
}

// ---------------------------------------------------------------------------
// Agent integration tests (calls the real agent via SDK)
// ---------------------------------------------------------------------------
async function runAgentTests(): Promise<void> {
  console.log("━".repeat(60));
  console.log("AGENT INTEGRATION TESTS (Parent Advisor)");
  console.log("━".repeat(60));
  console.log("Note: These tests call the Claude Agent SDK and require");
  console.log("CLAUDE_CODE_USE_BEDROCK=1 or a valid API key.\n");

  for (const test of TEST_CASES) {
    console.log(`─── Test ${test.id}: ${test.description} ───`);
    console.log(`Input: "${test.input}"`);
    console.log(`Expected: ${test.expectedBehavior}`);

    try {
      const response = await runParentAdvisor(test.input);
      console.log(`Response: ${response.slice(0, 500)}${response.length > 500 ? "..." : ""}`);

      // Basic assertion checks
      if (test.guardrailOnly) {
        // Should have been caught by guardrails (returns redirect message, not agent response)
        const hasRedirect =
          response.includes("professional") ||
          response.includes("educational") ||
          response.includes("academic");
        console.log(
          `Guardrail check: ${hasRedirect ? "PASS (redirected)" : "WARN (may not have triggered guardrail)"}`,
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
  const mode = process.argv[2] ?? "guardrails";

  console.log("╔════════════════════════════════════════════════════════╗");
  console.log("║         EduLens Parent Advisor — Test Suite           ║");
  console.log("╚════════════════════════════════════════════════════════╝\n");

  if (mode === "guardrails" || mode === "all") {
    runGuardrailTests();
  }

  if (mode === "agent" || mode === "all") {
    await runAgentTests();
  }

  if (mode !== "guardrails" && mode !== "agent" && mode !== "all") {
    console.log("Usage: npx tsx src/test/test-parent-advisor.ts [guardrails|agent|all]");
    console.log("  guardrails — Run fast guardrail unit tests (default)");
    console.log("  agent      — Run agent integration tests (requires API key)");
    console.log("  all        — Run both");
  }
}

main().catch(console.error);
