/**
 * GET /stages/:id
 * Returns full stage config including test_formats and prompts.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getDb, query } from '../lib/database';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const stageId = event.pathParameters?.id;
    if (!stageId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ success: false, error: 'stageId is required' }),
      };
    }

    const db = await getDb();

    const rows = await query(`
      SELECT id, display_name, test_formats, student_agent_prompt, parent_agent_prompt,
             sort_order, is_active, created_at
      FROM stages
      WHERE id = $1
    `, stageId) as any[];

    if (!rows.length) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ success: false, error: 'Stage not found' }),
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: true, stage: rows[0] }),
    };
  } catch (error) {
    console.error('get-stage error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: false, error: 'Internal server error' }),
    };
  }
}
