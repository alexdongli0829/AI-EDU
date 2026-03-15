/**
 * System Configuration Registry
 *
 * Single source of truth for all runtime-tunable parameters.
 * Values are stored in the `system_config` DB table and editable via
 * the admin API (GET/PUT /admin/config) without redeployment.
 *
 * Cached in-process for 5 minutes to avoid a DB round-trip on every request.
 */

import { getDb, query } from './database';

// ─── Canonical defaults ──────────────────────────────────────────────────────
// All keys must be declared here. Unknown keys are silently ignored on PUT.

export const CONFIG_DEFAULTS: Record<string, string> = {

  // ── Test delivery ──────────────────────────────────────────────────────────
  /** Default number of questions per test when not set on the test record or stage */
  testDefaultQuestionCount:     '20',
  /** Default time limit (seconds) when not set on the test record or stage */
  testDefaultTimeLimitSeconds:  '1800',
  /** Minimum questions allowed regardless of stage/test override */
  testMinQuestions:             '5',
  /** Maximum questions allowed regardless of stage/test override */
  testMaxQuestions:             '50',
  /** Target fraction of easy questions (difficulty 1-2) in a generated set */
  testDifficultyEasyPct:        '0.30',
  /** Target fraction of medium questions (difficulty 3) */
  testDifficultyMediumPct:      '0.50',
  /** Target fraction of hard questions (difficulty 4-5) */
  testDifficultyHardPct:        '0.20',
  /** Hours before cached per-student insights are considered stale */
  testInsightsCacheHours:       '24',

  // ── AI models ──────────────────────────────────────────────────────────────
  // env var BEDROCK_MODEL_ID is the deploy-time default; these keys override at runtime.
  /** Bedrock model ID for parent chat streaming */
  aiParentChatModelId:          process.env.BEDROCK_MODEL_ID || 'us.anthropic.claude-sonnet-4-20250514-v1:0',
  /** Bedrock model ID for student chat (non-streaming) */
  aiStudentChatModelId:         process.env.BEDROCK_MODEL_ID || 'us.anthropic.claude-sonnet-4-20250514-v1:0',
  /** Bedrock model ID for per-subject performance insights generation */
  aiInsightsModelId:            process.env.BEDROCK_MODEL_ID || 'us.anthropic.claude-sonnet-4-20250514-v1:0',
  /** Bedrock model ID for conversation summarization (cost-optimized) */
  aiSummarizationModelId:       process.env.BEDROCK_MODEL_ID || 'us.anthropic.claude-haiku-4-5-20251001',
  /** max_tokens for chat completions */
  aiMaxTokensChat:              '2048',
  /** max_tokens for insights generation (longer output) */
  aiMaxTokensInsights:          '4096',
  /** max_tokens for summarization (shorter output) */
  aiMaxTokensSummarization:     '1024',
  /** temperature for chat (higher = more conversational) */
  aiTemperatureChat:            '0.7',
  /** temperature for insights (lower = more factual/consistent) */
  aiTemperatureInsights:        '0.3',
  /** temperature for summarization */
  aiTemperatureSummarization:   '0.3',

  // ── Conversation / chat session ────────────────────────────────────────────
  /** Number of most-recent message turns to include in the Bedrock context window */
  chatMaxHistoryTurns:          '10',
  /** Number of past session memory summaries to inject into the system prompt */
  chatMaxMemorySummaries:       '3',
  /** Minutes of inactivity before a chat session auto-expires */
  chatSessionTimeoutMinutes:    '60',

  // ── Profile / error classification ────────────────────────────────────────
  /** Seconds or less ⇒ classified as careless error */
  carelessErrorMaxSeconds:      '5',
  /** If time_remaining / original_time ≤ this, flag as time-pressure context */
  timePressureMinPctRemaining:  '0.20',
  /** Seconds or more spent on question ⇒ classified as concept gap */
  conceptGapMinSeconds:         '120',
  /** Minimum completed responses before a profile calculation is meaningful */
  profileMinResponsesForCalc:   '5',
  /** Persist a Learning DNA snapshot every N completed sessions */
  profileSnapshotEveryNSessions:'3',
  /** Bayesian Beta prior alpha (prior successes + 1) */
  profileBayesianPriorAlpha:    '1.0',
  /** Bayesian Beta prior beta (prior failures + 1) */
  profileBayesianPriorBeta:     '1.0',
  /** Mastery threshold (0–1) above which a skill is considered "mastered" */
  profileMasteryThreshold:      '0.70',
  /** Minimum attempts before a mastery estimate is considered high-confidence */
  profileMinAttemptsForConfidence: '5',

  // ── Contest ────────────────────────────────────────────────────────────────
  /** Default max participants if not set on the contest record */
  contestDefaultMaxParticipants: '500',
  /** Hours before contest start when registration closes automatically */
  contestRegistrationBufferHours: '1',
};

// ─── In-process cache ────────────────────────────────────────────────────────

let _cache: Record<string, string> | null = null;
let _cacheExpiry = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Load all system config values, merging DB overrides onto defaults.
 * Cached in-process; the cache is shared across warm Lambda invocations.
 */
export async function getSystemConfig(): Promise<Record<string, string>> {
  if (_cache && Date.now() < _cacheExpiry) return _cache;

  const db = await getDb();
  const rows = await db.unsafe<Array<{ key: string; value: string }>>(
    `SELECT key, value FROM system_config`
  );

  const merged: Record<string, string> = { ...CONFIG_DEFAULTS };
  for (const row of rows) {
    if (row.key in merged) merged[row.key] = row.value;
  }

  _cache = merged;
  _cacheExpiry = Date.now() + CACHE_TTL_MS;
  return _cache;
}

/** Invalidate the cache (e.g. after a PUT /admin/config) */
export function invalidateSystemConfigCache(): void {
  _cache = null;
  _cacheExpiry = 0;
}

// ─── Typed accessors ─────────────────────────────────────────────────────────

export function cfgStr(cfg: Record<string, string>, key: string): string {
  return cfg[key] ?? CONFIG_DEFAULTS[key] ?? '';
}

export function cfgNum(cfg: Record<string, string>, key: string): number {
  const v = cfg[key] ?? CONFIG_DEFAULTS[key];
  return v !== undefined ? parseFloat(v) : 0;
}

export function cfgInt(cfg: Record<string, string>, key: string): number {
  return Math.round(cfgNum(cfg, key));
}

export function cfgBool(cfg: Record<string, string>, key: string): boolean {
  return (cfg[key] ?? CONFIG_DEFAULTS[key] ?? 'false').toLowerCase() === 'true';
}
