/**
 * GET /contests/:id/results/:studentId
 * Returns a student's contest result including percentile rank.
 * Only available after contest is 'finalized'.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getPrismaClient } from '../lib/database';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const contestId = event.pathParameters?.id;
    const studentId = event.pathParameters?.studentId;

    if (!contestId || !studentId) return err(400, 'contestId and studentId are required');

    const prisma = await getPrismaClient();

    // Verify contest exists and is finalized
    const contests = await prisma.$queryRawUnsafe(
      `SELECT id, title, status FROM contests WHERE id = $1::uuid`,
      contestId
    ) as any[];

    if (!contests.length) return err(404, 'Contest not found');

    const contest = contests[0];
    if (contest.status !== 'finalized') {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          success: true,
          contestId,
          contestTitle: contest.title,
          status: contest.status,
          message: 'Results are not yet available. Contest is still being processed.',
        }),
      };
    }

    // Load the student's result
    const results = await prisma.$queryRawUnsafe(`
      SELECT
        cr.raw_score,
        cr.total_questions,
        cr.time_taken_seconds,
        cr.percentile_rank,
        cr.rank,
        cr.finalized_at,
        (SELECT COUNT(*) FROM contest_results WHERE contest_id = $1::uuid) AS total_participants
      FROM contest_results cr
      WHERE cr.contest_id = $1::uuid AND cr.student_id = $2::uuid
    `, contestId, studentId) as any[];

    if (!results.length) return err(404, 'No result found for this student in this contest');

    const r = results[0];

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        success: true,
        contestId,
        contestTitle: contest.title,
        studentId,
        result: {
          rawScore: r.raw_score,
          totalQuestions: r.total_questions,
          timeTakenSeconds: r.time_taken_seconds,
          percentileRank: r.percentile_rank,
          rank: r.rank,
          totalParticipants: parseInt(r.total_participants ?? '0'),
          finalizedAt: r.finalized_at,
        },
      }),
    };
  } catch (error) {
    console.error('get-contest-results error:', error);
    return err(500, 'Internal server error');
  }
}

function err(statusCode: number, message: string): APIGatewayProxyResult {
  return { statusCode, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ success: false, error: message }) };
}
