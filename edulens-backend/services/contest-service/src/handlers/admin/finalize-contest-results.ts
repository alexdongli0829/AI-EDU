/**
 * POST /admin/contests/:id/finalize
 * Calculates and persists percentile ranks for all registered participants.
 * Called either manually or triggered by EventBridge after scoring window closes.
 *
 * Algorithm:
 *   1. Load all contest_results for this contest (must be in 'scoring' status)
 *   2. Sort by raw_score DESC
 *   3. Assign percentile_rank = (rank - 1) / total * 100  (higher = better)
 *   4. Persist back to contest_results
 *   5. Transition contest status → finalized
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getPrismaClient } from '../../lib/database';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const contestId = event.pathParameters?.id
      ?? (event.body ? JSON.parse(event.body).contestId : undefined);

    if (!contestId) return err(400, 'contestId is required');

    const prisma = await getPrismaClient();

    // Verify contest is in 'scoring' status
    const contests = await prisma.$queryRawUnsafe(
      `SELECT id, status FROM contests WHERE id = $1::uuid`,
      contestId
    ) as any[];

    if (!contests.length) return err(404, 'Contest not found');
    if (contests[0].status !== 'scoring') {
      return err(409, `Contest must be in 'scoring' status to finalize (current: ${contests[0].status})`);
    }

    // Load all results ordered by score
    const results = await prisma.$queryRawUnsafe(`
      SELECT id, student_id, raw_score
      FROM contest_results
      WHERE contest_id = $1::uuid
      ORDER BY raw_score DESC NULLS LAST
    `, contestId) as any[];

    if (!results.length) {
      return ok(200, { success: true, contestId, participantCount: 0, message: 'No results to finalize' });
    }

    const total = results.length;

    // Assign percentile ranks (tied scores get the same percentile)
    let rank = 1;
    const updates: Array<{ id: string; percentile: number; rank: number }> = [];

    for (let i = 0; i < results.length; i++) {
      // Ties: same score gets same rank
      if (i > 0 && results[i].raw_score === results[i - 1].raw_score) {
        updates.push({ id: results[i].id, percentile: updates[i - 1].percentile, rank: updates[i - 1].rank });
      } else {
        const percentile = total === 1 ? 50 : Math.round(((total - rank) / (total - 1)) * 100);
        updates.push({ id: results[i].id, percentile, rank });
        rank = i + 2; // next rank is i+2 (1-based, skipping tied entries)
      }
    }

    // Batch update percentile ranks
    for (const u of updates) {
      await prisma.$executeRawUnsafe(
        `UPDATE contest_results
         SET percentile_rank = $1, rank = $2, finalized_at = NOW()
         WHERE id = $3::uuid`,
        u.percentile,
        u.rank,
        u.id
      );
    }

    // Transition to finalized
    await prisma.$executeRawUnsafe(
      `UPDATE contests SET status = 'finalized', updated_at = NOW() WHERE id = $1::uuid`,
      contestId
    );

    console.log(`Contest ${contestId} finalized — ${total} participants ranked`);

    return ok(200, {
      success: true,
      contestId,
      participantCount: total,
      status: 'finalized',
    });
  } catch (error) {
    console.error('finalize-contest-results error:', error);
    return err(500, 'Internal server error');
  }
}

function ok(statusCode: number, data: object): APIGatewayProxyResult {
  return { statusCode, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(data) };
}

function err(statusCode: number, message: string): APIGatewayProxyResult {
  return { statusCode, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ success: false, error: message }) };
}
