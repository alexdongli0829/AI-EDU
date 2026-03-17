// Shared type definitions for EduLens Agents

export interface StudentData {
  studentId: string;
  name: string;
  gradeLevel: number;
  overallMastery: number;
  strengths: string[];
  weaknesses: string[];
  testHistory: TestResult[];
  skillBreakdown: Record<string, Record<string, number>>;
  timeBehavior: TimeBehavior;
  errorPatterns: ErrorPattern[];
}

export interface TestResult {
  title: string;
  date: string;
  score: number;
  correct: number;
  total: number;
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
  severity: string;
}

export interface QuestionData {
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

export interface QuestionOption {
  label: string;
  text: string;
  isCorrect: boolean;
}

export interface MemoryRecord {
  content: string;
  namespace: string;
  metadata: Record<string, any>;
}

export interface GuardrailResult {
  blocked: boolean;
  reason?: string;
  redirect_message?: string;
}

export interface OutputViolation {
  type: string;
  pattern: string;
  message: string;
}

export interface EducationalSignal {
  type: string;
  value: string;
  confidence: number;
  timestamp: string;
}

export interface AgentPayload {
  prompt: string;
  studentId?: string;
  studentName?: string;
  questionId?: string;
  children?: ChildInfo[];
  conversationHistory?: ConversationMessage[];
}

export interface ChildInfo {
  id: string;
  name: string;
  gradeLevel?: number;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AgentResponse {
  response: string;
  blocked?: boolean;
  reason?: string;
  signals?: Array<{
    type: string;
    value: string;
    confidence: number;
  }>;
}