/**
 * Core domain models for EduLens Backend
 */

// ==================== User & Auth ====================

export enum UserRole {
  ADMIN = 'admin',
  PARENT = 'parent',
  STUDENT = 'student',
}

export interface User {
  id: string;
  email: string;
  role: UserRole;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Student {
  id: string;
  userId: string;
  grade: number;
  dateOfBirth: Date;
  parentId: string;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== Tests & Questions ====================

export enum QuestionType {
  MULTIPLE_CHOICE = 'multiple_choice',
  SHORT_ANSWER = 'short_answer',
  ESSAY = 'essay',
}

export enum Subject {
  MATH = 'math',
  READING = 'reading',
  SCIENCE = 'science',
  WRITING = 'writing',
}

export enum Difficulty {
  EASY = 'easy',
  MEDIUM = 'medium',
  HARD = 'hard',
}

export interface Question {
  id: string;
  testId: string;
  type: QuestionType;
  subject: Subject;
  difficulty: Difficulty;
  text: string;
  options?: Array<{
    id: string;
    text: string;
    isCorrect?: boolean; // Only exposed to admin
  }>;
  correctAnswer?: string; // For short answer/essay
  rubric?: string; // For essay questions
  skillTags: string[]; // e.g., ['reading.inference', 'reading.main-idea']
  estimatedTime: number; // seconds
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Test {
  id: string;
  title: string;
  description: string;
  subject: Subject;
  grade: number;
  totalQuestions: number;
  timeLimit: number; // seconds
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== Test Sessions ====================

export enum SessionStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  ABANDONED = 'abandoned',
}

export interface TestSession {
  id: string;
  studentId: string;
  testId: string;
  status: SessionStatus;
  startedAt?: Date;
  completedAt?: Date;
  timeRemaining: number; // seconds
  currentQuestionIndex: number;
  totalQuestions: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionResponse {
  id: string;
  sessionId: string;
  questionId: string;
  studentAnswer: string;
  isCorrect?: boolean;
  timeSpent: number; // seconds
  confidence?: number; // 0-1 for ML confidence
  answeredAt: Date;
}

export interface TestResults {
  sessionId: string;
  score: {
    correct: number;
    total: number;
    percentage: number;
  };
  skillBreakdown: {
    [skillTag: string]: {
      correct: number;
      total: number;
      percentage: number;
    };
  };
  timeAnalysis: {
    totalTime: number;
    averageTimePerQuestion: number;
    fastestQuestion: number;
    slowestQuestion: number;
  };
  completedAt: Date;
}

// ==================== Chat & Conversations ====================

export enum ChatRole {
  STUDENT = 'student',
  PARENT = 'parent',
}

export enum MessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
}

export enum AgentState {
  IDLE = 'idle',
  PROCESSING = 'processing',
  RESPONDING = 'responding',
  WAITING_FEEDBACK = 'waiting_feedback',
}

export interface ChatSession {
  id: string;
  studentId: string;
  role: ChatRole;
  agentState: AgentState;
  turnCount: number;
  startedAt: Date;
  lastMessageAt?: Date;
  metadata?: Record<string, any>;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  metadata?: {
    tokenCount?: number;
    modelUsed?: string;
    latency?: number;
  };
}

export interface ConversationMemory {
  id: string;
  studentId: string;
  sessionId: string;
  summary: string;
  keyTopics: string[];
  insightsExtracted: Record<string, any>;
  parentQuestions: string[];
  satisfactionSignal?: 'positive' | 'neutral' | 'negative';
  turnCount: number;
  createdAt: Date;
}

// ==================== Profile & Learning DNA ====================

export interface SkillNode {
  skillId: string;
  skillName: string;
  subject: Subject;
  masteryLevel: number; // 0-1
  confidence: number; // 0-1 (statistical confidence)
  attempts: number;
  correctAttempts: number;
  lastUpdated: Date;
}

export interface ErrorPattern {
  errorType: string;
  frequency: number;
  skillsAffected: string[];
  examples: string[];
  severity: 'low' | 'medium' | 'high';
}

export interface TimeBehavior {
  averageSpeed: number; // seconds per question
  rushingIndicator: number; // 0-1 (1 = rushing)
  hesitationPattern: string[];
  optimalTimeRange: {
    min: number;
    max: number;
  };
}

export interface StudentProfile {
  id: string;
  studentId: string;
  skillGraph: SkillNode[];
  errorPatterns: ErrorPattern[];
  timeBehavior: TimeBehavior;
  overallMastery: number; // 0-1
  strengths: string[]; // skill IDs
  weaknesses: string[]; // skill IDs
  lastCalculated: Date;
  updatedAt: Date;
}

export interface ProfileSnapshot {
  id: string;
  studentId: string;
  profileData: Partial<StudentProfile>;
  snapshotDate: Date;
  trigger: 'test_completed' | 'scheduled' | 'manual';
}

// ==================== Events (Event Sourcing) ====================

export enum EventType {
  TEST_STARTED = 'test_started',
  TEST_COMPLETED = 'test_completed',
  QUESTION_ANSWERED = 'question_answered',
  CHAT_MESSAGE_SENT = 'chat_message_sent',
  PROFILE_UPDATED = 'profile_updated',
  INSIGHT_EXTRACTED = 'insight_extracted',
}

export interface DomainEvent {
  id: string;
  aggregateId: string; // e.g., studentId, sessionId
  aggregateType: 'student' | 'test_session' | 'chat_session';
  eventType: EventType;
  payload: Record<string, any>;
  timestamp: Date;
  version: number;
}

// ==================== API Response Types ====================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    requestId: string;
    timestamp: Date;
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}
