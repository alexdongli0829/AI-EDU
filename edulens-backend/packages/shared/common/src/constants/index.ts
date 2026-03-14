/**
 * Application constants
 */

// ==================== Test Configuration ====================

export const TEST_CONFIG = {
  MIN_TIME_LIMIT: 300, // 5 minutes
  MAX_TIME_LIMIT: 7200, // 2 hours
  MIN_QUESTIONS: 5,
  MAX_QUESTIONS: 50,
  DEFAULT_TIME_PER_QUESTION: 60, // seconds
  WARNING_TIME_THRESHOLD: 300, // 5 minutes
} as const;

// ==================== Token Budget (from HLD) ====================

export const TOKEN_BUDGET = {
  MAX_REQUEST_TOKENS: 30_000,
  SYSTEM_PROMPT: 1_500,
  RESPONSE_RESERVE: 4_000,
  GROUNDING_DATA: 5_000,
  CROSS_SESSION_RECALL: 1_500,
  get CONVERSATION_HISTORY() {
    return (
      this.MAX_REQUEST_TOKENS -
      this.SYSTEM_PROMPT -
      this.RESPONSE_RESERVE -
      this.GROUNDING_DATA -
      this.CROSS_SESSION_RECALL
    ); // ~18,000 tokens
  },
} as const;

// ==================== AI Model Configuration ====================

export const AI_MODELS = {
  PARENT_CHAT: 'claude-sonnet-4.5-20250929',
  STUDENT_CHAT: 'claude-sonnet-4.5-20250929',
  SUMMARIZATION: 'claude-haiku-4.5-20251001', // 12x cheaper
  BACKGROUND_JOBS: 'claude-haiku-4.5-20251001',
} as const;

export const MODEL_PRICING = {
  // Per 1M tokens (input/output)
  'claude-sonnet-4.5': {
    input: 3.0,
    output: 15.0,
  },
  'claude-haiku-4.5': {
    input: 0.25,
    output: 1.25,
  },
} as const;

// ==================== Cache Configuration ====================

export const CACHE_TTL = {
  USER_SESSION: 3600, // 1 hour
  STUDENT_PROFILE: 1800, // 30 minutes
  TEST_QUESTIONS: 3600, // 1 hour
  TIMER_STATE: 5, // 5 seconds (real-time)
  CHAT_CONTEXT: 600, // 10 minutes
} as const;

export const CACHE_KEYS = {
  USER: (userId: string) => `user:${userId}`,
  STUDENT_PROFILE: (studentId: string) => `profile:${studentId}`,
  TEST_SESSION: (sessionId: string) => `session:${sessionId}`,
  TIMER_STATE: (sessionId: string) => `timer:${sessionId}`,
  CHAT_CONTEXT: (sessionId: string) => `chat:context:${sessionId}`,
  AGENT_STATE: (sessionId: string) => `chat:state:${sessionId}`,
} as const;

// ==================== Skill Tags (from HLD) ====================

export const SKILL_TAXONOMY = {
  READING: {
    MAIN_IDEA: 'reading.main-idea',
    INFERENCE: 'reading.inference',
    VOCABULARY: 'reading.vocabulary',
    TEXT_STRUCTURE: 'reading.text-structure',
    AUTHORS_PURPOSE: 'reading.authors-purpose',
  },
  MATH: {
    ARITHMETIC: 'math.arithmetic',
    ALGEBRA: 'math.algebra',
    GEOMETRY: 'math.geometry',
    PATTERNS: 'math.patterns',
    WORD_PROBLEMS: 'math.word-problems',
    FRACTIONS: 'math.fractions',
  },
  SCIENCE: {
    OBSERVATION: 'science.observation',
    HYPOTHESIS: 'science.hypothesis',
    ANALYSIS: 'science.analysis',
    CONCLUSION: 'science.conclusion',
  },
  WRITING: {
    GRAMMAR: 'writing.grammar',
    PUNCTUATION: 'writing.punctuation',
    ORGANIZATION: 'writing.organization',
    CLARITY: 'writing.clarity',
  },
} as const;

// ==================== Error Codes ====================

export const ERROR_CODES = {
  // Authentication & Authorization
  AUTH_UNAUTHORIZED: 'AUTH_UNAUTHORIZED',
  AUTH_FORBIDDEN: 'AUTH_FORBIDDEN',
  AUTH_TOKEN_EXPIRED: 'AUTH_TOKEN_EXPIRED',
  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',

  // Validation
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  INVALID_INPUT: 'INVALID_INPUT',
  REQUIRED_FIELD_MISSING: 'REQUIRED_FIELD_MISSING',

  // Resources
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  RESOURCE_ALREADY_EXISTS: 'RESOURCE_ALREADY_EXISTS',
  RESOURCE_CONFLICT: 'RESOURCE_CONFLICT',

  // Test Sessions
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  SESSION_ALREADY_STARTED: 'SESSION_ALREADY_STARTED',
  SESSION_ALREADY_COMPLETED: 'SESSION_ALREADY_COMPLETED',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  INVALID_SESSION_STATE: 'INVALID_SESSION_STATE',

  // Chat
  CHAT_SESSION_NOT_FOUND: 'CHAT_SESSION_NOT_FOUND',
  CHAT_RATE_LIMIT_EXCEEDED: 'CHAT_RATE_LIMIT_EXCEEDED',
  AI_SERVICE_ERROR: 'AI_SERVICE_ERROR',
  AI_TIMEOUT: 'AI_TIMEOUT',

  // System
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  CACHE_ERROR: 'CACHE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
} as const;

// ==================== HTTP Status Codes ====================

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
} as const;

// ==================== Pagination ====================

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
} as const;

// ==================== Timeouts ====================

export const TIMEOUTS = {
  DATABASE_QUERY: 30_000, // 30 seconds
  AI_REQUEST: 120_000, // 2 minutes (for streaming)
  CACHE_OPERATION: 5_000, // 5 seconds
  API_REQUEST: 30_000, // 30 seconds
} as const;

// ==================== Feature Flags ====================

export const FEATURES = {
  ENABLE_CHAT: true,
  ENABLE_AI_SCORING: false, // MVP: manual scoring only
  ENABLE_CROSS_SESSION_MEMORY: true,
  ENABLE_PROMPT_CACHING: true,
  ENABLE_MODEL_ROUTING: true,
} as const;
