/**
 * Mock data for EduLens Agent prototype — no real DB connections yet.
 * Replace with real Aurora queries in integration phase.
 */

import { StudentData, QuestionData, MemoryRecord } from '../shared/types.js';

export const MOCK_STUDENT: StudentData = {
  studentId: "mock-student-001",
  name: "Mia",
  gradeLevel: 4,
  overallMastery: 0.68,
  strengths: ["reading.inference", "reading.vocabulary"],
  weaknesses: ["math.number_patterns", "thinking.spatial"],
  testHistory: [
    {
      title: "OC Practice Test 5",
      date: "2026-03-10",
      score: 72,
      correct: 25,
      total: 35,
    },
    {
      title: "OC Practice Test 4",
      date: "2026-03-03",
      score: 68,
      correct: 24,
      total: 35,
    },
    {
      title: "OC Practice Test 3",
      date: "2026-02-24",
      score: 65,
      correct: 23,
      total: 35,
    },
  ],
  skillBreakdown: {
    reading: {
      inference: 0.82,
      vocabulary: 0.78,
      main_idea: 0.65,
      detail: 0.70,
    },
    math: {
      number_patterns: 0.45,
      fractions: 0.55,
      word_problems: 0.60,
      geometry: 0.50,
    },
    thinking: {
      spatial: 0.40,
      analogies: 0.55,
      logic: 0.62,
    },
  },
  timeBehavior: {
    avgTimePerQuestion: 48,
    rushingIndicator: 0.35,
    staminaCurve: "accuracy drops 20% in last 10 questions",
    fastAnswers: 8,
  },
  errorPatterns: [
    { type: "careless_error", frequency: 12, severity: "medium" },
    { type: "time_pressure", frequency: 8, severity: "high" },
    { type: "concept_gap", frequency: 5, severity: "high" },
    { type: "misread_question", frequency: 3, severity: "low" },
  ],
};

export const MOCK_QUESTION: QuestionData = {
  questionId: "mock-q-001",
  text: "If the pattern continues: 2, 6, 18, 54, ?, what is the next number?",
  options: [
    { label: "A", text: "108", isCorrect: false },
    { label: "B", text: "162", isCorrect: true },
    { label: "C", text: "148", isCorrect: false },
    { label: "D", text: "216", isCorrect: false },
  ],
  correctAnswer: "B",
  explanation: "Each number is multiplied by 3: 2×3=6, 6×3=18, 18×3=54, 54×3=162",
  skillTags: ["math.number_patterns"],
  difficulty: "medium",
  estimatedTime: 45,
  studentAnswer: "A",
  studentTimeSpent: 18,
};

// Seed memory records for mock retrieval
export const MOCK_MEMORY_RECORDS: MemoryRecord[] = [
  {
    content: (
      "Mia's parent asked about math performance on 2026-02-15. " +
      "Advisor noted number patterns were weakest area at 42% mastery. " +
      "Recommended daily 10-minute pattern drills."
    ),
    namespace: "parent-conversations",
    metadata: { studentId: "mock-student-001", subject: "math" },
  },
  {
    content: (
      "Mia struggled with multiplication-based patterns during tutoring " +
      "on 2026-02-20. She initially confused ×2 with ×3 patterns but " +
      "self-corrected after guided questioning."
    ),
    namespace: "tutoring-sessions",
    metadata: { studentId: "mock-student-001", skill: "number_patterns" },
  },
  {
    content: (
      "Mia showed strong reading comprehension during test 3, scoring " +
      "9/10 on inference questions. Her vocabulary skills are above " +
      "grade level."
    ),
    namespace: "parent-conversations",
    metadata: { studentId: "mock-student-001", subject: "reading" },
  },
  {
    content: (
      "Time management concern raised by parent on 2026-03-01. Mia " +
      "tends to rush through early questions and slow down at the end. " +
      "Advisor suggested pacing strategy: 1 minute per question."
    ),
    namespace: "parent-conversations",
    metadata: { studentId: "mock-student-001", topic: "time_management" },
  },
  {
    content: (
      "During spatial reasoning tutoring, Mia had difficulty rotating " +
      "shapes mentally. She benefited from drawing the rotations step " +
      "by step on paper."
    ),
    namespace: "tutoring-sessions",
    metadata: { studentId: "mock-student-001", skill: "spatial" },
  },
];