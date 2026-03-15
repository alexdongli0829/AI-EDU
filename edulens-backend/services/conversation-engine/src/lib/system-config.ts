/**
 * System Configuration Registry — Conversation Engine
 *
 * Reads runtime-tunable parameters from the `system_config` DB table.
 * Cached in-process for 5 minutes so there is no per-request DB round-trip.
 * Values can be changed via the admin API (PUT /admin/config) without redeployment.
 */

import { query } from "./database";

// ─── Canonical defaults ──────────────────────────────────────────────────────
// Must match the authoritative list in test-engine/src/lib/system-config.ts.
// DB overrides win; these are the in-code fallbacks.

export const CONFIG_DEFAULTS: Record<string, string> = {
  // ── AI models ──────────────────────────────────────────────────────────────
  aiParentChatModelId:          'us.anthropic.claude-sonnet-4-20250514-v1:0',
  aiStudentChatModelId:         'us.anthropic.claude-sonnet-4-20250514-v1:0',
  aiInsightsModelId:            'us.anthropic.claude-sonnet-4-20250514-v1:0',
  aiSummarizationModelId:       'us.anthropic.claude-haiku-4-5-20251001',
  aiMaxTokensChat:              '2048',
  aiMaxTokensInsights:          '4096',
  aiMaxTokensSummarization:     '1024',
  aiTemperatureChat:            '0.7',
  aiTemperatureInsights:        '0.3',
  aiTemperatureSummarization:   '0.3',

  // ── Conversation / chat session ────────────────────────────────────────────
  chatMaxHistoryTurns:          '10',
  chatMaxMemorySummaries:       '3',
  chatSessionTimeoutMinutes:    '60',
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

  const rows = await query(
    `SELECT key, value FROM system_config`
  ) as Array<{ key: string; value: string }>;

  const merged: Record<string, string> = { ...CONFIG_DEFAULTS };
  for (const row of rows) {
    if (row.key in merged) merged[row.key] = row.value;
  }

  _cache = merged;
  _cacheExpiry = Date.now() + CACHE_TTL_MS;
  return _cache;
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
