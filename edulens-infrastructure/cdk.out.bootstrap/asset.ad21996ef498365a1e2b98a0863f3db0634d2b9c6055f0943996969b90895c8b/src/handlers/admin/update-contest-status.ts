/**
 * PATCH /admin/contests/:id/status
 * Advance a contest through its lifecycle state machine:
 *   draft → open → active → scoring → finalized
 *
 * Transitions:
 *   draft    → open      (opens registration)
 *   open     → active    (contest starts, no more registrations)
 *   active   → scoring   (test window closed, calculating results)
 *   scoring  → finalized (percentiles published)
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getPrismaClient } from '../../lib/database';

const VALID_TRANSITIONS: Record<string, string[]> = {
  draft:   ['open'],
  open:    ['active', 'draft'],   // can revert to draft if needed
  active:  ['scoring'],
  scoring: ['finalized'],
};

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const contestId = event.pathParameters?.id;
    if (!contestId) return err(400, 'contestId is required');
    if (!event.body) return err(400, 'Request body is required');

    const { status: newStatus } = JSON.parse(event.body);
    if (!newStatus) return err(400, 'status is required');

    const prisma = await getPrismaClient();

    const contests = await prisma.$queryRawUnsafe(
      `SELECT id, status FROM contests WHERE id = $1::uuid`,
      contestId
    ) as any[];

    if (!contests.length) return err(404, 'Contest not found');

    const current = contests[0].status as string;
    const allowed = VALID_TRANSITIONS[current] ?? [];

    if (!allowed.includes(newStatus)) {
      return err(409, `Cannot transition from '${current}' to '${newStatus}'. Allowed: ${allowed.join(', ') || 'none'}`);
    }

    await prisma.$executeRawUnsafe(
      `UPDATE contests SET status = $1, updated_at = NOW() WHERE id = $2::uuid`,
      newStatus,
      contestId
    );

    console.log(`Contest ${contestId} transitioned: ${current} → ${newStatus}`);

    return ok(200, { success: true, contestId, previousStatus: current, status: newStatus });
  } catch (error) {
    console.error('update-contest-status error:', error);
    return err(500, 'Internal server error');
  }
}

function ok(statusCode: number, data: object): APIGatewayProxyResult {
  return { statusCode, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(data) };
}

function err(statusCode: number, message: string): APIGatewayProxyResult {
  return { statusCode, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ success: false, error: message }) };
}
