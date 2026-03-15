/**
 * GET /stages/:id/skill-taxonomy
 * Returns the active skill taxonomy for a stage.
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

    // Return the latest version for this stage
    const rows = await query(`
      SELECT id, stage_id, version, categories, extends_id, created_at
      FROM skill_taxonomies
      WHERE stage_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `, stageId) as any[];

    if (!rows.length) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ success: false, error: 'Skill taxonomy not found for this stage' }),
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: true, taxonomy: rows[0] }),
    };
  } catch (error) {
    console.error('get-skill-taxonomy error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: false, error: 'Internal server error' }),
    };
  }
}
