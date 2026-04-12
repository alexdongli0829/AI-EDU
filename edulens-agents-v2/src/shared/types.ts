/**
 * Shared type definitions for EduLens Foundation Agent system.
 * All Zod schemas use Zod v4 syntax.
 */

import { z } from 'zod';

// ── Actor Identity and RBAC ─────────────────────────────────────

export type ActorRole = 'student' | 'parent' | 'admin';

export interface ActorIdentity {
  actorId: string;
  role: ActorRole;
  children?: string[];   // parent → list of child student IDs
  studentId?: string;    // student → own ID
  email?: string;
}

// ── Domain Harness Configuration ────────────────────────────────

export type ModelTier = 'haiku' | 'sonnet';

export interface ToolPolicy {
  allowedDomains?: string[];
  maxCallsPerSession?: number;
  requiresRole?: ActorRole[];
  dataAccess?: 'own' | 'children' | 'all';
}

export interface DomainHarness {
  name: string;
  systemPromptFile: string;
  model: ModelTier;
  fallbackModel?: ModelTier;
  maxTokens: number;
  temperature: number;
  tools: string[];
  toolPolicies: Record<string, ToolPolicy>;
  allowedRoles?: ActorRole[];
}

// ── Agent Response ──────────────────────────────────────────────

export interface Signal {
  type: string;
  value: string;
  confidence: number;
}

export interface AgentResponse {
  response: string;
  blocked?: boolean;
  reason?: string;
  signals?: Signal[];
  metadata?: Record<string, unknown>;
}

// ── Student Data ────────────────────────────────────────────────

export interface TestResult {
  title: string;
  date: string;
  score: number;
  correct: number;
  total: number;
}

export interface SkillBreakdown {
  [subject: string]: {
    [skill: string]: number;
  };
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
  severity: 'low' | 'medium' | 'high';
}

export interface StudentData {
  studentId: string;
  name: string;
  gradeLevel: number;
  overallMastery: number;
  strengths: string[];
  weaknesses: string[];
  testHistory: TestResult[];
  skillBreakdown: SkillBreakdown;
  timeBehavior: TimeBehavior;
  errorPatterns: ErrorPattern[];
}

// ── Question Data ───────────────────────────────────────────────

export interface QuestionOption {
  label: string;
  text: string;
  isCorrect: boolean;
}

export interface QuestionData {
  questionId: string;
  text: string;
  options: QuestionOption[];
  correctAnswer: string;
  explanation: string;
  skillTags: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  estimatedTime: number;
  studentAnswer?: string;
  studentTimeSpent?: number;
  subject?: string;
}

// ── Test Session ────────────────────────────────────────────────

export interface TestSession {
  sessionId: string;
  studentId: string;
  testId?: string;
  stageId?: string;
  status: 'active' | 'completed' | 'abandoned';
  scaledScore?: number;
  questionCount: number;
  correctCount: number;
  totalItems: number;
  startedAt: string;
  completedAt?: string;
}

// ── Memory ──────────────────────────────────────────────────────

export interface MemoryRecord {
  id: string;
  content: string;
  namespace: string;
  metadata: Record<string, unknown>;
  timestamp: string;
  actorId: string;
}

// ── Conversation ────────────────────────────────────────────────

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
  metadata?: Record<string, unknown>;
}

export interface ConversationHistory {
  sessionId: string;
  actorId: string;
  domain: string;
  turns: ConversationTurn[];
  createdAt: string;
  updatedAt: string;
}

// ── Hook Types ──────────────────────────────────────────────────

export interface HookResult {
  blocked: boolean;
  reason?: string;
  modifiedInput?: unknown;
  metadata?: Record<string, unknown>;
}

export interface HookContext {
  actorIdentity?: ActorIdentity;
  domainHarness?: DomainHarness;
  sessionId?: string;
  requestId?: string;
  metadata: Record<string, unknown>;
}

// ── Web Search (Zod v4 schemas) ─────────────────────────────────

export const BraveSearchSchema = z.object({
  query: z.string().min(1).max(400),
  country: z.string().optional().default('AU'),
  safesearch: z.enum(['strict', 'moderate', 'off']).optional().default('strict')
});

export type BraveSearchInput = z.infer<typeof BraveSearchSchema>;

export interface BraveSearchResult {
  title: string;
  url: string;
  description: string;
  age?: string;
  language?: string;
}

// ── Invocation Request (AgentCore) ──────────────────────────────

export const InvocationRequestSchema = z.object({
  prompt: z.string().min(1),
  domain: z.enum(['student_tutor', 'parent_advisor']),
  actorId: z.string().min(1),
  role: z.enum(['student', 'parent', 'admin']),
  studentId: z.string().optional(),
  studentName: z.string().optional(),
  questionId: z.string().optional(),
  children: z.array(z.object({
    id: z.string(),
    name: z.string(),
    gradeLevel: z.number().optional()
  })).optional(),
  conversationHistory: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string()
  })).optional(),
  sessionId: z.string().optional()
});

export type InvocationRequest = z.infer<typeof InvocationRequestSchema>;
