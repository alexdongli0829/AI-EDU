/**
 * POST /tests/sessions
 * Create a new test session and initialise the timer.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { SessionManager } from '../services/session-manager';
import { TimerService } from '../services/timer-service';
import { AppError, formatErrorResponse } from '@edulens/common';

const sessionManager = new SessionManager();
const timerService = new TimerService();

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    if (!event.body) return bad('Request body is required');

    const { studentId, testId } = JSON.parse(event.body);
    if (!studentId || !testId) return bad('studentId and testId are required');

    const session = await sessionManager.createSession(studentId, testId);

    // Retrieve the test's time limit to initialise the Redis timer
    const { prisma } = await import('@edulens/database');
    const test = await prisma.test.findUnique({
      where: { id: testId },
      select: { timeLimit: true },
    });
    if (test) {
      await timerService.initializeTimer(session.id, test.timeLimit);
    }

    return ok(201, {
      success: true,
      data: {
        sessionId: session.id,
        studentId: session.studentId,
        testId: session.testId,
        status: session.status,
        timeRemaining: session.timeRemaining,
        totalQuestions: session.totalQuestions,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      return ok(error.statusCode, { success: false, error: formatErrorResponse(error).error });
    }
    console.error('create-session error:', error);
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
