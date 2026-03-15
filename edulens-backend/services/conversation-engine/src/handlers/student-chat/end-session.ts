/**
 * End Student Chat Session Handler
 *
 * Marks the student tutor session as ended.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { query } from '../../lib/database';

function successResponse(data: any): APIGatewayProxyResult {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
    },
    body: JSON.stringify(data),
  };
}

function errorResponse(statusCode: number, message: string): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
    },
    body: JSON.stringify({ success: false, error: message }),
  };
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const sessionId = event.pathParameters?.sessionId;
    if (!sessionId) return errorResponse(400, 'sessionId is required');

    await query(
      `UPDATE chat_sessions
       SET status = 'ended', ended_at = NOW(), agent_state = 'idle'
       WHERE id = $1::uuid`,
      sessionId
    );

    return successResponse({ success: true, message: 'Student chat session ended' });
  } catch (error) {
    console.error('End student chat session error:', error);
    return errorResponse(500, 'Internal server error');
  }
}
