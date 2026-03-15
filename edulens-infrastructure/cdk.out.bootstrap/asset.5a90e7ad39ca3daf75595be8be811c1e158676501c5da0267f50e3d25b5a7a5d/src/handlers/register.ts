/**
 * Register Handler
 *
 * Creates new user account with validation and password hashing
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { getPrismaClient } from '../lib/database';
import { hashPassword, validatePasswordStrength } from '../lib/password';
import { RegisterRequest, RegisterResponse, ErrorResponse } from '../types';

/**
 * Create success response
 */
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

/**
 * Create error response
 */
function errorResponse(statusCode: number, message: string): APIGatewayProxyResult {
  const response: ErrorResponse = {
    success: false,
    error: message,
    statusCode,
  };

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

/**
 * Validate email format
 */
function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Lambda handler
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  console.log('Register request:', { path: event.path, method: event.httpMethod });

  try {
    // Parse request body
    if (!event.body) {
      return errorResponse(400, 'Request body is required');
    }

    const request: RegisterRequest = JSON.parse(event.body);

    // Validate required fields
    if (!request.email || !request.password || !request.name || !request.role) {
      return errorResponse(400, 'Email, password, name, and role are required');
    }

    // Validate email format
    if (!validateEmail(request.email)) {
      return errorResponse(400, 'Invalid email format');
    }

    // Validate password strength
    const passwordValidation = validatePasswordStrength(request.password);
    if (!passwordValidation.valid) {
      return errorResponse(400, passwordValidation.message || 'Invalid password');
    }

    // Validate role
    if (!['student', 'parent'].includes(request.role)) {
      return errorResponse(400, 'Role must be either student or parent');
    }

    // For students, gradeLevel and dateOfBirth are required
    if (request.role === 'student') {
      if (!request.gradeLevel || !request.dateOfBirth) {
        return errorResponse(400, 'Grade level and date of birth are required for students');
      }

      if (request.gradeLevel < 1 || request.gradeLevel > 12) {
        return errorResponse(400, 'Grade level must be between 1 and 12');
      }
    }

    // Get Prisma client
    const prisma = await getPrismaClient();

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: request.email },
    });

    if (existingUser) {
      return errorResponse(409, 'User with this email already exists');
    }

    // Hash password
    const passwordHash = await hashPassword(request.password);

    // Create user
    const userId = uuidv4();

    const user = await prisma.user.create({
      data: {
        id: userId,
        email: request.email,
        name: request.name,
        role: request.role,
        passwordHash,
      },
    });

    // Create student profile if role is student
    if (request.role === 'student' && request.gradeLevel && request.dateOfBirth) {
      await prisma.student.create({
        data: {
          id: uuidv4(),
          userId: user.id,
          gradeLevel: request.gradeLevel,
          dateOfBirth: new Date(request.dateOfBirth),
          parentId: user.id, // Self-registered students; parent-created students use create-student handler
        },
      });
    }

    // Prepare response
    const response: RegisterResponse = {
      success: true,
      message: 'User registered successfully. Please log in.',
      userId: user.id,
    };

    console.log('Registration successful:', { userId: user.id, role: user.role });

    return successResponse(response);
  } catch (error) {
    console.error('Registration error:', error);

    // Handle Prisma unique constraint violations
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return errorResponse(409, 'User with this email already exists');
    }

    return errorResponse(500, 'Internal server error');
  }
}
