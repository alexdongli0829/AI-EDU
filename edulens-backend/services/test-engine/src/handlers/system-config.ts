/**
 * GET  /admin/config  — return all config values (with defaults)
 * PUT  /admin/config  — update one or more config values
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getDb, query } from '../lib/database';
import {
  CONFIG_DEFAULTS,
  invalidateSystemConfigCache,
} from '../lib/system-config';

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Credentials': true,
};

function ok(data: object): APIGatewayProxyResult {
  return { statusCode: 200, headers: CORS, body: JSON.stringify(data) };
}
function err(code: number, msg: string): APIGatewayProxyResult {
  return { statusCode: code, headers: CORS, body: JSON.stringify({ success: false, error: msg }) };
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const db = await getDb();

  if (event.httpMethod === 'GET') {
    const rows = await db.unsafe<Array<{ key: string; value: string; updated_at: string }>>(
      `SELECT key, value, updated_at FROM system_config ORDER BY key`
    );

    // Merge DB values onto defaults; include metadata about which keys are overridden
    const dbMap: Record<string, { value: string; updatedAt: string }> = {};
    for (const r of rows) dbMap[r.key] = { value: r.value, updatedAt: r.updated_at };

    const config: Record<string, { value: string; default: string; overridden: boolean; updatedAt?: string }> = {};
    for (const [key, defaultVal] of Object.entries(CONFIG_DEFAULTS)) {
      const override = dbMap[key];
      config[key] = {
        value: override?.value ?? defaultVal,
        default: defaultVal,
        overridden: !!override,
        ...(override && { updatedAt: override.updatedAt }),
      };
    }

    return ok({ success: true, config });
  }

  if (event.httpMethod === 'PUT') {
    const body = JSON.parse(event.body || '{}');
    const updated: string[] = [];
    const rejected: string[] = [];

    for (const [key, value] of Object.entries(body)) {
      if (!(key in CONFIG_DEFAULTS)) {
        rejected.push(key);
        continue;
      }
      await query(
        `INSERT INTO system_config (key, value, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
        key,
        String(value),
      );
      updated.push(key);
    }

    // Invalidate in-process cache so next request picks up new values
    invalidateSystemConfigCache();

    return ok({ success: true, updated, ...(rejected.length && { rejected }) });
  }

  if (event.httpMethod === 'DELETE') {
    // Reset a key back to its default by removing the DB override
    const body = JSON.parse(event.body || '{}');
    const keys: string[] = Array.isArray(body.keys) ? body.keys : [];
    if (!keys.length) return err(400, 'keys array is required');

    const reset: string[] = [];
    for (const key of keys) {
      if (!(key in CONFIG_DEFAULTS)) continue;
      await query(`DELETE FROM system_config WHERE key = $1`, key);
      reset.push(key);
    }
    invalidateSystemConfigCache();
    return ok({ success: true, reset });
  }

  return err(405, 'Method not allowed');
}
