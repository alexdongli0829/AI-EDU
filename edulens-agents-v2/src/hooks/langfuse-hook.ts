/**
 * Langfuse Hook - Observability and tracing for model calls and agent interactions
 */

import { Langfuse } from 'langfuse';
import { HookContext } from '../shared/types.js';

export interface LangfuseModelInput {
  input: string;
  taskType?: string;
  harness?: string;
}

export interface LangfuseModelOutput {
  input: string;
  output: string;
  toolCalls: Array<{ name: string; input: unknown; output: unknown }>;
  tokens?: number;
  latency: number;
}

export interface LangfuseTrace {
  id: string;
  sessionId?: string;
  userId?: string;
  metadata: Record<string, unknown>;
}

export class LangfuseHook {
  private readonly langfuse: Langfuse | null = null;
  private readonly traces = new Map<string, LangfuseTrace>();

  constructor() {
    // Initialize Langfuse if credentials are available
    const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
    const secretKey = process.env.LANGFUSE_SECRET_KEY;
    const baseUrl = process.env.LANGFUSE_BASE_URL || 'https://cloud.langfuse.com';

    if (publicKey && secretKey) {
      try {
        this.langfuse = new Langfuse({
          publicKey,
          secretKey,
          baseUrl
        });
        console.log('Langfuse observability initialized');
      } catch (error) {
        console.error('Failed to initialize Langfuse:', error);
        // Don't throw - graceful degradation
      }
    } else {
      console.warn('Langfuse credentials not configured - observability disabled');
    }
  }

  /**
   * Start tracing a model call
   */
  async beforeModelCall(input: LangfuseModelInput, context: HookContext): Promise<LangfuseTrace> {
    const traceId = `trace_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const trace: LangfuseTrace = {
      id: traceId,
      sessionId: context.sessionId,
      userId: context.actorIdentity?.actorId,
      metadata: {
        harness: input.harness,
        taskType: input.taskType,
        role: context.actorIdentity?.role,
        requestId: context.requestId,
        timestamp: new Date().toISOString()
      }
    };

    this.traces.set(traceId, trace);

    if (this.langfuse) {
      try {
        // Create Langfuse trace
        const langfuseTrace = this.langfuse.trace({
          id: traceId,
          name: `agent_${input.harness || 'foundation'}`,
          userId: context.actorIdentity?.actorId,
          metadata: trace.metadata,
          input: {
            message: input.input,
            taskType: input.taskType
          }
        });

        // Store trace reference
        trace.metadata.langfuseTrace = langfuseTrace;

      } catch (error) {
        console.error('Failed to create Langfuse trace:', error);
      }
    }

    return trace;
  }

  /**
   * Complete tracing after model call
   */
  async afterModelCall(output: LangfuseModelOutput, context: HookContext): Promise<void> {
    const trace = Array.from(this.traces.values()).find(t =>
      t.sessionId === context.sessionId && t.userId === context.actorIdentity?.actorId
    );

    if (!trace) {
      console.warn('No trace found for model call completion');
      return;
    }

    if (this.langfuse) {
      try {
        // Create generation span for the model call
        const generation = this.langfuse.generation({
          name: 'model_completion',
          traceId: trace.id,
          input: output.input,
          output: output.output,
          model: this.getModelName(context.domainHarness?.model || 'sonnet'),
          modelParameters: {
            temperature: context.domainHarness?.temperature || 0.5,
            maxTokens: context.domainHarness?.maxTokens || 2048
          },
          startTime: new Date(Date.now() - output.latency),
          endTime: new Date(),
          completionStartTime: new Date(Date.now() - output.latency + 100), // Estimate
          usage: {
            input: this.estimateTokens(output.input),
            output: output.tokens || this.estimateTokens(output.output),
            total: (output.tokens || this.estimateTokens(output.output)) + this.estimateTokens(output.input)
          },
          metadata: {
            toolCalls: output.toolCalls.length,
            harness: context.domainHarness?.name
          }
        });

        // Create spans for tool calls
        for (let i = 0; i < output.toolCalls.length; i++) {
          const toolCall = output.toolCalls[i]!;

          this.langfuse.span({
            name: `tool_${toolCall.name}`,
            traceId: trace.id,
            input: toolCall.input,
            output: toolCall.output,
            startTime: new Date(Date.now() - output.latency + (i * 50)),
            endTime: new Date(Date.now() - output.latency + ((i + 1) * 50)),
            metadata: {
              toolName: toolCall.name,
              role: context.actorIdentity?.role
            }
          });
        }

        // Update trace with final output
        const langfuseTrace = trace.metadata.langfuseTrace as any;
        if (langfuseTrace) {
          langfuseTrace.update({
            output: {
              response: output.output,
              toolCalls: output.toolCalls.length,
              tokens: output.tokens,
              latency: output.latency
            },
            metadata: {
              ...trace.metadata,
              completedAt: new Date().toISOString(),
              tokenUsage: output.tokens,
              latencyMs: output.latency
            }
          });
        }

        // Flush to ensure data is sent
        await this.langfuse.flushAsync();

      } catch (error) {
        console.error('Failed to complete Langfuse trace:', error);
      }
    }

    // Clean up local trace
    this.traces.delete(trace.id);
  }

  /**
   * Create a custom event for specific interactions
   */
  async logEvent(
    name: string,
    data: Record<string, unknown>,
    context: HookContext,
    level: 'DEBUG' | 'DEFAULT' | 'WARNING' | 'ERROR' = 'DEFAULT'
  ): Promise<void> {
    if (this.langfuse) {
      try {
        this.langfuse.event({
          name,
          input: data,
          metadata: {
            sessionId: context.sessionId,
            userId: context.actorIdentity?.actorId,
            role: context.actorIdentity?.role,
            harness: context.domainHarness?.name,
            requestId: context.requestId,
            level
          }
        });
      } catch (error) {
        console.error('Failed to log Langfuse event:', error);
      }
    }

    // Also log to console for immediate debugging
    console.log(`[${level}] ${name}:`, data);
  }

  /**
   * Create a score/evaluation for a conversation
   */
  async scoreConversation(
    traceId: string,
    score: number,
    name: string,
    comment?: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    if (this.langfuse) {
      try {
        this.langfuse.score({
          traceId,
          name,
          value: score,
          comment,
          metadata
        });

        await this.langfuse.flushAsync();
      } catch (error) {
        console.error('Failed to score conversation:', error);
      }
    }
  }

  /**
   * Get analytics for a session
   */
  getSessionAnalytics(sessionId: string): {
    totalTraces: number;
    totalTokens: number;
    avgLatency: number;
    toolCallCount: number;
  } {
    const sessionTraces = Array.from(this.traces.values()).filter(t => t.sessionId === sessionId);

    return {
      totalTraces: sessionTraces.length,
      totalTokens: sessionTraces.reduce((sum, t) => sum + (t.metadata.tokenUsage as number || 0), 0),
      avgLatency: sessionTraces.reduce((sum, t) => sum + (t.metadata.latencyMs as number || 0), 0) / sessionTraces.length || 0,
      toolCallCount: sessionTraces.reduce((sum, t) => sum + (t.metadata.toolCalls as number || 0), 0)
    };
  }

  /**
   * Shutdown and flush remaining traces
   */
  async shutdown(): Promise<void> {
    if (this.langfuse) {
      try {
        await this.langfuse.shutdownAsync();
        console.log('Langfuse observability shutdown complete');
      } catch (error) {
        console.error('Error during Langfuse shutdown:', error);
      }
    }

    this.traces.clear();
  }

  /**
   * Get model name for Langfuse
   */
  private getModelName(modelType: string): string {
    const modelMap = {
      'haiku': 'claude-haiku-4-5',
      'sonnet': 'claude-sonnet-4'
    };

    return modelMap[modelType as keyof typeof modelMap] || 'claude-unknown';
  }

  /**
   * Estimate token count (rough approximation)
   */
  private estimateTokens(text: string): number {
    // Rough estimate: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }

  /**
   * Check if Langfuse is available
   */
  isEnabled(): boolean {
    return this.langfuse !== null;
  }

  /**
   * Create mock trace for testing
   */
  static createMockTrace(sessionId: string, userId: string): LangfuseTrace {
    return {
      id: `mock_trace_${Date.now()}`,
      sessionId,
      userId,
      metadata: {
        harness: 'test_harness',
        taskType: 'test_task',
        role: 'student',
        timestamp: new Date().toISOString()
      }
    };
  }
}