/**
 * Login Handler
 *
 * Authenticates user and returns JWT token
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getPrismaClient } from '../lib/database';
import { verifyPassword } from '../lib/password';
import { generateToken } from '../lib/jwt';
import { LoginRequest, LoginResponse, ErrorResponse } from '../types';

/**
 * Create success response
 */
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
 * Lambda handler
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  console.log('Login request:', { path: event.path, method: event.httpMethod });

  try {
    // Parse request body
    if (!event.body) {
      return errorResponse(400, 'Request body is required');
    }

    const request: LoginRequest = JSON.parse(event.body);

    // Validate input
    if (!request.email || !request.password) {
      return errorResponse(400, 'Email and password are required');
    }

    // Get Prisma client
    const prisma = await getPrismaClient();

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: request.email },
    });

    if (!user) {
      return errorResponse(401, 'Invalid email or password');
    }

    // Verify password
    const isPasswordValid = await verifyPassword(request.password, user.passwordHash);

    if (!isPasswordValid) {
      return errorResponse(401, 'Invalid email or password');
    }

    // Generate JWT token
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role as 'student' | 'parent' | 'admin',
    });

    // Get student profile if user is a student
    let student = undefined;
    if (user.role === 'student') {
      const studentProfile = await prisma.student.findUnique({
        where: { userId: user.id },
      });

      if (studentProfile) {
        student = {
          id: studentProfile.id,
          userId: studentProfile.userId,
          gradeLevel: studentProfile.gradeLevel,
          dateOfBirth: studentProfile.dateOfBirth.toISOString(),
          parentId: studentProfile.parentId || undefined,
          createdAt: studentProfile.createdAt.toISOString(),
        };
      }
    }

    // Prepare response
    const response: LoginResponse = {
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role as 'student' | 'parent' | 'admin',
        createdAt: user.createdAt.toISOString(),
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
