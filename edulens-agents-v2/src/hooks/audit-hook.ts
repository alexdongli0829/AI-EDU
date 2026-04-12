/**
 * Audit Hook - Comprehensive logging and audit trail for agent interactions
 */

import { writeFileSync, existsSync, mkdirSync, appendFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { HookContext } from '../shared/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface AuditLog {
  timestamp: string;
  requestId?: string;
  sessionId?: string;
  actorId?: string;
  role?: string;
  event: string;
  details: Record<string, unknown>;
  harness?: string;
  level: 'INFO' | 'WARN' | 'ERROR';
}

export interface ModelCallInput {
  input: string;
  taskType?: string;
}

export interface ModelCallOutput {
  input: string;
  output: string;
  toolCalls?: Array<{ name: string; input: unknown; output: unknown }>;
  error?: string;
}

export class AuditHook {
  private readonly auditLogs: AuditLog[] = [];
  private readonly logDir: string;
  private readonly maxMemoryLogs = 1000;

  constructor() {
    this.logDir = resolve(__dirname, '..', '..', 'logs');
    this.ensureLogDirectory();
  }

  /**
   * Log before model call
   */
  async beforeModelCall(input: ModelCallInput, context: HookContext): Promise<void> {
    const log: AuditLog = {
      timestamp: new Date().toISOString(),
      requestId: context.requestId,
      sessionId: context.sessionId,
      actorId: context.actorIdentity?.actorId,
      role: context.actorIdentity?.role,
      harness: context.domainHarness?.name,
      event: 'model_call_start',
      level: 'INFO',
      details: {
        inputLength: input.input.length,
        taskType: input.taskType,
        preview: input.input.substring(0, 100) + (input.input.length > 100 ? '...' : '')
      }
    };

    this.addLog(log);
  }

  /**
   * Log after model call
   */
  async afterModelCall(output: ModelCallOutput, context: HookContext): Promise<void> {
    const log: AuditLog = {
      timestamp: new Date().toISOString(),
      requestId: context.requestId,
      sessionId: context.sessionId,
      actorId: context.actorIdentity?.actorId,
      role: context.actorIdentity?.role,
      harness: context.domainHarness?.name,
      event: output.error ? 'model_call_error' : 'model_call_complete',
      level: output.error ? 'ERROR' : 'INFO',
      details: {
        inputLength: output.input.length,
        outputLength: output.output.length,
        toolCallCount: output.toolCalls?.length || 0,
        toolNames: output.toolCalls?.map(tc => tc.name) || [],
        error: output.error,
        success: !output.error
      }
    };

    this.addLog(log);
  }

  /**
   * Log tool call
   */
  async logToolCall(
    toolName: string,
    input: unknown,
    output: unknown,
    context: HookContext,
    success = true,
    error?: string
  ): Promise<void> {
    const log: AuditLog = {
      timestamp: new Date().toISOString(),
      requestId: context.requestId,
      sessionId: context.sessionId,
      actorId: context.actorIdentity?.actorId,
      role: context.actorIdentity?.role,
      harness: context.domainHarness?.name,
      event: 'tool_call',
      level: success ? 'INFO' : 'ERROR',
      details: {
        toolName,
        inputType: typeof input,
        outputType: typeof output,
        success,
        error,
        inputPreview: this.safeStringify(input).substring(0, 200),
        outputPreview: this.safeStringify(output).substring(0, 200)
      }
    };

    this.addLog(log);
  }

  /**
   * Log security violation
   */
  async logSecurityViolation(
    violation: string,
    details: Record<string, unknown>,
    context: HookContext
  ): Promise<void> {
    const log: AuditLog = {
      timestamp: new Date().toISOString(),
      requestId: context.requestId,
      sessionId: context.sessionId,
      actorId: context.actorIdentity?.actorId,
      role: context.actorIdentity?.role,
      harness: context.domainHarness?.name,
      event: 'security_violation',
      level: 'WARN',
      details: {
        violation,
        ...details
      }
    };

    this.addLog(log);

    // Also write immediately to security log
    this.writeSecurityLog(log);
  }

  /**
   * Log session start
   */
  async logSessionStart(context: HookContext, metadata?: Record<string, unknown>): Promise<void> {
    const log: AuditLog = {
      timestamp: new Date().toISOString(),
      requestId: context.requestId,
      sessionId: context.sessionId,
      actorId: context.actorIdentity?.actorId,
      role: context.actorIdentity?.role,
      harness: context.domainHarness?.name,
      event: 'session_start',
      level: 'INFO',
      details: {
        userAgent: metadata?.userAgent,
        ipAddress: metadata?.ipAddress,
        ...metadata
      }
    };

    this.addLog(log);
  }

  /**
   * Log session end
   */
  async logSessionEnd(
    context: HookContext,
    stats: {
      duration: number;
      messageCount: number;
      toolCalls: number;
      tokensUsed?: number;
    }
  ): Promise<void> {
    const log: AuditLog = {
      timestamp: new Date().toISOString(),
      requestId: context.requestId,
      sessionId: context.sessionId,
      actorId: context.actorIdentity?.actorId,
      role: context.actorIdentity?.role,
      harness: context.domainHarness?.name,
      event: 'session_end',
      level: 'INFO',
      details: {
        durationMs: stats.duration,
        messageCount: stats.messageCount,
        toolCalls: stats.toolCalls,
        tokensUsed: stats.tokensUsed
      }
    };

    this.addLog(log);
  }

  /**
   * Add log to memory and optionally persist
   */
  private addLog(log: AuditLog): void {
    this.auditLogs.push(log);

    // Keep memory usage bounded
    if (this.auditLogs.length > this.maxMemoryLogs) {
      this.auditLogs.shift();
    }

    // Write to file for important events
    if (log.level === 'ERROR' || log.event.includes('security') || log.event.includes('session')) {
      this.persistLog(log);
    }

    // Console output for development
    this.consoleLog(log);
  }

  /**
   * Persist log to file
   */
  private persistLog(log: AuditLog): void {
    try {
      const date = new Date().toISOString().split('T')[0];
      const logFile = resolve(this.logDir, `audit-${date}.jsonl`);

      const logLine = JSON.stringify(log) + '\n';
      appendFileSync(logFile, logLine, 'utf8');

    } catch (error) {
      console.error('Failed to persist audit log:', error);
    }
  }

  /**
   * Write security-specific log
   */
  private writeSecurityLog(log: AuditLog): void {
    try {
      const date = new Date().toISOString().split('T')[0];
      const securityFile = resolve(this.logDir, `security-${date}.jsonl`);

      const logLine = JSON.stringify(log) + '\n';
      appendFileSync(securityFile, logLine, 'utf8');

    } catch (error) {
      console.error('Failed to write security log:', error);
    }
  }

  /**
   * Console output with formatting
   */
  private consoleLog(log: AuditLog): void {
    const prefix = `[${log.level}] ${log.timestamp} ${log.event}`;
    const context = log.actorId ? ` (${log.role}:${log.actorId})` : '';
    const message = `${prefix}${context}`;

    switch (log.level) {
      case 'ERROR':
        console.error(message, log.details);
        break;
      case 'WARN':
        console.warn(message, log.details);
        break;
      default:
        console.log(message);
        break;
    }
  }

  /**
   * Ensure log directory exists
   */
  private ensureLogDirectory(): void {
    try {
      if (!existsSync(this.logDir)) {
        mkdirSync(this.logDir, { recursive: true });
      }
    } catch (error) {
      console.error('Failed to create log directory:', error);
    }
  }

  /**
   * Safe JSON stringify with circular reference handling
   */
  private safeStringify(obj: unknown): string {
    try {
      return JSON.stringify(obj, (key, value) => {
        if (typeof value === 'object' && value !== null) {
          // Handle circular references
          if (this.hasCircularReference(value)) {
            return '[Circular]';
          }
        }
        return value;
      });
    } catch {
      return String(obj);
    }
  }

  /**
   * Check for circular references (simplified)
   */
  private hasCircularReference(obj: object): boolean {
    try {
      JSON.stringify(obj);
      return false;
    } catch {
      return true;
    }
  }

  /**
   * Get audit logs for a session
   */
  getSessionLogs(sessionId: string): AuditLog[] {
    return this.auditLogs.filter(log => log.sessionId === sessionId);
  }

  /**
   * Get audit logs for an actor
   */
  getActorLogs(actorId: string, limit = 100): AuditLog[] {
    return this.auditLogs
      .filter(log => log.actorId === actorId)
      .slice(-limit);
  }

  /**
   * Get security violation logs
   */
  getSecurityLogs(limit = 50): AuditLog[] {
    return this.auditLogs
      .filter(log => log.event === 'security_violation')
      .slice(-limit);
  }

  /**
   * Generate audit report for a time period
   */
  generateReport(startTime: Date, endTime: Date): {
    totalRequests: number;
    securityViolations: number;
    errorRate: number;
    topUsers: Array<{ actorId: string; requestCount: number }>;
    topTools: Array<{ toolName: string; callCount: number }>;
  } {
    const periodLogs = this.auditLogs.filter(log => {
      const logTime = new Date(log.timestamp);
      return logTime >= startTime && logTime <= endTime;
    });

    const totalRequests = periodLogs.filter(log => log.event === 'model_call_start').length;
    const securityViolations = periodLogs.filter(log => log.event === 'security_violation').length;
    const errors = periodLogs.filter(log => log.level === 'ERROR').length;
    const errorRate = totalRequests > 0 ? errors / totalRequests : 0;

    // Top users by request count
    const userCounts = new Map<string, number>();
    periodLogs
      .filter(log => log.actorId && log.event === 'model_call_start')
      .forEach(log => {
        const count = userCounts.get(log.actorId!) || 0;
        userCounts.set(log.actorId!, count + 1);
      });

    const topUsers = Array.from(userCounts.entries())
      .map(([actorId, requestCount]) => ({ actorId, requestCount }))
      .sort((a, b) => b.requestCount - a.requestCount)
      .slice(0, 10);

    // Top tools by call count
    const toolCounts = new Map<string, number>();
    periodLogs
      .filter(log => log.event === 'tool_call')
      .forEach(log => {
        const toolName = log.details.toolName as string;
        const count = toolCounts.get(toolName) || 0;
        toolCounts.set(toolName, count + 1);
      });

    const topTools = Array.from(toolCounts.entries())
      .map(([toolName, callCount]) => ({ toolName, callCount }))
      .sort((a, b) => b.callCount - a.callCount)
      .slice(0, 10);

    return {
      totalRequests,
      securityViolations,
      errorRate,
      topUsers,
      topTools
    };
  }

  /**
   * Clear old logs to manage memory
   */
  clearOldLogs(olderThanHours = 24): void {
    const cutoffTime = new Date(Date.now() - (olderThanHours * 60 * 60 * 1000));

    const remainingLogs = this.auditLogs.filter(log => {
      const logTime = new Date(log.timestamp);
      return logTime > cutoffTime;
    });

    const removedCount = this.auditLogs.length - remainingLogs.length;
    this.auditLogs.length = 0;
    this.auditLogs.push(...remainingLogs);

    if (removedCount > 0) {
      console.log(`Cleared ${removedCount} old audit logs (older than ${olderThanHours}h)`);
    }
  }
}