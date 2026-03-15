/**
 * Delete Student Handler
 *
 * Allows a parent to delete a student profile they own.
 * Deletes both the Student record and the associated User record.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getDb } from '../lib/database';

function successResponse(data: object): APIGatewayProxyResult {
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
    if (!event.body) {
      return errorResponse(400, 'Request body is required');
    }

    const { studentId, parentId } = JSON.parse(event.body);

    if (!studentId || !parentId) {
      return errorResponse(400, 'studentId and parentId are required');
    }

    const db = await getDb();

    const students = await db`SELECT id, user_id, parent_id FROM students WHERE id = ${studentId} LIMIT 1`;
    if (students.length === 0) {
      return errorResponse(404, 'Student not found');
    }

    const student = students[0];
    if (student.parent_id !== parentId) {
      return errorResponse(403, "You can only delete your own children's profiles");
    }

    // Delete user — cascades to students due to ON DELETE CASCADE in schema
    await db`DELETE FROM users WHERE id = ${student.user_id}`;

    console.log('Student deleted:', { studentId, parentId });

    return successResponse({ success: true, message: 'Student profile deleted successfully' });
  } catch (error) {
    console.error('Delete student error:', error);
    return errorResponse(500, 'Internal server error');
  }
}
