"""
System Configuration Registry — Profile Engine

Reads runtime-tunable parameters from the `system_config` DB table.
Cached in-process for 5 minutes to avoid a DB round-trip on every invocation.
Values can be changed via the admin API (PUT /admin/config) without redeployment.
"""

import os
import time
from typing import Any, Dict

from sqlalchemy import text

from ..database.connection import engine

# ─── Canonical defaults ──────────────────────────────────────────────────────
# Must match the authoritative list in test-engine/src/lib/system-config.ts.
# DB overrides win; these are the in-code fallbacks.

CONFIG_DEFAULTS: Dict[str, str] = {
    # ── Profile / error classification ────────────────────────────────────────
    "carelessErrorMaxSeconds":        "5",
    "timePressureMinPctRemaining":    "0.20",
    "conceptGapMinSeconds":           "120",
    "profileMinResponsesForCalc":     "5",
    "profileSnapshotEveryNSessions":  "3",
    "profileBayesianPriorAlpha":      "1.0",
    "profileBayesianPriorBeta":       "1.0",
    "profileMasteryThreshold":        "0.70",
    "profileMinAttemptsForConfidence": "5",
}

# ─── In-process cache ────────────────────────────────────────────────────────

_cache: Dict[str, str] | None = None
_cache_expiry: float = 0.0
_CACHE_TTL = 5 * 60  # seconds


def get_system_config() -> Dict[str, str]:
    """
    Load all system config values, merging DB overrides onto defaults.
    Cached in-process; the cache is shared across warm Lambda invocations.
    """
    global _cache, _cache_expiry

    if _cache is not None and time.time() < _cache_expiry:
        return _cache

    merged = dict(CONFIG_DEFAULTS)

    try:
        with engine.connect() as conn:
            rows = conn.execute(text("SELECT key, value FROM system_config")).fetchall()
        for row in rows:
            if row[0] in merged:
                merged[row[0]] = row[1]
    except Exception as exc:
        # If the DB is unavailable, fall back to defaults rather than crashing
        print(f"[system_config] Could not load config from DB, using defaults: {exc}")

    _cache = merged
    _cache_expiry = time.time() + _CACHE_TTL
    return _cache


# ─── Typed accessors ─────────────────────────────────────────────────────────

def cfg_str(cfg: Dict[str, str], key: str) -> str:
    return cfg.get(key, CONFIG_DEFAULTS.get(key, ""))


def cfg_float(cfg: Dict[str, str], key: str) -> float:
    v = cfg.get(key, CONFIG_DEFAULTS.get(key))
    try:
        return float(v) if v is not None else 0.0
    except (ValueError, TypeError):
        return 0.0


def cfg_int(cfg: Dict[str, str], key: str) -> int:
    return round(cfg_float(cfg, key))
