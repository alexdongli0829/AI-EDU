/**
 * Get Student Chat Messages Handler
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

    const limit  = parseInt(event.queryStringParameters?.limit  || '50');
    const offset = parseInt(event.queryStringParameters?.offset || '0');

    const messages = await query(
      `SELECT id, role, content, timestamp
       FROM chat_messages
       WHERE session_id = $1::uuid AND role != 'system'
       ORDER BY timestamp ASC
       LIMIT $2 OFFSET $3`,
      sessionId, limit, offset
    ) as any[];

    return successResponse({
      success: true,
      messages: messages.map((msg: any) => ({
        id:        msg.id,
        role:      msg.role,
        content:   msg.content,
        timestamp: msg.timestamp instanceof Date ? msg.timestamp.toISOString() : msg.timestamp,
      })),
    });
  } catch (error) {
    console.error('Get student chat messages error:', error);
    return errorResponse(500, 'Internal server error');
  }
}
