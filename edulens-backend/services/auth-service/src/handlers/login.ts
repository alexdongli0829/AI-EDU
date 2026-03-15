/**
 * Login Handler
 *
 * Authenticates user and returns JWT token
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getDb } from '../lib/database';
import { verifyPassword } from '../lib/password';
import { generateToken } from '../lib/jwt';
import { LoginRequest, LoginResponse, ErrorResponse } from '../types';

function successResponse(data: LoginResponse): APIGatewayProxyResult {
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
  const response: ErrorResponse = { success: false, error: message, statusCode };
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
    },
    body: JSON.stringify(response),
  };
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  console.log('Login request:', { path: event.path, method: event.httpMethod });

  try {
    if (!event.body) {
      return errorResponse(400, 'Request body is required');
    }

    const request: LoginRequest = JSON.parse(event.body);

    if (!request.email || !request.password) {
      return errorResponse(400, 'Email and password are required');
    }

    const db = await getDb();

    const users = await db`
      SELECT id, email, name, role, password_hash, created_at
      FROM users WHERE email = ${request.email} LIMIT 1
    `;

    if (users.length === 0) {
      return errorResponse(401, 'Invalid email or password');
    }

    const user = users[0];
    const isPasswordValid = await verifyPassword(request.password, user.password_hash);

    if (!isPasswordValid) {
      return errorResponse(401, 'Invalid email or password');
    }

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role as 'student' | 'parent' | 'admin',
    });

    let student = undefined;
    if (user.role === 'student') {
      const students = await db`
        SELECT id, user_id, grade_level, date_of_birth, parent_id, created_at
        FROM students WHERE user_id = ${user.id} LIMIT 1
      `;
      if (students.length > 0) {
        const s = students[0];
        student = {
          id: s.id,
          userId: s.user_id,
          gradeLevel: s.grade_level,
          dateOfBirth: new Date(s.date_of_birth).toISOString(),
          parentId: s.parent_id || undefined,
          createdAt: new Date(s.created_at).toISOString(),
        };
      }
    }

    const response: LoginResponse = {
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role as 'student' | 'parent' | 'admin',
        createdAt: new Date(user.created_at).toISOString(),
      },
      student,
    };

    console.log('Login successful:', { userId: user.id, role: user.role });
    return successResponse(response);
  } catch (error) {
    console.error('Login error:', error);
    return errorResponse(500, 'Internal server error');
  }
}
