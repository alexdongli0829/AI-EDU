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
  metadata: MemoryMetadata & Record<string, any>;
}

export interface MemoryMetadata {
  stage?: 'oc_prep' | 'selective_prep';
  subject?: 'reading' | 'math' | 'thinking' | 'writing';
  skill?: string;
  error_type?: 'concept_gap' | 'careless' | 'time_pressure' | 'misread' | 'elimination_failure';
  cognitive_depth?: 1 | 2 | 3 | 4;
  session_id?: string;
  timestamp?: string;
  confidence?: number;
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
  stage?: 'oc_prep' | 'selective_prep';
  children?: ChildInfo[];
  conversationHistory?: ConversationMessage[];
}

export interface ChildInfo {
  id: string;
  name: string;
  gradeLevel?: number;
  familyId?: string;
  chineseName?: string;
  nickname?: string;
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