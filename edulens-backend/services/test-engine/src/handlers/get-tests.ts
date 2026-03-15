/**
 * Get Tests Handler - List available tests
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getDb, query } from '../lib/database';

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
  console.log('Get tests:', { path: event.path, method: event.httpMethod });

  try {
    const subject = event.queryStringParameters?.subject;
    const gradeLevel = event.queryStringParameters?.gradeLevel 
      ? parseInt(event.queryStringParameters.gradeLevel) 
      : null;
    const limit = parseInt(event.queryStringParameters?.limit || '20');
    const offset = parseInt(event.queryStringParameters?.offset || '0');

    const db = await getDb();

    // Build query conditions
    let whereClause = '';
    const params: any[] = [];
    let paramIndex = 1;

    if (subject) {
      whereClause += ` AND subject = $${paramIndex}`;
      params.push(subject);
      paramIndex++;
    }

    if (gradeLevel !== null) {
      whereClause += ` AND grade_level = $${paramIndex}`;
      params.push(gradeLevel);
      paramIndex++;
    }

    // Add limit and offset
    params.push(limit, offset);

    // Get tests
    const tests = await query(
      `SELECT 
        id, 
        title, 
        description, 
        subject, 
        grade_level, 
        time_limit, 
        question_count, 
        created_at
       FROM tests 
       WHERE 1=1 ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      ...params
    ) as any[];

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as total FROM tests WHERE 1=1 ${whereClause}`,
      ...params.slice(0, -2) // Remove limit and offset from count query
    ) as any[];

    const totalCount = parseInt(countResult[0]?.total || '0');

    return successResponse({
      success: true,
      tests: tests.map(test => ({
        id: test.id,
        title: test.title,
        description: test.description,
        subject: test.subject,
        gradeLevel: test.grade_level,
        timeLimit: test.time_limit,
        questionCount: test.question_count,
        createdAt: test.created_at
      })),
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount
      }
    });
  } catch (error) {
    console.error('Get tests error:', error);
    return errorResponse(500, 'Internal server error');
  }
}