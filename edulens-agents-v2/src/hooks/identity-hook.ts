/**
 * Identity Hook - Extracts and validates actor identity from JWT tokens
 */

import { ActorIdentity, HookContext, HookResult } from '../shared/types.js';

export interface JWTPayload {
  sub?: string;
  actor_id?: string;
  role?: string;
  children?: string[];
  exp?: number;
  iat?: number;
}

export class IdentityHook {
  /**
   * Extract actor identity from JWT token
   */
  async extractIdentity(jwtToken: string): Promise<ActorIdentity> {
    try {
      // Parse JWT (simplified - in production use proper JWT library)
      const payload = this.parseJWT(jwtToken);

      // Validate token expiration
      if (payload.exp && payload.exp < Date.now() / 1000) {
        throw new Error('JWT token has expired');
      }

      // Extract identity information
      const actorId = payload.actor_id || payload.sub;
      if (!actorId) {
        throw new Error('No actor_id or sub found in JWT');
      }

      const role = this.validateRole(payload.role);

      // Build identity object
      const identity: ActorIdentity = {
        actorId,
        role
      };

      // Add role-specific data
      if (role === 'parent' && payload.children) {
        identity.children = Array.isArray(payload.children) ? payload.children : [payload.children];
      } else if (role === 'student') {
        identity.studentId = actorId;
      }

      console.log(`Identity extracted: ${actorId} (role: ${role})`);
      return identity;

    } catch (error) {
      throw new Error(`Failed to extract identity: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Validate identity before any operation
   */
  async beforeOperation(input: unknown, context: HookContext): Promise<HookResult> {
    if (!context.actorIdentity) {
      return {
        blocked: true,
        reason: 'No valid identity found'
      };
    }

    // Additional identity validation can go here
    return { blocked: false };
  }

  /**
   * Parse JWT token (simplified implementation)
   * In production, use a proper JWT library like jsonwebtoken
   */
  private parseJWT(token: string): JWTPayload {
    try {
      // Remove Bearer prefix if present
      const cleanToken = token.replace(/^Bearer\s+/, '');

      // Split token parts
      const parts = cleanToken.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid JWT format');
      }

      // Decode payload (base64url decode)
      const payload = parts[1];
      if (!payload) {
        throw new Error('Missing JWT payload');
      }

      const decoded = Buffer.from(payload, 'base64url').toString('utf-8');
      const parsed = JSON.parse(decoded) as JWTPayload;

      return parsed;

    } catch (error) {
      throw new Error(`Invalid JWT token: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Validate and normalize role
   */
  private validateRole(role?: string): ActorIdentity['role'] {
    if (!role) {
      throw new Error('No role found in JWT');
    }

    const validRoles: ActorIdentity['role'][] = ['student', 'parent', 'admin'];
    const normalizedRole = role.toLowerCase() as ActorIdentity['role'];

    if (!validRoles.includes(normalizedRole)) {
      throw new Error(`Invalid role: ${role}`);
    }

    return normalizedRole;
  }

  /**
   * Create a mock identity for testing
   */
  static createMockIdentity(
    actorId: string,
    role: ActorIdentity['role'],
    options?: { children?: string[]; studentId?: string }
  ): ActorIdentity {
    const identity: ActorIdentity = {
      actorId,
      role
    };

    if (role === 'parent' && options?.children) {
      identity.children = options.children;
    } else if (role === 'student' && options?.studentId) {
      identity.studentId = options.studentId;
    }

    return identity;
  }

  /**
   * Create a mock JWT token for testing
   */
  static createMockJWT(payload: Partial<JWTPayload>): string {
    const header = { alg: 'HS256', typ: 'JWT' };
    const fullPayload = {
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
      iat: Math.floor(Date.now() / 1000),
      ...payload
    };

    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
    const encodedPayload = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
    const signature = 'mock_signature';

    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }
}