/**
 * GET /stages
 * Returns all active stage definitions.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getDb, query } from '../lib/database';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const db = await getDb();

    const stages = await query(`
      SELECT id, display_name, test_formats, sort_order, is_active, created_at
      FROM stages
      ORDER BY sort_order ASC
    `) as any[];

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: true, stages }),
    };
  } catch (error) {
    console.error('list-stages error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: false, error: 'Internal server error' }),
    };
  }
}
