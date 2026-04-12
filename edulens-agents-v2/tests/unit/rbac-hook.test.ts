/**
 * Unit tests for RBACHook
 */

import { RBACHook } from '../../src/hooks/rbac-hook.js';
import { ActorIdentity, DomainHarness } from '../../src/shared/types.js';

describe('RBACHook', () => {
  let rbacHook: RBACHook;

  beforeEach(() => {
    rbacHook = new RBACHook();
  });

  describe('beforeToolCall', () => {
    const mockStudentTutorHarness: DomainHarness = {
      name: 'student_tutor',
      systemPromptFile: 'student-tutor.md',
      model: 'haiku',
      maxTokens: 1024,
      temperature: 0.5,
      tools: ['load_question_context', 'query_student_level'],
      toolPolicies: {
        load_question_context: {
          dataAccess: 'own',
          requiresRole: ['student', 'admin']
        },
        query_student_level: {
          dataAccess: 'own',
          maxCallsPerSession: 3
        }
      }
    };

    const mockParentAdvisorHarness: DomainHarness = {
      name: 'parent_advisor',
      systemPromptFile: 'parent-advisor.md',
      model: 'sonnet',
      maxTokens: 2048,
      temperature: 0.3,
      tools: ['query_student_profile', 'compare_students'],
      toolPolicies: {
        query_student_profile: {
          dataAccess: 'children',
          requiresRole: ['parent', 'admin']
        },
        compare_students: {
          dataAccess: 'children',
          maxCallsPerSession: 2
        }
      }
    };

    describe('tool availability', () => {
      test('should allow tool that exists in harness', async () => {
        const studentIdentity: ActorIdentity = {
          actorId: 'student_001',
          role: 'student',
          studentId: 'student_001'
        };

        const result = await rbacHook.beforeToolCall(
          { toolName: 'load_question_context', input: { questionId: 'q1', studentId: 'student_001' } },
          {
            actorIdentity: studentIdentity,
            domainHarness: mockStudentTutorHarness,
            sessionId: 'session_1',
            metadata: {}
          }
        );

        expect(result.blocked).toBe(false);
      });

      test('should block tool that does not exist in harness', async () => {
        const studentIdentity: ActorIdentity = {
          actorId: 'student_001',
          role: 'student',
          studentId: 'student_001'
        };

        const result = await rbacHook.beforeToolCall(
          { toolName: 'nonexistent_tool', input: {} },
          {
            actorIdentity: studentIdentity,
            domainHarness: mockStudentTutorHarness,
            sessionId: 'session_1',
            metadata: {}
          }
        );

        expect(result.blocked).toBe(true);
        expect(result.reason).toContain('not allowed in domain');
      });
    });

    describe('role-based access', () => {
      test('should allow tool when user has required role', async () => {
        const studentIdentity: ActorIdentity = {
          actorId: 'student_001',
          role: 'student',
          studentId: 'student_001'
        };

        const result = await rbacHook.beforeToolCall(
          { toolName: 'load_question_context', input: { questionId: 'q1', studentId: 'student_001' } },
          {
            actorIdentity: studentIdentity,
            domainHarness: mockStudentTutorHarness,
            sessionId: 'session_1',
            metadata: {}
          }
        );

        expect(result.blocked).toBe(false);
      });

      test('should block tool when user lacks required role', async () => {
        const parentIdentity: ActorIdentity = {
          actorId: 'parent_001',
          role: 'parent',
          children: ['student_001']
        };

        const result = await rbacHook.beforeToolCall(
          { toolName: 'load_question_context', input: { questionId: 'q1', studentId: 'student_001' } },
          {
            actorIdentity: parentIdentity,
            domainHarness: mockStudentTutorHarness,
            sessionId: 'session_1',
            metadata: {}
          }
        );

        expect(result.blocked).toBe(true);
        expect(result.reason).toContain('requires role');
      });

      test('should allow admin to access any tool', async () => {
        const adminIdentity: ActorIdentity = {
          actorId: 'admin_001',
          role: 'admin'
        };

        const result = await rbacHook.beforeToolCall(
          { toolName: 'load_question_context', input: { questionId: 'q1', studentId: 'student_001' } },
          {
            actorIdentity: adminIdentity,
            domainHarness: mockStudentTutorHarness,
            sessionId: 'session_1',
            metadata: {}
          }
        );

        expect(result.blocked).toBe(false);
      });
    });

    describe('data access control', () => {
      test('should allow student to access their own data', async () => {
        const studentIdentity: ActorIdentity = {
          actorId: 'student_001',
          role: 'student',
          studentId: 'student_001'
        };

        const result = await rbacHook.beforeToolCall(
          { toolName: 'query_student_level', input: { studentId: 'student_001' } },
          {
            actorIdentity: studentIdentity,
            domainHarness: mockStudentTutorHarness,
            sessionId: 'session_1',
            metadata: {}
          }
        );

        expect(result.blocked).toBe(false);
      });

      test('should block student from accessing other student data', async () => {
        const studentIdentity: ActorIdentity = {
          actorId: 'student_001',
          role: 'student',
          studentId: 'student_001'
        };

        const result = await rbacHook.beforeToolCall(
          { toolName: 'query_student_level', input: { studentId: 'student_002' } },
          {
            actorIdentity: studentIdentity,
            domainHarness: mockStudentTutorHarness,
            sessionId: 'session_1',
            metadata: {}
          }
        );

        expect(result.blocked).toBe(true);
        expect(result.reason).toContain('can only access their own data');
      });

      test('should allow parent to access their children data', async () => {
        const parentIdentity: ActorIdentity = {
          actorId: 'parent_001',
          role: 'parent',
          children: ['student_001', 'student_002']
        };

        const result = await rbacHook.beforeToolCall(
          { toolName: 'query_student_profile', input: { studentId: 'student_001' } },
          {
            actorIdentity: parentIdentity,
            domainHarness: mockParentAdvisorHarness,
            sessionId: 'session_1',
            metadata: {}
          }
        );

        expect(result.blocked).toBe(false);
      });

      test('should block parent from accessing non-children data', async () => {
        const parentIdentity: ActorIdentity = {
          actorId: 'parent_001',
          role: 'parent',
          children: ['student_001']
        };

        const result = await rbacHook.beforeToolCall(
          { toolName: 'query_student_profile', input: { studentId: 'student_002' } },
          {
            actorIdentity: parentIdentity,
            domainHarness: mockParentAdvisorHarness,
            sessionId: 'session_1',
            metadata: {}
          }
        );

        expect(result.blocked).toBe(true);
        expect(result.reason).toContain('can only access their children');
      });
    });

    describe('call limits', () => {
      test('should allow tool calls within limit', async () => {
        const studentIdentity: ActorIdentity = {
          actorId: 'student_001',
          role: 'student',
          studentId: 'student_001'
        };

        const context = {
          actorIdentity: studentIdentity,
          domainHarness: mockStudentTutorHarness,
          sessionId: 'session_1',
          metadata: {}
        };

        // First call should be allowed
        const result1 = await rbacHook.beforeToolCall(
          { toolName: 'query_student_level', input: { studentId: 'student_001' } },
          context
        );
        expect(result1.blocked).toBe(false);

        // Second call should be allowed
        const result2 = await rbacHook.beforeToolCall(
          { toolName: 'query_student_level', input: { studentId: 'student_001' } },
          context
        );
        expect(result2.blocked).toBe(false);

        // Third call should be allowed
        const result3 = await rbacHook.beforeToolCall(
          { toolName: 'query_student_level', input: { studentId: 'student_001' } },
          context
        );
        expect(result3.blocked).toBe(false);
      });

      test('should block tool calls exceeding limit', async () => {
        const studentIdentity: ActorIdentity = {
          actorId: 'student_001',
          role: 'student',
          studentId: 'student_001'
        };

        const context = {
          actorIdentity: studentIdentity,
          domainHarness: mockStudentTutorHarness,
          sessionId: 'session_1',
          metadata: {}
        };

        // Make 3 calls (the limit)
        for (let i = 0; i < 3; i++) {
          await rbacHook.beforeToolCall(
            { toolName: 'query_student_level', input: { studentId: 'student_001' } },
            context
          );
        }

        // Fourth call should be blocked
        const result = await rbacHook.beforeToolCall(
          { toolName: 'query_student_level', input: { studentId: 'student_001' } },
          context
        );

        expect(result.blocked).toBe(true);
        expect(result.reason).toContain('usage limit exceeded');
      });
    });

    describe('error handling', () => {
      test('should block when no identity provided', async () => {
        const result = await rbacHook.beforeToolCall(
          { toolName: 'query_student_level', input: {} },
          {
            domainHarness: mockStudentTutorHarness,
            sessionId: 'session_1',
            metadata: {}
          }
        );

        expect(result.blocked).toBe(true);
        expect(result.reason).toBe('No identity provided');
      });

      test('should block when no harness provided', async () => {
        const studentIdentity: ActorIdentity = {
          actorId: 'student_001',
          role: 'student',
          studentId: 'student_001'
        };

        const result = await rbacHook.beforeToolCall(
          { toolName: 'query_student_level', input: {} },
          {
            actorIdentity: studentIdentity,
            sessionId: 'session_1',
            metadata: {}
          }
        );

        expect(result.blocked).toBe(true);
        expect(result.reason).toBe('No domain harness configured');
      });
    });
  });

  describe('utility methods', () => {
    test('canAccessStudent should work correctly', () => {
      const studentIdentity: ActorIdentity = {
        actorId: 'student_001',
        role: 'student',
        studentId: 'student_001'
      };

      const parentIdentity: ActorIdentity = {
        actorId: 'parent_001',
        role: 'parent',
        children: ['student_001', 'student_002']
      };

      const adminIdentity: ActorIdentity = {
        actorId: 'admin_001',
        role: 'admin'
      };

      // Student can access their own data
      expect(rbacHook.canAccessStudent(studentIdentity, 'student_001')).toBe(true);
      expect(rbacHook.canAccessStudent(studentIdentity, 'student_002')).toBe(false);

      // Parent can access their children's data
      expect(rbacHook.canAccessStudent(parentIdentity, 'student_001')).toBe(true);
      expect(rbacHook.canAccessStudent(parentIdentity, 'student_002')).toBe(true);
      expect(rbacHook.canAccessStudent(parentIdentity, 'student_003')).toBe(false);

      // Admin can access any data
      expect(rbacHook.canAccessStudent(adminIdentity, 'student_001')).toBe(true);
      expect(rbacHook.canAccessStudent(adminIdentity, 'student_999')).toBe(true);
    });

    test('getAccessibleStudents should return correct student lists', () => {
      const studentIdentity: ActorIdentity = {
        actorId: 'student_001',
        role: 'student',
        studentId: 'student_001'
      };

      const parentIdentity: ActorIdentity = {
        actorId: 'parent_001',
        role: 'parent',
        children: ['student_001', 'student_002']
      };

      const adminIdentity: ActorIdentity = {
        actorId: 'admin_001',
        role: 'admin'
      };

      expect(rbacHook.getAccessibleStudents(studentIdentity)).toEqual(['student_001']);
      expect(rbacHook.getAccessibleStudents(parentIdentity)).toEqual(['student_001', 'student_002']);
      expect(rbacHook.getAccessibleStudents(adminIdentity)).toEqual(['*']);
    });

    test('clearSession should remove session data', () => {
      rbacHook.clearSession('session_1');
      expect(rbacHook.getSessionStats('session_1')).toEqual({});
    });
  });
});