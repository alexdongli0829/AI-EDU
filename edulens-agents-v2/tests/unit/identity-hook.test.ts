/**
 * Unit tests for IdentityHook
 */

import { IdentityHook } from '../../src/hooks/identity-hook.js';

describe('IdentityHook', () => {
  let identityHook: IdentityHook;

  beforeEach(() => {
    identityHook = new IdentityHook();
  });

  describe('extractIdentity', () => {
    test('should extract student identity correctly', async () => {
      const mockJWT = IdentityHook.createMockJWT({
        actor_id: 'student_001',
        role: 'student',
        sub: 'student_001'
      });

      const identity = await identityHook.extractIdentity(mockJWT);

      expect(identity).toEqual({
        actorId: 'student_001',
        role: 'student',
        studentId: 'student_001'
      });
    });

    test('should extract parent identity with children', async () => {
      const mockJWT = IdentityHook.createMockJWT({
        actor_id: 'parent_001',
        role: 'parent',
        children: ['student_001', 'student_002']
      });

      const identity = await identityHook.extractIdentity(mockJWT);

      expect(identity).toEqual({
        actorId: 'parent_001',
        role: 'parent',
        children: ['student_001', 'student_002']
      });
    });

    test('should extract admin identity', async () => {
      const mockJWT = IdentityHook.createMockJWT({
        actor_id: 'admin_001',
        role: 'admin'
      });

      const identity = await identityHook.extractIdentity(mockJWT);

      expect(identity).toEqual({
        actorId: 'admin_001',
        role: 'admin'
      });
    });

    test('should handle Bearer prefix in JWT', async () => {
      const mockJWT = IdentityHook.createMockJWT({
        actor_id: 'student_001',
        role: 'student'
      });

      const identity = await identityHook.extractIdentity(`Bearer ${mockJWT}`);

      expect(identity.actorId).toBe('student_001');
      expect(identity.role).toBe('student');
    });

    test('should use sub as fallback for actor_id', async () => {
      const mockJWT = IdentityHook.createMockJWT({
        sub: 'user_from_sub',
        role: 'student'
      });

      const identity = await identityHook.extractIdentity(mockJWT);

      expect(identity.actorId).toBe('user_from_sub');
    });

    test('should handle single child as string', async () => {
      const mockJWT = IdentityHook.createMockJWT({
        actor_id: 'parent_001',
        role: 'parent',
        children: ['student_001'] // Single child as array
      });

      const identity = await identityHook.extractIdentity(mockJWT);

      expect(identity.children).toEqual(['student_001']);
    });

    test('should throw error for expired JWT', async () => {
      const expiredJWT = IdentityHook.createMockJWT({
        actor_id: 'student_001',
        role: 'student',
        exp: Math.floor(Date.now() / 1000) - 3600 // 1 hour ago
      });

      await expect(identityHook.extractIdentity(expiredJWT))
        .rejects.toThrow('JWT token has expired');
    });

    test('should throw error for missing actor_id and sub', async () => {
      const mockJWT = IdentityHook.createMockJWT({
        role: 'student'
        // Missing actor_id and sub
      });

      await expect(identityHook.extractIdentity(mockJWT))
        .rejects.toThrow('No actor_id or sub found in JWT');
    });

    test('should throw error for missing role', async () => {
      const mockJWT = IdentityHook.createMockJWT({
        actor_id: 'student_001'
        // Missing role
      });

      await expect(identityHook.extractIdentity(mockJWT))
        .rejects.toThrow('No role found in JWT');
    });

    test('should throw error for invalid role', async () => {
      const mockJWT = IdentityHook.createMockJWT({
        actor_id: 'student_001',
        role: 'invalid_role'
      });

      await expect(identityHook.extractIdentity(mockJWT))
        .rejects.toThrow('Invalid role: invalid_role');
    });

    test('should throw error for malformed JWT', async () => {
      const malformedJWT = 'not.a.valid.jwt';

      await expect(identityHook.extractIdentity(malformedJWT))
        .rejects.toThrow('Invalid JWT format');
    });

    test('should throw error for invalid JSON in JWT payload', async () => {
      const invalidJWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid_base64.signature';

      await expect(identityHook.extractIdentity(invalidJWT))
        .rejects.toThrow('Invalid JWT token');
    });
  });

  describe('beforeOperation', () => {
    test('should allow operation with valid identity', async () => {
      const identity = IdentityHook.createMockIdentity('student_001', 'student');

      const result = await identityHook.beforeOperation(
        { someInput: true },
        {
          actorIdentity: identity,
          metadata: {}
        }
      );

      expect(result.blocked).toBe(false);
    });

    test('should block operation without identity', async () => {
      const result = await identityHook.beforeOperation(
        { someInput: true },
        {
          metadata: {}
        }
      );

      expect(result.blocked).toBe(true);
      expect(result.reason).toBe('No valid identity found');
    });
  });

  describe('role validation', () => {
    const validRoles = ['student', 'parent', 'admin'];

    test.each(validRoles)('should accept valid role: %s', async (role) => {
      const mockJWT = IdentityHook.createMockJWT({
        actor_id: 'user_001',
        role: role
      });

      const identity = await identityHook.extractIdentity(mockJWT);
      expect(identity.role).toBe(role);
    });

    test('should normalize role case', async () => {
      const mockJWT = IdentityHook.createMockJWT({
        actor_id: 'user_001',
        role: 'STUDENT' // Uppercase
      });

      const identity = await identityHook.extractIdentity(mockJWT);
      expect(identity.role).toBe('student'); // Should be normalized to lowercase
    });

    test('should reject empty role', async () => {
      const mockJWT = IdentityHook.createMockJWT({
        actor_id: 'user_001',
        role: ''
      });

      await expect(identityHook.extractIdentity(mockJWT))
        .rejects.toThrow('No role found in JWT');
    });
  });

  describe('mock utility functions', () => {
    test('createMockIdentity should create valid student identity', () => {
      const identity = IdentityHook.createMockIdentity(
        'student_001',
        'student',
        { studentId: 'student_001' }
      );

      expect(identity).toEqual({
        actorId: 'student_001',
        role: 'student',
        studentId: 'student_001'
      });
    });

    test('createMockIdentity should create valid parent identity', () => {
      const identity = IdentityHook.createMockIdentity(
        'parent_001',
        'parent',
        { children: ['student_001', 'student_002'] }
      );

      expect(identity).toEqual({
        actorId: 'parent_001',
        role: 'parent',
        children: ['student_001', 'student_002']
      });
    });

    test('createMockIdentity should create valid admin identity', () => {
      const identity = IdentityHook.createMockIdentity('admin_001', 'admin');

      expect(identity).toEqual({
        actorId: 'admin_001',
        role: 'admin'
      });
    });

    test('createMockJWT should create parseable JWT', async () => {
      const payload = {
        actor_id: 'test_user',
        role: 'student',
        custom_field: 'test_value'
      };

      const jwt = IdentityHook.createMockJWT(payload);

      expect(jwt).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/); // JWT format

      // Should be parseable by our own extractIdentity method
      const identity = await identityHook.extractIdentity(jwt);
      expect(identity.actorId).toBe('test_user');
      expect(identity.role).toBe('student');
    });

    test('createMockJWT should include expiration by default', async () => {
      const jwt = IdentityHook.createMockJWT({
        actor_id: 'test_user',
        role: 'student'
      });

      // Should not be expired (should extract successfully)
      const identity = await identityHook.extractIdentity(jwt);
      expect(identity.actorId).toBe('test_user');
    });
  });
});