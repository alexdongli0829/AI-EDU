/**
 * GET /contests
 * Returns contests visible to students/parents.
 * Query params:
 *   stageId   — filter by stage (optional)
 *   status    — filter by status (default: open,active)
 *   studentId — if provided, adds is_registered boolean per contest (optional)
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { query } from '../lib/database';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const q = event.queryStringParameters || {};
    const stageId = q.stageId || null;
    const studentId = q.studentId || null;
    const statusParam = q.status || 'open,active';
    const showAll = statusParam === 'all';
    const statusFilter = showAll ? [] : statusParam.split(',').map((s: string) => s.trim());

    // Build parameterised query
    const params: any[] = showAll ? [] : [statusFilter];
    let statusWhere = showAll ? '' : `WHERE c.status = ANY($1::text[])`;
    let stageWhere = '';
    if (stageId) {
      params.push(stageId);
      const connector = showAll ? 'WHERE' : 'AND';
      stageWhere = `${connector} cs.stage_id = $${params.length}`;
    }

    // Optional per-student registration flag
    let isRegisteredExpr = 'false AS is_registered';
    if (studentId) {
      params.push(studentId);
      isRegisteredExpr = `EXISTS(SELECT 1 FROM contest_registrations cr2 WHERE cr2.contest_id = c.id AND cr2.student_id = $${params.length}::uuid) AS is_registered`;
    }

    const rows = await query(`
      SELECT
        c.id,
        c.title,
        c.status,
        c.window_start_at  AS scheduled_start,
        c.window_end_at    AS scheduled_end,
        c.total_participants,
        c.avg_score,
        c.question_ids,
        COALESCE(array_length(c.question_ids, 1), 0) AS question_count,
        (SELECT COUNT(*)::int FROM contest_registrations cr WHERE cr.contest_id = c.id) AS registered_count,
        cs.title           AS series_name,
        cs.stage_id,
        cs.id              AS series_id,
        ${isRegisteredExpr}
      FROM contests c
      JOIN contest_series cs ON c.series_id = cs.id
      ${statusWhere}
        ${stageWhere}
      ORDER BY c.window_start_at ASC NULLS LAST
    `, ...params) as any[];

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: true, contests: rows }),
    };
  } catch (error) {
    console.error('list-contests error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: false, error: 'Internal server error' }),
    };
  }
}
