/**
 * Get Parent Chat Messages Handler
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
    body: JSON.stringify({
      success: false,
      error: message,
    }),
  };
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  console.log('Get parent chat messages:', { path: event.path, method: event.httpMethod });

  try {
    const sessionId = event.pathParameters?.sessionId;
    if (!sessionId) {
      return errorResponse(400, 'sessionId is required');
    }

    const limit = parseInt(event.queryStringParameters?.limit || '50');
    const offset = parseInt(event.queryStringParameters?.offset || '0');

    // Get messages
    const messages = await query(
      `SELECT id, role, content, timestamp
       FROM chat_messages
       WHERE session_id = $1
       ORDER BY timestamp ASC
       LIMIT $2 OFFSET $3`,
      sessionId,
      limit,
      offset
    ) as any[];

    return successResponse({
      success: true,
      messages: messages.map((msg: any) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Get parent chat messages error:', error);
    return errorResponse(500, 'Internal server error');
  }
}
