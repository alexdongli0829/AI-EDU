/**
 * GET /admin/contest-series
 * List all contest series for admin management.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { query } from '../../lib/database';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const rows = await query(`
      SELECT
        cs.id,
        cs.title,
        cs.stage_id,
        cs.is_active,
        cs.created_at,
        COUNT(c.id)::int AS contest_count
      FROM contest_series cs
      LEFT JOIN contests c ON c.series_id = cs.id
      GROUP BY cs.id
      ORDER BY cs.created_at DESC
    `) as any[];

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: true, series: rows }),
    };
  } catch (error) {
    console.error('list-contest-series error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: false, error: 'Internal server error' }),
    };
  }
}
