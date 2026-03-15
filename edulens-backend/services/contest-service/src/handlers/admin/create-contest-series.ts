/**
 * POST /admin/contest-series
 * Create a new contest series (e.g. "Term 1 2026 OC Prep Championship").
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../../lib/database';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    if (!event.body) return err(400, 'Request body is required');

    const { title, stageId, recurrenceRule, durationMins, questionCount } = JSON.parse(event.body);

    if (!title || !stageId) return err(400, 'title and stageId are required');

    // Verify stage exists
    const stages = await query(
      `SELECT id FROM stages WHERE id = $1 AND is_active = true`,
      stageId
    ) as any[];

    if (!stages.length) return err(404, `Stage '${stageId}' not found`);

    const id = uuidv4();
    await query(
      `INSERT INTO contest_series (id, stage_id, title, recurrence_rule, duration_mins, question_count, created_at)
       VALUES ($1::uuid, $2, $3, $4, $5, $6, NOW())`,
      id,
      stageId,
      title,
      recurrenceRule || '',
      durationMins || 30,
      questionCount || 35
    );

    return ok(201, { success: true, contestSeriesId: id, title, stageId });
  } catch (error) {
    console.error('create-contest-series error:', error);
    return err(500, 'Internal server error');
  }
}

function ok(statusCode: number, data: object): APIGatewayProxyResult {
  return { statusCode, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(data) };
}

function err(statusCode: number, message: string): APIGatewayProxyResult {
  return { statusCode, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ success: false, error: message }) };
}
