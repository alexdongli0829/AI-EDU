/**
 * POST /contests/:id/results
 * Records a student's contest test result.
 * Called by the test-engine after a contest session completes (via SQS or direct invoke).
 *
 * Body: { studentId, sessionId, rawScore, totalQuestions, timeTakenSeconds }
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { getDb, query } from '../lib/database';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    // Support both API Gateway and SQS invocation
    let contestId: string | undefined;
    let body: any;

    if ('Records' in (event as any)) {
      // SQS trigger
      body = JSON.parse((event as any).Records[0].body);
      contestId = body.contestId;
    } else {
      contestId = event.pathParameters?.id;
      body = event.body ? JSON.parse(event.body) : {};
    }

    if (!contestId) return err(400, 'contestId is required');

    const { studentId, sessionId, rawScore, totalQuestions, timeTakenSeconds } = body;
    if (!studentId || rawScore == null) return err(400, 'studentId and rawScore are required');

    const db = await getDb();

    // Contest must be active
    const contests = await query(
      `SELECT id, status FROM contests WHERE id = $1::uuid`,
      contestId
    ) as any[];

    if (!contests.length) return err(404, 'Contest not found');
    if (contests[0].status !== 'active') {
      return err(409, `Contest is not active (status: ${contests[0].status})`);
    }

    // Verify student is registered
    const reg = await query(
      `SELECT id FROM contest_registrations WHERE contest_id = $1::uuid AND student_id = $2::uuid`,
      contestId, studentId
    ) as any[];

    if (!reg.length) return err(403, 'Student is not registered for this contest');

    // Upsert result (allow re-submission; best score semantics could be applied here)
    const resultId = uuidv4();
    await query(
      `INSERT INTO contest_results
         (id, contest_id, student_id, session_id, raw_score, total_questions, time_taken_seconds, submitted_at)
       VALUES
         ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7, NOW())
       ON CONFLICT (contest_id, student_id)
       DO UPDATE SET
         raw_score = EXCLUDED.raw_score,
         session_id = EXCLUDED.session_id,
         total_questions = EXCLUDED.total_questions,
         time_taken_seconds = EXCLUDED.time_taken_seconds,
         submitted_at = NOW()`,
      resultId,
      contestId,
      studentId,
      sessionId || null,
      rawScore,
      totalQuestions || null,
      timeTakenSeconds || null
    );

    return ok(201, { success: true, contestId, studentId, rawScore });
  } catch (error) {
    console.error('submit-contest-result error:', error);
    return err(500, 'Internal server error');
  }
}

function ok(statusCode: number, data: object): APIGatewayProxyResult {
  return { statusCode, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(data) };
}

function err(statusCode: number, message: string): APIGatewayProxyResult {
  return { statusCode, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ success: false, error: message }) };
}
