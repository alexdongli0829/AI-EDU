/**
 * Mock data for EduLens Agent prototype — no real DB connections yet.
 * Replace with real Aurora queries in integration phase.
 *
 * Updated: Multi-student mock data for isolation testing.
 */

import { StudentData, QuestionData, MemoryRecord } from '../shared/types.js';

// --- Student A: Mia (Year 4, OC Prep) ---
export const MOCK_STUDENT_MIA: StudentData = {
  studentId: "stu_001",
  name: "Mia",
  gradeLevel: 4,
  overallMastery: 0.68,
  strengths: ["reading.inference", "reading.vocabulary"],
  weaknesses: ["math.number_patterns", "thinking.spatial"],
  testHistory: [
    { title: "OC Practice Test 5", date: "2026-03-10", score: 72, correct: 25, total: 35 },
    { title: "OC Practice Test 4", date: "2026-03-03", score: 68, correct: 24, total: 35 },
    { title: "OC Practice Test 3", date: "2026-02-24", score: 65, correct: 23, total: 35 },
  ],
  skillBreakdown: {
    reading: { inference: 0.82, vocabulary: 0.78, main_idea: 0.65, detail: 0.70 },
    math: { number_patterns: 0.45, fractions: 0.55, word_problems: 0.60, geometry: 0.50 },
    thinking: { spatial: 0.40, analogies: 0.55, logic: 0.62 },
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

// --- Student B: Leo (Year 6, Selective Prep) ---
export const MOCK_STUDENT_LEO: StudentData = {
  studentId: "stu_002",
  name: "Leo",
  gradeLevel: 6,
  overallMastery: 0.74,
  strengths: ["math.word_problems", "thinking.logic"],
  weaknesses: ["writing.persuasive", "reading.inference"],
  testHistory: [
    { title: "Selective Practice Test 4", date: "2026-03-12", score: 76, correct: 57, total: 75 },
    { title: "Selective Practice Test 3", date: "2026-03-05", score: 72, correct: 54, total: 75 },
    { title: "Selective Practice Test 2", date: "2026-02-26", score: 70, correct: 52, total: 75 },
  ],
  skillBreakdown: {
    reading: { inference: 0.58, vocabulary: 0.72, main_idea: 0.75, detail: 0.68 },
    math: { number_patterns: 0.70, fractions: 0.78, word_problems: 0.82, geometry: 0.65 },
    thinking: { spatial: 0.68, analogies: 0.72, logic: 0.80 },
    writing: { persuasive: 0.48, narrative: 0.62, spelling: 0.75 },
  },
  timeBehavior: {
    avgTimePerQuestion: 55,
    rushingIndicator: 0.20,
    staminaCurve: "consistent performance throughout test",
    fastAnswers: 4,
  },
  errorPatterns: [
    { type: "concept_gap", frequency: 10, severity: "high" },
    { type: "careless_error", frequency: 6, severity: "medium" },
    { type: "misread_question", frequency: 4, severity: "medium" },
  ],
};

// Backward-compatible default export
export const MOCK_STUDENT = MOCK_STUDENT_MIA;

/**
 * Get mock student data by studentId.
 * Returns undefined if student not found (simulate real DB miss).
 */
export function getMockStudent(studentId?: string): StudentData | undefined {
  if (!studentId) return MOCK_STUDENT_MIA;
  const students: Record<string, StudentData> = {
    'stu_001': MOCK_STUDENT_MIA,
    'mock-student-001': MOCK_STUDENT_MIA,
    'stu_002': MOCK_STUDENT_LEO,
    'mock-student-002': MOCK_STUDENT_LEO,
  };
  return students[studentId];
}

// --- Questions ---
export const MOCK_QUESTION_OC: QuestionData = {
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

export const MOCK_QUESTION_SELECTIVE: QuestionData = {
  questionId: "mock-q-002",
  text: "Read the passage and identify the author's main argument for renewable energy adoption.",
  options: [
    { label: "A", text: "Cost savings for households", isCorrect: false },
    { label: "B", text: "Environmental protection and sustainability", isCorrect: true },
    { label: "C", text: "Energy independence from other countries", isCorrect: false },
    { label: "D", text: "Creating new technology jobs", isCorrect: false },
  ],
  correctAnswer: "B",
  explanation: "The author's central thesis focuses on environmental impact, with economic factors as supporting evidence.",
  skillTags: ["reading.inference", "reading.main_idea"],
  difficulty: "hard",
  estimatedTime: 90,
  studentAnswer: "A",
  studentTimeSpent: 65,
};

// Backward-compatible default
export const MOCK_QUESTION = MOCK_QUESTION_OC;

/**
 * Get mock question by questionId.
 */
export function getMockQuestion(questionId?: string): QuestionData | undefined {
  if (!questionId) return MOCK_QUESTION_OC;
  const questions: Record<string, QuestionData> = {
    'mock-q-001': MOCK_QUESTION_OC,
    'np_001': MOCK_QUESTION_OC,
    'mock-q-002': MOCK_QUESTION_SELECTIVE,
    'ri_001': MOCK_QUESTION_SELECTIVE,
  };
  return questions[questionId];
}

// --- Memory Records (per-student) ---
export const MOCK_MEMORY_RECORDS: MemoryRecord[] = [
  {
    content: "Mia's parent asked about math performance on 2026-02-15. Advisor noted number patterns were weakest area at 42% mastery. Recommended daily 10-minute pattern drills.",
    namespace: "/students/stu_001/learning/",
    metadata: { studentId: "stu_001", subject: "math" },
  },
  {
    content: "Mia struggled with multiplication-based patterns during tutoring on 2026-02-20. She initially confused ×2 with ×3 patterns but self-corrected after guided questioning.",
    namespace: "/students/stu_001/learning/",
    metadata: { studentId: "stu_001", skill: "number_patterns" },
  },
  {
    content: "Mia showed strong reading comprehension during test 3, scoring 9/10 on inference questions. Her vocabulary skills are above grade level.",
    namespace: "/students/stu_001/learning/",
    metadata: { studentId: "stu_001", subject: "reading" },
  },
  {
    content: "Leo's parent asked about writing improvement on 2026-02-18. Advisor noted persuasive writing at 48% — lowest area. Recommended structured argument practice with PEEL paragraphs.",
    namespace: "/students/stu_002/learning/",
    metadata: { studentId: "stu_002", subject: "writing" },
  },
  {
    content: "Leo excelled in math word problems during tutoring on 2026-02-22. Shows strong logical reasoning, can break complex problems into steps independently.",
    namespace: "/students/stu_002/learning/",
    metadata: { studentId: "stu_002", skill: "word_problems" },
  },
  {
    content: "Leo struggled with reading inference during selective practice test. Tends to pick literally stated facts rather than implied meanings.",
    namespace: "/students/stu_002/learning/",
    metadata: { studentId: "stu_002", subject: "reading" },
  },
  {
    content: "Family insights for Chen family (family_001): Both children preparing for different exam stages. Parents are engaged and supportive, prefer Chinese communication.",
    namespace: "/families/family_001/insights/",
    metadata: { familyId: "family_001", topic: "family_profile" },
  },
  {
    content: "Time management concern raised by parent on 2026-03-01. Mia tends to rush through early questions and slow down at the end. Advisor suggested pacing strategy: 1 minute per question.",
    namespace: "/families/family_001/insights/",
    metadata: { studentId: "stu_001", topic: "time_management" },
  },
];

/**
 * Get memory records filtered by namespace prefix.
 */
export function getMockMemoryRecords(namespacePrefix?: string): MemoryRecord[] {
  if (!namespacePrefix) return MOCK_MEMORY_RECORDS;
  return MOCK_MEMORY_RECORDS.filter(r => r.namespace.startsWith(namespacePrefix));
}
