/**
 * POST /admin/contests
 * Create an individual contest within a series.
 * Status starts as 'draft' → must be explicitly transitioned to 'open'.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../../lib/database';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    if (!event.body) return err(400, 'Request body is required');

    const {
      seriesId,
      title,
      windowStartAt,
      windowEndAt,
      status: initialStatus,
      questionIds,
    } = JSON.parse(event.body);

    if (!seriesId || !title || !windowStartAt || !windowEndAt) {
      return err(400, 'seriesId, title, windowStartAt, and windowEndAt are required');
    }

    const ALLOWED_INITIAL = ['draft', 'open'];
    const status = ALLOWED_INITIAL.includes(initialStatus) ? initialStatus : 'draft';

    // Validate questionIds is an array of strings
    const qIds: string[] = Array.isArray(questionIds) ? questionIds.filter((x: any) => typeof x === 'string') : [];

    // Verify series exists and get stage_id
    const series = await query(
      `SELECT id, stage_id FROM contest_series WHERE id = $1::uuid`,
      seriesId
    ) as any[];

    if (!series.length) return err(404, 'Contest series not found');

    const id = uuidv4();
    await query(
      `INSERT INTO contests
         (id, series_id, stage_id, title, status, question_ids, window_start_at, window_end_at, created_at)
       VALUES
         ($1::uuid, $2::uuid, $3, $4, $5, $6::uuid[], $7, $8, NOW())`,
      id,
      seriesId,
      series[0].stage_id,
      title,
      status,
      `{${qIds.join(',')}}`,
      windowStartAt,
      windowEndAt
    );

    return ok(201, { success: true, contestId: id, seriesId, title, status });
  } catch (error) {
    console.error('create-contest error:', error);
    return err(500, 'Internal server error');
  }
}

function ok(statusCode: number, data: object): APIGatewayProxyResult {
  return { statusCode, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(data) };
}

function err(statusCode: number, message: string): APIGatewayProxyResult {
  return { statusCode, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ success: false, error: message }) };
}
