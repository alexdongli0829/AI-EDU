/**
 * GET /tests/sessions/:id/results
 * Return detailed test results with per-question breakdown and skill analysis.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { SessionManager } from '../services/session-manager';
import { AppError, formatErrorResponse } from '@edulens/common';

const sessionManager = new SessionManager();

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const sessionId = event.pathParameters?.id;
    if (!sessionId) return bad('sessionId is required');

    const results = await sessionManager.getResults(sessionId);

    return ok(200, { success: true, data: results });
  } catch (error) {
    if (error instanceof AppError) {
      return ok(error.statusCode, { success: false, error: formatErrorResponse(error).error });
    }
    console.error('get-results error:', error);
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
