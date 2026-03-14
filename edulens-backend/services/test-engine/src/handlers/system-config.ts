/**
 * GET  /admin/config  — return all config values (with defaults)
 * PUT  /admin/config  — update one or more config values
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getPrismaClient } from '../lib/database';

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Credentials': true,
};

// All known config keys with their default values
export const CONFIG_DEFAULTS: Record<string, string> = {
  carelessErrorMaxSeconds:     '5',
  timePressureMinPctRemaining: '0.20',
  conceptGapMinSeconds:        '120',
};

function ok(data: object): APIGatewayProxyResult {
  return { statusCode: 200, headers: CORS, body: JSON.stringify(data) };
}
function err(code: number, msg: string): APIGatewayProxyResult {
  return { statusCode: code, headers: CORS, body: JSON.stringify({ success: false, error: msg }) };
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const prisma = await getPrismaClient();

  if (event.httpMethod === 'GET') {
    const rows = await prisma.$queryRawUnsafe<Array<{ key: string; value: string }>>(
      `SELECT key, value FROM system_config`
    );
    const config = { ...CONFIG_DEFAULTS };
    rows.forEach(r => { if (r.key in config) config[r.key] = r.value; });
    return ok({ success: true, config });
  }

  if (event.httpMethod === 'PUT') {
    const body = JSON.parse(event.body || '{}');
    const updated: string[] = [];
    for (const [key, value] of Object.entries(body)) {
      if (!(key in CONFIG_DEFAULTS)) continue;
      await prisma.$executeRawUnsafe(
        `INSERT INTO system_config (key, value, updated_at) VALUES ($1, $2, NOW())
         ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
        key, String(value)
      );
      updated.push(key);
    }
    return ok({ success: true, updated });
  }

  return err(405, 'Method not allowed');
}
