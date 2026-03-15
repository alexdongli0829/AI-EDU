/**
 * POST /tests/sessions/:id/complete
 * Complete a test session, calculate score, and publish test_completed event.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { SessionManager } from '../services/session-manager';
import { TimerService } from '../services/timer-service';
import { AppError, formatErrorResponse } from '@edulens/common';

const sessionManager = new SessionManager();
const timerService = new TimerService();

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const sessionId = event.pathParameters?.id;
    if (!sessionId) return bad('sessionId is required');

    const { session, score } = await sessionManager.completeSession(sessionId);
    await timerService.stopTimer(sessionId);

    return ok(200, {
      success: true,
      data: {
        sessionId: session.id,
        status: session.status,
        score,
        completedAt: session.completedAt,
        totalQuestions: session.totalQuestions,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      return ok(error.statusCode, { success: false, error: formatErrorResponse(error).error });
    }
    console.error('complete-session error:', error);
    return ok(500, { success: false, error: { message: 'Internal server error' } });
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
