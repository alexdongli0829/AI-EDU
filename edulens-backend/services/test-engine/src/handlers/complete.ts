/**
 * POST /sessions/:sessionId/end
 * End a test session early or when completed; calculate final score.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { query } from '../lib/database';

const eventBridge = new EventBridgeClient({ region: process.env.AWS_REGION || 'ap-southeast-2' });

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const sessionId = event.pathParameters?.sessionId;
    if (!sessionId) return bad('sessionId is required');

    const sessions = await query(
      `SELECT id, student_id, test_id, status, question_count, total_items, correct_count, scaled_score
       FROM test_sessions WHERE id = $1::uuid`,
      sessionId
    ) as any[];

    if (!sessions.length) return ok(404, { success: false, error: 'Session not found' });

    const session = sessions[0];

    if (session.status === 'completed') {
      return ok(200, {
        success: true,
        sessionId: session.id,
        status: session.status,
        scaledScore: session.scaled_score,
        totalItems: session.total_items,
        correctCount: session.correct_count,
      });
    }

    // Count responses
    const responses = await query(
      `SELECT is_correct FROM session_responses WHERE session_id = $1::uuid`,
      sessionId
    ) as any[];

    const answeredCount = responses.length;
    const correctCount = responses.filter((r: any) => r.is_correct).length;
    const totalQ = parseInt(session.question_count) || answeredCount || 1;
    const rawScore = totalQ > 0 ? (correctCount / totalQ) * 100 : 0;
    const scaledScore = Math.round(rawScore);

    await query(
      `UPDATE test_sessions
       SET status = 'completed', completed_at = NOW(), scaled_score = $1, raw_score = $2,
           total_items = $3, correct_count = $4
       WHERE id = $5::uuid`,
      scaledScore, rawScore / 100, answeredCount, correctCount, sessionId
    );

    // Publish EventBridge event (non-fatal)
    try {
      await eventBridge.send(new PutEventsCommand({
        Entries: [{
          EventBusName: process.env.EVENT_BUS_NAME || 'edulens-event-bus',
          Source: 'test-engine',
          DetailType: 'test_completed',
          Detail: JSON.stringify({
            sessionId: session.id,
            studentId: session.student_id,
            testId: session.test_id,
            score: scaledScore,
            completedAt: new Date().toISOString(),
          }),
        }],
      }));
    } catch (ebErr) {
      console.error('Failed to publish test_completed event:', ebErr);
    }

    return ok(200, {
      success: true,
      sessionId: session.id,
      status: 'completed',
      scaledScore,
      totalItems: answeredCount,
      correctCount,
    });
  } catch (error) {
    console.error('end-session error:', error);
    return ok(500, { success: false, error: 'Internal server error' });
  }
}

function ok(statusCode: number, body: object): APIGatewayProxyResult {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(body),
  };
}

function bad(message: string): APIGatewayProxyResult {
  return ok(400, { success: false, error: { message } });
}
