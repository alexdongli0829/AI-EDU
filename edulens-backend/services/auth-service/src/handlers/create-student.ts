/**
 * Create Student Handler
 *
 * Called by a parent to create a student account linked to their parent account.
 * Creates both a User (role=student) and a Student profile with parentId.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../lib/database';
import { hashPassword, validatePasswordStrength } from '../lib/password';

interface CreateStudentRequest {
  parentId: string;
  name: string;
  username: string;
  password: string;
  gradeLevel: number;
  dateOfBirth: string;
}

function successResponse(statusCode: number, data: object): APIGatewayProxyResult {
  return {
    statusCode,
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
  console.log('Create student request:', { path: event.path, method: event.httpMethod });

  try {
    if (!event.body) {
      return errorResponse(400, 'Request body is required');
    }

    const request: CreateStudentRequest = JSON.parse(event.body);

    if (!request.parentId || !request.name || !request.username || !request.password) {
      return errorResponse(400, 'parentId, name, username, and password are required');
    }

    if (!request.gradeLevel || request.gradeLevel < 1 || request.gradeLevel > 12) {
      return errorResponse(400, 'gradeLevel must be between 1 and 12');
    }

    if (!request.dateOfBirth) {
      return errorResponse(400, 'dateOfBirth is required');
    }

    const passwordValidation = validatePasswordStrength(request.password);
    if (!passwordValidation.valid) {
      return errorResponse(400, passwordValidation.message || 'Invalid password');
    }

    const db = await getDb();

    const parents = await db`SELECT id, role FROM users WHERE id = ${request.parentId} LIMIT 1`;
    if (parents.length === 0 || parents[0].role !== 'parent') {
      return errorResponse(403, 'Invalid parent account');
    }

    const studentEmail = `${request.username.toLowerCase()}@student.edulens.local`;

    const existing = await db`SELECT id FROM users WHERE email = ${studentEmail} LIMIT 1`;
    if (existing.length > 0) {
      return errorResponse(409, 'Username already taken. Please choose a different username.');
    }

    const passwordHash = await hashPassword(request.password);
    const userId = uuidv4();
    const studentId = uuidv4();

    await db`
      INSERT INTO users (id, email, name, role, password_hash, created_at, updated_at)
      VALUES (${userId}, ${studentEmail}, ${request.name}, 'student', ${passwordHash}, NOW(), NOW())
    `;

    await db`
      INSERT INTO students (id, user_id, grade_level, date_of_birth, parent_id, created_at, updated_at)
      VALUES (${studentId}, ${userId}, ${request.gradeLevel}, ${request.dateOfBirth}::date, ${request.parentId}, NOW(), NOW())
    `;

    console.log('Student created:', { userId, studentId, parentId: request.parentId });

    return successResponse(201, {
      success: true,
      student: {
        id: studentId,
        userId,
        name: request.name,
        username: request.username.toLowerCase(),
        gradeLevel: request.gradeLevel,
        dateOfBirth: request.dateOfBirth,
        parentId: request.parentId,
        createdAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Create student error:', error);

    if (error instanceof Error && error.message.includes('unique')) {
      return errorResponse(409, 'Username already taken');
    }

    return errorResponse(500, 'Internal server error');
  }
}
