/**
 * POST /sessions/{sessionId}/review
 * Records a student's question-review interaction:
 *   - reattemptAnswer: student tried to answer again
 *   - incrementAi: student sent a message to the AI tutor
 *   - errorClassification: AI-derived classification of root cause
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getPrismaClient } from '../lib/database';

function ok(data: object): APIGatewayProxyResult {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Credentials': true },
    body: JSON.stringify(data),
  };
}

function err(code: number, msg: string): APIGatewayProxyResult {
  return {
    statusCode: code,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Credentials': true },
    body: JSON.stringify({ success: false, error: msg }),
  };
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const sessionId = event.pathParameters?.sessionId;
    if (!sessionId) return err(400, 'sessionId is required');

    if (!event.body) return err(400, 'Request body is required');

    const {
      questionId,
      reattemptAnswer,
      incrementAi,
      errorClassification,
    }: {
      questionId: string;
      reattemptAnswer?: string;
      incrementAi?: boolean;
      errorClassification?: string;
    } = JSON.parse(event.body);

    if (!questionId) return err(400, 'questionId is required');

    const prisma = await getPrismaClient();

    // Verify the session_response exists
    const existing = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id, reattempt_count, ai_interactions FROM session_responses
       WHERE session_id = $1::uuid AND question_id = $2::uuid`,
      sessionId, questionId
    );

    if (!existing.length) return err(404, 'Session response not found');

    // Build SET clauses dynamically
    const sets: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (reattemptAnswer !== undefined) {
      // Check answer correctness
      const qResult = await prisma.$queryRawUnsafe<any[]>(
        `SELECT options, correct_answer FROM questions WHERE id = $1::uuid`,
        questionId
      );

      let isCorrect = false;
      if (qResult.length > 0) {
        const q = qResult[0];
        const rawOpts: any[] = Array.isArray(q.options) ? q.options : JSON.parse(q.options || '[]');
        const matched = rawOpts.find((o: any) =>
          (typeof o === 'string' ? o : o.text || '').toLowerCase().trim() === reattemptAnswer.toLowerCase().trim()
        );
        isCorrect = matched
          ? (typeof matched === 'string'
              ? matched.toLowerCase() === (q.correct_answer || '').toLowerCase()
              : !!matched.isCorrect)
          : false;
      }

      sets.push(`reattempt_count = reattempt_count + 1`);
      // Return correctness in response
      const updateQ = `UPDATE session_responses SET reattempt_count = reattempt_count + 1 WHERE session_id = $1::uuid AND question_id = $2::uuid`;
      await prisma.$executeRawUnsafe(updateQ, sessionId, questionId);

      const newCount = (existing[0].reattempt_count || 0) + 1;
      // Continue to handle other fields below
      if (incrementAi) {
        await prisma.$executeRawUnsafe(
          `UPDATE session_responses SET ai_interactions = ai_interactions + 1 WHERE session_id = $1::uuid AND question_id = $2::uuid`,
          sessionId, questionId
        );
      }
      if (errorClassification) {
        await prisma.$executeRawUnsafe(
          `UPDATE session_responses SET error_classification = $1 WHERE session_id = $2::uuid AND question_id = $3::uuid`,
          errorClassification, sessionId, questionId
        );
      }
      return ok({ success: true, isCorrect, reattemptCount: newCount });
    }

    if (incrementAi) {
      await prisma.$executeRawUnsafe(
        `UPDATE session_responses SET ai_interactions = ai_interactions + 1 WHERE session_id = $1::uuid AND question_id = $2::uuid`,
        sessionId, questionId
      );
    }

    if (errorClassification) {
      await prisma.$executeRawUnsafe(
        `UPDATE session_responses SET error_classification = $1 WHERE session_id = $2::uuid AND question_id = $3::uuid`,
        errorClassification, sessionId, questionId
      );
    }

    return ok({ success: true });
  } catch (error) {
    console.error('record-review error:', error);
    return err(500, 'Internal server error');
  }
}
