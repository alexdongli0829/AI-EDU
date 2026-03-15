/**
 * JWT Token Utilities
 *
 * Generate and verify JWT tokens for authentication
 */

import jwt from 'jsonwebtoken';

// JWT secret - in production, this should come from AWS Secrets Manager
const JWT_SECRET = process.env.JWT_SECRET || 'edulens-jwt-secret-change-in-production';
const JWT_EXPIRES_IN = '7d'; // Token valid for 7 days

export interface TokenPayload {
  userId: string;
  email: string;
  role: 'student' | 'parent' | 'admin';
}

/**
 * Generate JWT token
 */
export function generateToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
    issuer: 'edulens',
  });
}

/**
 * Verify and decode JWT token
 */
export function verifyToken(token: string): TokenPayload {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'edulens',
    }) as TokenPayload;

    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Token has expired');
    } else if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid token');
    }
    throw new Error('Token verification failed');
  }
}

/**
 * Extract token from Authorization header
 */
export function extractTokenFromHeader(authHeader?: string): string | null {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}
