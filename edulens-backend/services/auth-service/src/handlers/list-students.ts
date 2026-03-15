/**
 * List Students Handler
 *
 * Returns all student profiles linked to a parent account.
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
    const parentId = event.pathParameters?.parentId || event.queryStringParameters?.parentId;

    if (!parentId) {
      return errorResponse(400, 'parentId is required');
    }

    const db = await getDb();

    const parents = await db`SELECT id, role FROM users WHERE id = ${parentId} LIMIT 1`;
    if (parents.length === 0 || parents[0].role !== 'parent') {
      return errorResponse(403, 'Invalid parent account');
    }

    const rows = await db`
      SELECT s.id, s.user_id, s.grade_level, s.date_of_birth, s.parent_id, s.created_at,
             u.email, u.name
      FROM students s
      JOIN users u ON u.id = s.user_id
      WHERE s.parent_id = ${parentId}
      ORDER BY s.created_at DESC
    `;

    const students = rows.map((s: any) => {
      const username = s.email.replace('@student.edulens.local', '');
      return {
        id: s.id,
        userId: s.user_id,
        name: s.name,
        username,
        gradeLevel: s.grade_level,
        dateOfBirth: new Date(s.date_of_birth).toISOString(),
        parentId: s.parent_id,
        createdAt: new Date(s.created_at).toISOString(),
        testsCompleted: 0,
      };
    });

    return successResponse({ success: true, students });
  } catch (error) {
    console.error('List students error:', error);
    return errorResponse(500, 'Internal server error');
  }
}
