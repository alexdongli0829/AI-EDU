/**
 * Register Handler
 *
 * Creates new user account with validation and password hashing
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../lib/database';
import { hashPassword, validatePasswordStrength } from '../lib/password';
import { RegisterRequest, RegisterResponse, ErrorResponse } from '../types';

function successResponse(data: RegisterResponse): APIGatewayProxyResult {
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

function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  console.log('Register request:', { path: event.path, method: event.httpMethod });

  try {
    if (!event.body) {
      return errorResponse(400, 'Request body is required');
    }

    const request: RegisterRequest = JSON.parse(event.body);

    if (!request.email || !request.password || !request.name || !request.role) {
      return errorResponse(400, 'Email, password, name, and role are required');
    }

    if (!validateEmail(request.email)) {
      return errorResponse(400, 'Invalid email format');
    }

    const passwordValidation = validatePasswordStrength(request.password);
    if (!passwordValidation.valid) {
      return errorResponse(400, passwordValidation.message || 'Invalid password');
    }

    if (!['student', 'parent'].includes(request.role)) {
      return errorResponse(400, 'Role must be either student or parent');
    }

    if (request.role === 'student') {
      if (!request.gradeLevel || !request.dateOfBirth) {
        return errorResponse(400, 'Grade level and date of birth are required for students');
      }
      if (request.gradeLevel < 1 || request.gradeLevel > 12) {
        return errorResponse(400, 'Grade level must be between 1 and 12');
      }
    }

    const db = await getDb();

    const existing = await db`SELECT id FROM users WHERE email = ${request.email} LIMIT 1`;
    if (existing.length > 0) {
      return errorResponse(409, 'User with this email already exists');
    }

    const passwordHash = await hashPassword(request.password);
    const userId = uuidv4();

    await db`
      INSERT INTO users (id, email, name, role, password_hash, created_at, updated_at)
      VALUES (${userId}, ${request.email}, ${request.name}, ${request.role}, ${passwordHash}, NOW(), NOW())
    `;

    if (request.role === 'student' && request.gradeLevel && request.dateOfBirth) {
      await db`
        INSERT INTO students (id, user_id, grade_level, date_of_birth, parent_id, created_at, updated_at)
        VALUES (${uuidv4()}, ${userId}, ${request.gradeLevel}, ${request.dateOfBirth}::date, ${userId}, NOW(), NOW())
      `;
    }

    const response: RegisterResponse = {
      success: true,
      message: 'User registered successfully. Please log in.',
      userId,
    };

    console.log('Registration successful:', { userId, role: request.role });
    return successResponse(response);
  } catch (error) {
    console.error('Registration error:', error);

    if (error instanceof Error && error.message.includes('unique')) {
      return errorResponse(409, 'User with this email already exists');
    }

    return errorResponse(500, 'Internal server error');
  }
}
