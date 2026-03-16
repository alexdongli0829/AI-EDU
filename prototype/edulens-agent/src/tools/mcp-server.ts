// Custom MCP server with all EduLens tools
// Uses the Agent SDK's tool() + createSdkMcpServer() pattern

import { z } from "zod/v4";
import {
  tool,
  createSdkMcpServer,
} from "@anthropic-ai/claude-agent-sdk";
import {
  MOCK_STUDENT,
  MOCK_QUESTION,
} from "./mock-data.js";
import { AgentCoreMemory } from "../memory/agentcore-memory.js";

// Shared memory instance
const memory = new AgentCoreMemory();

// ---------------------------------------------------------------------------
// Parent Advisor tools
// ---------------------------------------------------------------------------

const queryStudentProfile = tool(
  "query_student_profile",
  "Get the student's Learning DNA overview including mastery level, strengths, weaknesses, and recent trends.",
  { studentId: z.string().describe("The student ID to look up") },
  async () => {
    const { studentId, name, gradeLevel, overallMastery, strengths, weaknesses, testHistory } =
      MOCK_STUDENT;
    const recentTrend =
      testHistory.length >= 2
        ? testHistory[0]!.score - testHistory[1]!.score > 0
          ? "improving"
          : testHistory[0]!.score === testHistory[1]!.score
            ? "stable"
            : "declining"
        : "insufficient data";

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              studentId,
              name,
              gradeLevel,
              overallMastery: `${(overallMastery * 100).toFixed(0)}%`,
              strengths,
              weaknesses,
              recentTrend,
              lastThreeTests: testHistory,
            },
            null,
            2,
          ),
        },
      ],
    };
  },
  { annotations: { readOnlyHint: true } },
);

const queryTestResults = tool(
  "query_test_results",
  "Get recent test scores and details for a student.",
  {
    studentId: z.string().describe("The student ID"),
    limit: z.number().optional().describe("Number of recent tests to return (default 5)"),
  },
  async (args) => {
    const limit = args.limit ?? 5;
    const tests = MOCK_STUDENT.testHistory.slice(0, limit);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              studentName: MOCK_STUDENT.name,
              testCount: tests.length,
              tests: tests.map((t) => ({
                ...t,
                percentage: `${t.score}%`,
                accuracy: `${t.correct}/${t.total}`,
              })),
            },
            null,
            2,
          ),
        },
      ],
    };
  },
  { annotations: { readOnlyHint: true } },
);

const querySkillBreakdown = tool(
  "query_skill_breakdown",
  "Get per-skill mastery percentages for a given subject.",
  {
    studentId: z.string().describe("The student ID"),
    subject: z
      .enum(["reading", "math", "thinking"])
      .describe("The subject to get skill breakdown for"),
  },
  async (args) => {
    const breakdown = MOCK_STUDENT.skillBreakdown[args.subject];
    const skills = Object.entries(breakdown).map(([skill, mastery]) => ({
      skill,
      mastery: `${(mastery * 100).toFixed(0)}%`,
      status:
        mastery >= 0.75
          ? "strong"
          : mastery >= 0.55
            ? "developing"
            : "needs_focus",
    }));
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              studentName: MOCK_STUDENT.name,
              subject: args.subject,
              skills,
            },
            null,
            2,
          ),
        },
      ],
    };
  },
  { annotations: { readOnlyHint: true } },
);

const queryTimeBehavior = tool(
  "query_time_behavior",
  "Get time management analysis including average time per question, rushing indicators, and stamina curve.",
  { studentId: z.string().describe("The student ID") },
  async () => {
    const tb = MOCK_STUDENT.timeBehavior;
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              studentName: MOCK_STUDENT.name,
              avgTimePerQuestion: `${tb.avgTimePerQuestion} seconds`,
              rushingIndicator: `${(tb.rushingIndicator * 100).toFixed(0)}% of answers show rushing`,
              staminaCurve: tb.staminaCurve,
              fastAnswers: `${tb.fastAnswers} questions answered in under 15 seconds`,
            },
            null,
            2,
          ),
        },
      ],
    };
  },
  { annotations: { readOnlyHint: true } },
);

const queryErrorPatterns = tool(
  "query_error_patterns",
  "Get error classification breakdown showing error types and their frequencies.",
  { studentId: z.string().describe("The student ID") },
  async () => {
    const totalErrors = MOCK_STUDENT.errorPatterns.reduce(
      (sum, e) => sum + e.frequency,
      0,
    );
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              studentName: MOCK_STUDENT.name,
              totalErrors,
              patterns: MOCK_STUDENT.errorPatterns.map((e) => ({
                type: e.type,
                count: e.frequency,
                percentage: `${((e.frequency / totalErrors) * 100).toFixed(0)}%`,
                severity: e.severity,
              })),
            },
            null,
            2,
          ),
        },
      ],
    };
  },
  { annotations: { readOnlyHint: true } },
);

// ---------------------------------------------------------------------------
// Student Tutor tools
// ---------------------------------------------------------------------------

const loadQuestionContext = tool(
  "load_question_context",
  "Load the question text, the correct answer, and the student's wrong answer for the current tutoring session.",
  { questionId: z.string().describe("The question ID to load") },
  async () => {
    const q = MOCK_QUESTION;
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              questionId: q.questionId,
              questionText: q.text,
              options: q.options.map((o) => `${o.label}. ${o.text}`),
              correctAnswer: q.correctAnswer,
              correctAnswerText: q.options.find((o) => o.isCorrect)?.text,
              explanation: q.explanation,
              studentAnswer: q.studentAnswer,
              studentAnswerText: q.options.find(
                (o) => o.label === q.studentAnswer,
              )?.text,
              studentTimeSpent: `${q.studentTimeSpent} seconds (expected ${q.estimatedTime}s)`,
              skillTags: q.skillTags,
              difficulty: q.difficulty,
            },
            null,
            2,
          ),
        },
      ],
    };
  },
  { annotations: { readOnlyHint: true } },
);

const queryStudentLevel = tool(
  "query_student_level",
  "Get the student's current overall mastery level and mastery for skills relevant to the current question.",
  { studentId: z.string().describe("The student ID") },
  async () => {
    const relevantSkills = MOCK_QUESTION.skillTags.map((tag) => {
      const [subject, skill] = tag.split(".");
      const subjectBreakdown =
        MOCK_STUDENT.skillBreakdown[subject as keyof typeof MOCK_STUDENT.skillBreakdown];
      const mastery = subjectBreakdown?.[skill ?? ""] ?? null;
      return { tag, mastery: mastery !== null ? `${(mastery * 100).toFixed(0)}%` : "unknown" };
    });

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              studentName: MOCK_STUDENT.name,
              overallMastery: `${(MOCK_STUDENT.overallMastery * 100).toFixed(0)}%`,
              relevantSkills,
            },
            null,
            2,
          ),
        },
      ],
    };
  },
  { annotations: { readOnlyHint: true } },
);

const recordUnderstanding = tool(
  "record_understanding",
  "Record whether the student demonstrated understanding of the concept during this tutoring exchange.",
  {
    studentId: z.string().describe("The student ID"),
    questionId: z.string().describe("The question ID"),
    understood: z.boolean().describe("Whether the student demonstrated understanding"),
    notes: z.string().optional().describe("Optional notes about the student's understanding"),
  },
  async (args) => {
    await memory.createEvent({
      sessionId: "tutor-session",
      actorId: "student-tutor",
      actorType: "agent",
      content: `Understanding recorded for question ${args.questionId}: ${args.understood ? "YES" : "NO"}${args.notes ? ` — ${args.notes}` : ""}`,
      metadata: {
        studentId: args.studentId,
        questionId: args.questionId,
        understood: String(args.understood),
      },
    });

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            recorded: true,
            studentId: args.studentId,
            questionId: args.questionId,
            understood: args.understood,
            notes: args.notes ?? null,
          }),
        },
      ],
    };
  },
);

// ---------------------------------------------------------------------------
// Shared tool: retrieve_memories
// ---------------------------------------------------------------------------

const retrieveMemories = tool(
  "retrieve_memories",
  "Search past conversation memories for relevant context. Returns long-term memory records matching the query.",
  {
    query: z.string().describe("Search query for memory retrieval"),
    namespace: z
      .string()
      .optional()
      .describe("Optional namespace filter (e.g. 'parent-conversations', 'tutoring-sessions')"),
    maxResults: z.number().optional().describe("Max results to return (default 5)"),
  },
  async (args) => {
    const records = await memory.retrieveMemoryRecords({
      query: args.query,
      namespace: args.namespace,
      maxResults: args.maxResults,
    });
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              query: args.query,
              resultCount: records.length,
              records: records.map((r) => ({
                content: r.content,
                relevance: r.score.toFixed(2),
                namespace: r.namespace,
              })),
            },
            null,
            2,
          ),
        },
      ],
    };
  },
  { annotations: { readOnlyHint: true } },
);

// ---------------------------------------------------------------------------
// Export MCP servers — one per agent role
// ---------------------------------------------------------------------------

export const parentAdvisorMcpServer = createSdkMcpServer({
  name: "edulens-parent-advisor-tools",
  version: "1.0.0",
  tools: [
    queryStudentProfile,
    queryTestResults,
    querySkillBreakdown,
    queryTimeBehavior,
    queryErrorPatterns,
    retrieveMemories,
  ],
});

export const studentTutorMcpServer = createSdkMcpServer({
  name: "edulens-student-tutor-tools",
  version: "1.0.0",
  tools: [
    loadQuestionContext,
    queryStudentLevel,
    retrieveMemories,
    recordUnderstanding,
  ],
});
