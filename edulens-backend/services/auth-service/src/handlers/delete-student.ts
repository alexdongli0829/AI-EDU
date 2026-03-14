/**
 * Delete Student Handler
 *
 * Allows a parent to delete a student profile they own.
 * Deletes both the Student record and the associated User record.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getPrismaClient } from '../lib/database';

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

    const prisma = await getPrismaClient();

    // Verify the student belongs to this parent
    const student = await prisma.student.findUnique({
      where: { id: studentId },
    });

    if (!student) {
      return errorResponse(404, 'Student not found');
    }

    if (student.parentId !== parentId) {
      return errorResponse(403, 'You can only delete your own children\'s profiles');
    }

    // Delete user (cascades to student due to onDelete: Cascade in schema)
    await prisma.user.delete({
      where: { id: student.userId },
    });

    console.log('Student deleted:', { studentId, parentId });

    return successResponse({
      success: true,
      message: 'Student profile deleted successfully',
    });
  } catch (error) {
    console.error('Delete student error:', error);
    return errorResponse(500, 'Internal server error');
  }
}
