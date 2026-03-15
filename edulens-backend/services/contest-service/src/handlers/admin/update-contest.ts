/**
 * PUT /admin/contests/:id
 * Update contest title, window, question list, and status.
 * Status changes are validated against the same state machine.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { query } from '../../lib/database';

const VALID_TRANSITIONS: Record<string, string[]> = {
  draft:   ['open'],
  open:    ['active', 'draft'],
  active:  ['scoring'],
  scoring: ['finalized'],
};

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const contestId = event.pathParameters?.id;
    if (!contestId) return err(400, 'contestId is required');
    if (!event.body) return err(400, 'Request body is required');

    const { title, windowStartAt, windowEndAt, questionIds, status: newStatus } = JSON.parse(event.body);

    // Fetch current contest
    const contests = await query(
      `SELECT id, title, status, window_start_at, window_end_at, question_ids FROM contests WHERE id = $1::uuid`,
      contestId
    ) as any[];

    if (!contests.length) return err(404, 'Contest not found');
    const current = contests[0];

    // Validate status transition if provided
    if (newStatus && newStatus !== current.status) {
      const allowed = VALID_TRANSITIONS[current.status] ?? [];
      if (!allowed.includes(newStatus)) {
        return err(409, `Cannot transition from '${current.status}' to '${newStatus}'. Allowed: ${allowed.join(', ') || 'none'}`);
      }
    }

    const updatedTitle       = title       ?? current.title;
    const updatedStart       = windowStartAt ?? current.window_start_at;
    const updatedEnd         = windowEndAt   ?? current.window_end_at;
    const updatedStatus      = newStatus     ?? current.status;
    const qIds: string[]     = Array.isArray(questionIds)
      ? questionIds.filter((x: any) => typeof x === 'string')
      : (current.question_ids || []);

    await query(
      `UPDATE contests
          SET title          = $1,
              status         = $2,
              question_ids   = $3::uuid[],
              window_start_at = $4,
              window_end_at   = $5,
              updated_at      = NOW()
        WHERE id = $6::uuid`,
      updatedTitle,
      updatedStatus,
      `{${qIds.join(',')}}`,
      updatedStart,
      updatedEnd,
      contestId
    );

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: true, contestId, status: updatedStatus }),
    };
  } catch (error) {
    console.error('update-contest error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: false, error: 'Internal server error' }),
    };
  }
}

function err(statusCode: number, message: string): APIGatewayProxyResult {
  return { statusCode, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ success: false, error: message }) };
}
