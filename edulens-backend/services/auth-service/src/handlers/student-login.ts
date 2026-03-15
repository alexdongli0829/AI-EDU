/**
 * Student Login Handler
 *
 * Authenticates a student using their username (not email) and password.
 * Internally maps username to the student email pattern.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getDb } from '../lib/database';
import { verifyPassword } from '../lib/password';
import { generateToken } from '../lib/jwt';

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
  console.log('Student login request:', { path: event.path, method: event.httpMethod });

  try {
    if (!event.body) {
      return errorResponse(400, 'Request body is required');
    }

    const { username, password } = JSON.parse(event.body);

    if (!username || !password) {
      return errorResponse(400, 'Username and password are required');
    }

    const db = await getDb();

    const studentEmail = `${username.toLowerCase()}@student.edulens.local`;

    const users = await db`
      SELECT id, email, name, role, password_hash, created_at
      FROM users WHERE email = ${studentEmail} LIMIT 1
    `;

    if (users.length === 0 || users[0].role !== 'student') {
      return errorResponse(401, 'Invalid username or password');
    }

    const user = users[0];
    const isPasswordValid = await verifyPassword(password, user.password_hash);
    if (!isPasswordValid) {
      return errorResponse(401, 'Invalid username or password');
    }

    const studentProfiles = await db`
      SELECT id, user_id, grade_level, date_of_birth, parent_id, created_at
      FROM students WHERE user_id = ${user.id} LIMIT 1
    `;

    if (studentProfiles.length === 0) {
      return errorResponse(500, 'Student profile not found');
    }

    const sp = studentProfiles[0];
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: 'student',
    });

    console.log('Student login successful:', { userId: user.id, studentId: sp.id });

    return successResponse({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: new Date(user.created_at).toISOString(),
      },
      student: {
        id: sp.id,
        userId: sp.user_id,
        gradeLevel: sp.grade_level,
        dateOfBirth: new Date(sp.date_of_birth).toISOString(),
        parentId: sp.parent_id,
        createdAt: new Date(sp.created_at).toISOString(),
      },
    });
  } catch (error) {
    console.error('Student login error:', error);
    return errorResponse(500, 'Internal server error');
  }
}
