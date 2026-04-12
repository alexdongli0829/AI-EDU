/**
 * RBAC Hook - Role-Based Access Control for tools and data access
 */

import { HookContext, HookResult, ActorIdentity, ToolPolicy } from '../shared/types.js';

export interface ToolCallInput {
  toolName: string;
  input: unknown;
}

export class RBACHook {
  private readonly toolCallCounts = new Map<string, Map<string, number>>();

  /**
   * Check if tool call is allowed based on role and policies
   */
  async beforeToolCall(toolCall: ToolCallInput, context: HookContext): Promise<HookResult> {
    const { actorIdentity, domainHarness, sessionId } = context;

    if (!actorIdentity) {
      return {
        blocked: true,
        reason: 'No identity provided'
      };
    }

    if (!domainHarness) {
      return {
        blocked: true,
        reason: 'No domain harness configured'
      };
    }

    try {
      // Check if tool is allowed in current harness
      if (!domainHarness.tools.includes(toolCall.toolName)) {
        return {
          blocked: true,
          reason: `Tool ${toolCall.toolName} not allowed in domain ${domainHarness.name}`
        };
      }

      // Get tool policy
      const policy = domainHarness.toolPolicies?.[toolCall.toolName];

      if (policy) {
        // Check role requirements
        const roleResult = this.checkRoleRequirements(actorIdentity, policy);
        if (roleResult.blocked) {
          return roleResult;
        }

        // Check call count limits
        const countResult = this.checkCallLimits(toolCall.toolName, policy, sessionId);
        if (countResult.blocked) {
          return countResult;
        }

        // Check data access permissions
        const dataResult = this.checkDataAccess(actorIdentity, policy, toolCall.input);
        if (dataResult.blocked) {
          return dataResult;
        }
      }

      // Track tool call
      this.trackToolCall(toolCall.toolName, sessionId);

      return { blocked: false };

    } catch (error) {
      console.error('RBAC check error:', error);
      return {
        blocked: true,
        reason: 'RBAC validation failed'
      };
    }
  }

  /**
   * Check if actor has required role for tool
   */
  private checkRoleRequirements(identity: ActorIdentity, policy: ToolPolicy): HookResult {
    if (policy.requiresRole && !policy.requiresRole.includes(identity.role)) {
      return {
        blocked: true,
        reason: `Tool requires role ${policy.requiresRole.join(' or ')} but actor has role ${identity.role}`
      };
    }

    return { blocked: false };
  }

  /**
   * Check if tool call count is within limits
   */
  private checkCallLimits(toolName: string, policy: ToolPolicy, sessionId?: string): HookResult {
    if (!policy.maxCallsPerSession || !sessionId) {
      return { blocked: false };
    }

    const sessionKey = sessionId;
    const currentCount = this.getToolCallCount(toolName, sessionKey);

    if (currentCount >= policy.maxCallsPerSession) {
      return {
        blocked: true,
        reason: `Tool ${toolName} usage limit exceeded (${policy.maxCallsPerSession} per session)`
      };
    }

    return { blocked: false };
  }

  /**
   * Check data access permissions based on role and policy
   */
  private checkDataAccess(identity: ActorIdentity, policy: ToolPolicy, input: unknown): HookResult {
    if (!policy.dataAccess) {
      return { blocked: false };
    }

    try {
      const inputObj = input as Record<string, unknown>;

      switch (policy.dataAccess) {
        case 'own':
          return this.checkOwnDataAccess(identity, inputObj);

        case 'children':
          return this.checkChildrenDataAccess(identity, inputObj);

        case 'all':
          // Admin role can access all data
          if (identity.role !== 'admin') {
            return {
              blocked: true,
              reason: 'All data access requires admin role'
            };
          }
          return { blocked: false };

        default:
          return { blocked: false };
      }
    } catch {
      // If we can't validate data access, allow by default
      return { blocked: false };
    }
  }

  /**
   * Check if actor can access their own data only
   */
  private checkOwnDataAccess(identity: ActorIdentity, input: Record<string, unknown>): HookResult {
    const studentId = input.studentId as string;
    const actorId = input.actorId as string;

    // Students can only access their own data
    if (identity.role === 'student') {
      if (studentId && studentId !== identity.studentId) {
        return {
          blocked: true,
          reason: 'Students can only access their own data'
        };
      }
      if (actorId && actorId !== identity.actorId) {
        return {
          blocked: true,
          reason: 'Students can only access their own data'
        };
      }
    }

    return { blocked: false };
  }

  /**
   * Check if parent can access their children's data
   */
  private checkChildrenDataAccess(identity: ActorIdentity, input: Record<string, unknown>): HookResult {
    const studentId = input.studentId as string;

    if (identity.role === 'parent') {
      if (studentId && identity.children && !identity.children.includes(studentId)) {
        return {
          blocked: true,
          reason: 'Parents can only access their children\'s data'
        };
      }
    } else if (identity.role === 'student') {
      // Students can still access their own data
      if (studentId && studentId !== identity.studentId) {
        return {
          blocked: true,
          reason: 'Students can only access their own data'
        };
      }
    }

    return { blocked: false };
  }

  /**
   * Track tool call count per session
   */
  private trackToolCall(toolName: string, sessionId?: string): void {
    if (!sessionId) return;

    if (!this.toolCallCounts.has(sessionId)) {
      this.toolCallCounts.set(sessionId, new Map());
    }

    const sessionCounts = this.toolCallCounts.get(sessionId)!;
    const currentCount = sessionCounts.get(toolName) || 0;
    sessionCounts.set(toolName, currentCount + 1);
  }

  /**
   * Get current tool call count for session
   */
  private getToolCallCount(toolName: string, sessionId: string): number {
    return this.toolCallCounts.get(sessionId)?.get(toolName) || 0;
  }

  /**
   * Clear session data (call when session ends)
   */
  clearSession(sessionId: string): void {
    this.toolCallCounts.delete(sessionId);
  }

  /**
   * Get session statistics
   */
  getSessionStats(sessionId: string): Record<string, number> {
    const sessionCounts = this.toolCallCounts.get(sessionId);
    if (!sessionCounts) return {};

    const stats: Record<string, number> = {};
    for (const [toolName, count] of sessionCounts) {
      stats[toolName] = count;
    }
    return stats;
  }

  /**
   * Check if actor can access specific student data
   */
  canAccessStudent(identity: ActorIdentity, studentId: string): boolean {
    switch (identity.role) {
      case 'admin':
        return true;

      case 'parent':
        return identity.children?.includes(studentId) || false;

      case 'student':
        return identity.studentId === studentId;

      default:
        return false;
    }
  }

  /**
   * Get list of student IDs the actor can access
   */
  getAccessibleStudents(identity: ActorIdentity): string[] {
    switch (identity.role) {
      case 'admin':
        return ['*']; // Indicates all students

      case 'parent':
        return identity.children || [];

      case 'student':
        return identity.studentId ? [identity.studentId] : [];

      default:
        return [];
    }
  }
}