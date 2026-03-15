/**
 * List Students Handler
 *
 * Returns all student profiles linked to a parent account.
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
    const parentId = event.pathParameters?.parentId || event.queryStringParameters?.parentId;

    if (!parentId) {
      return errorResponse(400, 'parentId is required');
    }

    const prisma = await getPrismaClient();

    // Verify parent exists
    const parent = await prisma.user.findUnique({
      where: { id: parentId },
    });

    if (!parent || parent.role !== 'parent') {
      return errorResponse(403, 'Invalid parent account');
    }

    // Fetch all students linked to this parent
    const students = await prisma.student.findMany({
      where: { parentId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const result = students.map((s: any) => {
      const username = s.user.email.replace('@student.edulens.local', '');

      return {
        id: s.id,
        userId: s.userId,
        name: s.user.name,
        username,
        gradeLevel: s.gradeLevel,
        dateOfBirth: s.dateOfBirth.toISOString(),
        parentId: s.parentId,
        createdAt: s.createdAt.toISOString(),
        testsCompleted: 0,
      };
    });

    return successResponse({
      success: true,
      students: result,
    });
  } catch (error) {
    console.error('List students error:', error);
    return errorResponse(500, 'Internal server error');
  }
}
