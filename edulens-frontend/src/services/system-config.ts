const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export interface ErrorClassificationThresholds {
  carelessErrorMaxSeconds: number;     // < this → careless_error
  timePressureMinPctRemaining: number; // < this fraction remaining → time_pressure
  conceptGapMinSeconds: number;        // > this → concept_gap
}

export const DEFAULT_THRESHOLDS: ErrorClassificationThresholds = {
  carelessErrorMaxSeconds:     5,
  timePressureMinPctRemaining: 0.20,
  conceptGapMinSeconds:        120,
};

let cache: ErrorClassificationThresholds | null = null;

export async function getThresholds(): Promise<ErrorClassificationThresholds> {
  if (cache) return cache;
  try {
    const res = await fetch(`${API_URL}/admin/config`);
    const data = await res.json();
    if (data.success && data.config) {
      cache = {
        carelessErrorMaxSeconds:     parseFloat(data.config.carelessErrorMaxSeconds)     || DEFAULT_THRESHOLDS.carelessErrorMaxSeconds,
        timePressureMinPctRemaining: parseFloat(data.config.timePressureMinPctRemaining) || DEFAULT_THRESHOLDS.timePressureMinPctRemaining,
        conceptGapMinSeconds:        parseFloat(data.config.conceptGapMinSeconds)        || DEFAULT_THRESHOLDS.conceptGapMinSeconds,
      };
      return cache;
    }
  } catch {}
  return DEFAULT_THRESHOLDS;
}

export async function updateThresholds(
  thresholds: Partial<ErrorClassificationThresholds>
): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/admin/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(thresholds),
    });
    const data = await res.json();
    if (data.success) cache = null; // invalidate so next fetch is fresh
    return data.success;
  } catch {
    return false;
  }
}
