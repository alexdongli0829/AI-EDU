/**
 * GET /stages/:fromId/bridges/:toId
 * Returns all skill bridges from one stage to another.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getDb, query } from '../lib/database';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const fromId = event.pathParameters?.fromId;
    const toId = event.pathParameters?.toId;

    if (!fromId || !toId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ success: false, error: 'fromId and toId are required' }),
      };
    }

    const db = await getDb();

    const bridges = await query(`
      SELECT id, from_stage_id, from_skill, to_stage_id, to_skill, prior_weight
      FROM skill_bridges
      WHERE from_stage_id = $1 AND to_stage_id = $2
      ORDER BY from_skill ASC
    `, fromId, toId) as any[];

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: true, bridges }),
    };
  } catch (error) {
    console.error('get-skill-bridges error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: false, error: 'Internal server error' }),
    };
  }
}
