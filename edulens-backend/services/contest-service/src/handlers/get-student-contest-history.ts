/**
 * GET /students/:studentId/contest-history
 * Returns all contest results for a student with percentile trend.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { query } from '../lib/database';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const studentId = event.pathParameters?.studentId;
    if (!studentId) return err(400, 'studentId is required');

    const rows = await query(`
      SELECT
        cr.contest_id,
        c.title AS contest_title,
        c.stage_id,
        c.window_start_at,
        cr.score,
        cr.rank,
        cr.percentile,
        cr.scored_at,
        c.total_participants,
        COALESCE(array_length(c.question_ids, 1), 0) AS question_count
      FROM contest_results cr
      JOIN contests c ON c.id = cr.contest_id
      WHERE cr.student_id = $1::uuid
      ORDER BY c.window_start_at DESC
      LIMIT 50
    `, studentId) as any[];

    const history = rows.map(r => ({
      contestId: r.contest_id,
      contestTitle: r.contest_title,
      stageId: r.stage_id,
      date: r.window_start_at,
      score: r.score,
      totalQuestions: r.question_count,
      rank: r.rank,
      totalParticipants: parseInt(r.total_participants ?? '0'),
      percentile: parseFloat(r.percentile ?? '0'),
      scoredAt: r.scored_at,
    }));

    // Compute aggregate stats
    const contestsCount = history.length;
    const avgPercentile = contestsCount > 0
      ? Math.round(history.reduce((s, r) => s + r.percentile, 0) / contestsCount * 10) / 10
      : 0;
    const bestPercentile = contestsCount > 0
      ? Math.max(...history.map(r => r.percentile))
      : 0;
    const percentileTrend = history.slice(0, 5).map(r => Math.round(r.percentile));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        success: true,
        studentId,
        history,
        stats: {
          contestsParticipated: contestsCount,
          avgPercentile,
          bestPercentile,
          percentileTrend: percentileTrend.reverse(), // oldest first
        },
      }),
    };
  } catch (error) {
    console.error('get-student-contest-history error:', error);
    return err(500, 'Internal server error');
  }
}

function err(statusCode: number, message: string): APIGatewayProxyResult {
  return { statusCode, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ success: false, error: message }) };
}
