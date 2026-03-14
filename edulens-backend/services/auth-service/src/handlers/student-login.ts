/**
 * Student Login Handler
 *
 * Authenticates a student using their username (not email) and password.
 * Internally maps username to the student email pattern.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getPrismaClient } from '../lib/database';
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

    const prisma = await getPrismaClient();

    // Map username to the student email pattern
    const studentEmail = `${username.toLowerCase()}@student.edulens.local`;

    const user = await prisma.user.findUnique({
      where: { email: studentEmail },
    });

    if (!user || user.role !== 'student') {
      return errorResponse(401, 'Invalid username or password');
    }

    const isPasswordValid = await verifyPassword(password, user.passwordHash);
    if (!isPasswordValid) {
      return errorResponse(401, 'Invalid username or password');
    }

    // Load student profile
    const studentProfile = await prisma.student.findUnique({
      where: { userId: user.id },
    });

    if (!studentProfile) {
      return errorResponse(500, 'Student profile not found');
    }

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: 'student',
    });

    console.log('Student login successful:', { userId: user.id, studentId: studentProfile.id });

    return successResponse({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.createdAt.toISOString(),
      },
      student: {
        id: studentProfile.id,
        userId: studentProfile.userId,
        gradeLevel: studentProfile.gradeLevel,
        dateOfBirth: studentProfile.dateOfBirth.toISOString(),
        parentId: studentProfile.parentId,
        createdAt: studentProfile.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Student login error:', error);
    return errorResponse(500, 'Internal server error');
  }
}
