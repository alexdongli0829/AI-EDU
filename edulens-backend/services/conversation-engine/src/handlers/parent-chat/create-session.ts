/**
 * Create Parent Chat Session Handler
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { getPrismaClient } from '../../lib/database';

function successResponse(data: any): APIGatewayProxyResult {
  return {
    statusCode: 201,
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
  console.log('Create parent chat session:', { path: event.path, method: event.httpMethod });

  try {
    if (!event.body) {
      return errorResponse(400, 'Request body is required');
    }

    const { parentId, studentId } = JSON.parse(event.body);

    if (!parentId) {
      return errorResponse(400, 'parentId is required');
    }

    const prisma = await getPrismaClient();

    // Create chat session
    const sessionId = uuidv4();

    await prisma.$executeRawUnsafe(
      `INSERT INTO chat_sessions (id, user_id, student_id, agent_type, status, started_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      sessionId,
      parentId,
      studentId || null,
      'parent_advisor',
      'active'
    );

    console.log('Parent chat session created:', sessionId);

    return successResponse({
      success: true,
      sessionId,
      message: 'Chat session created successfully',
    });
  } catch (error) {
    console.error('Create parent chat session error:', error);
    return errorResponse(500, 'Internal server error');
  }
}
