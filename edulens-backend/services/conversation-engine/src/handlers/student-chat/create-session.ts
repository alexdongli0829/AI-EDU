/**
 * Create Student Chat Session
 * Starts a Socratic explanation session for a student reviewing a wrong answer.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { getPrismaClient } from '../../lib/database';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    if (!event.body) return error(400, 'Request body is required');

    const { studentId, questionId, sessionResponseId } = JSON.parse(event.body);
    if (!studentId) return error(400, 'studentId is required');

    const prisma = await getPrismaClient();

    const sessionId = uuidv4();
    await prisma.$executeRawUnsafe(
      `INSERT INTO chat_sessions (id, student_id, role, agent_state, started_at)
       VALUES ($1::uuid, $2::uuid, 'student_tutor', 'idle', NOW())`,
      sessionId,
      studentId
    );

    // Store question context in metadata via a first system message
    if (questionId) {
      const metaId = uuidv4();
      const metaContent = JSON.stringify({ questionId, sessionResponseId });
      await prisma.$executeRawUnsafe(
        `INSERT INTO chat_messages (id, session_id, role, content, timestamp)
         VALUES ($1::uuid, $2::uuid, 'system', $3, NOW())`,
        metaId, sessionId, metaContent
      );
    }

    return success(201, {
      success: true,
      sessionId,
      message: 'Student chat session created',
    });
  } catch (err) {
    console.error('Create student session error:', err);
    return error(500, 'Internal server error');
  }
}

function success(statusCode: number, data: object): APIGatewayProxyResult {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(data),
  };
}

function error(statusCode: number, message: string): APIGatewayProxyResult {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ success: false, error: message }),
  };
}
