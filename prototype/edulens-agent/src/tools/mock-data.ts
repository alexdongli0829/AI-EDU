// Mock data for EduLens Agent prototype — no real DB connections

export interface TestRecord {
  title: string;
  date: string;
  score: number;
  correct: number;
  total: number;
}

export interface SkillBreakdown {
  reading: Record<string, number>;
  math: Record<string, number>;
  thinking: Record<string, number>;
}

export interface TimeBehavior {
  avgTimePerQuestion: number;
  rushingIndicator: number;
  staminaCurve: string;
  fastAnswers: number;
}

export interface ErrorPattern {
  type: string;
  frequency: number;
  severity: "low" | "medium" | "high";
}

export interface StudentProfile {
  studentId: string;
  name: string;
  gradeLevel: number;
  overallMastery: number;
  strengths: string[];
  weaknesses: string[];
  testHistory: TestRecord[];
  skillBreakdown: SkillBreakdown;
  timeBehavior: TimeBehavior;
  errorPatterns: ErrorPattern[];
}

export interface QuestionOption {
  label: string;
  text: string;
  isCorrect: boolean;
}

export interface MockQuestion {
  questionId: string;
  text: string;
  options: QuestionOption[];
  correctAnswer: string;
  explanation: string;
  skillTags: string[];
  difficulty: string;
  estimatedTime: number;
  studentAnswer: string;
  studentTimeSpent: number;
}

// ---------------------------------------------------------------------------
// Mock Student Profile
// ---------------------------------------------------------------------------
export const MOCK_STUDENT: StudentProfile = {
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
      detail: 0.7,
    },
    math: {
      number_patterns: 0.45,
      fractions: 0.55,
      word_problems: 0.6,
      geometry: 0.5,
    },
    thinking: {
      spatial: 0.4,
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

// ---------------------------------------------------------------------------
// Mock Question (for Student Tutor)
// ---------------------------------------------------------------------------
export const MOCK_QUESTION: MockQuestion = {
  questionId: "mock-q-001",
  text: "If the pattern continues: 2, 6, 18, 54, ?, what is the next number?",
  options: [
    { label: "A", text: "108", isCorrect: false },
    { label: "B", text: "162", isCorrect: true },
    { label: "C", text: "148", isCorrect: false },
    { label: "D", text: "216", isCorrect: false },
  ],
  correctAnswer: "B",
  explanation:
    "Each number is multiplied by 3: 2×3=6, 6×3=18, 18×3=54, 54×3=162",
  skillTags: ["math.number_patterns"],
  difficulty: "medium",
  estimatedTime: 45,
  studentAnswer: "A",
  studentTimeSpent: 18,
};
