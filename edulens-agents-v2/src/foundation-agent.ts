/**
 * Foundation Agent - Strands Agent SDK orchestrator with domain harness support
 */

import { Agent } from '@strands-agents/sdk';
import type { MessageData } from '@strands-agents/sdk';
import { ActorIdentity, DomainHarness, AgentResponse, HookContext, ConversationTurn } from './shared/types.js';
import { ModelRouter, TaskType } from './model-router.js';
import { HarnessLoader, harnessLoader } from './harness-loader.js';
import { IdentityHook } from './hooks/identity-hook.js';
import { RBACHook } from './hooks/rbac-hook.js';
import { GuardrailHook } from './hooks/guardrail-hook.js';
import { LangfuseHook } from './hooks/langfuse-hook.js';
import { AuditHook } from './hooks/audit-hook.js';
import { getToolByName } from './tools/index.js';
import { registerToolGuards } from './tools/rbac-wrapper.js';

export interface FoundationAgentConfig {
  harnessName: string;
  sessionId?: string;
  jwtToken?: string;
  conversationHistory?: ConversationTurn[];
  fallbackIdentity?: {
    actorId: string;
    role: string;
    studentId?: string;
    children?: string[];
  };
}

export class FoundationAgent {
  private readonly modelRouter: ModelRouter;
  private readonly harnessLoader: HarnessLoader;
  private harness?: DomainHarness;
  private systemPrompt?: string;
  private actorIdentity?: ActorIdentity;
  private conversationHistory: ConversationTurn[] = [];

  // Hook instances
  private readonly identityHook: IdentityHook;
  private readonly rbacHook: RBACHook;
  private readonly guardrailHook: GuardrailHook;
  private readonly langfuseHook: LangfuseHook;
  private readonly auditHook: AuditHook;

  constructor(
    private readonly config: FoundationAgentConfig
  ) {
    this.modelRouter = new ModelRouter();
    this.harnessLoader = harnessLoader;

    // Initialize hooks
    this.identityHook = new IdentityHook();
    this.rbacHook = new RBACHook();
    this.guardrailHook = new GuardrailHook();
    this.langfuseHook = new LangfuseHook();
    this.auditHook = new AuditHook();

    // Initialize conversation history
    if (this.config.conversationHistory) {
      this.conversationHistory = [...this.config.conversationHistory];
    }
  }

  /**
   * Initialize the agent with harness and identity
   */
  async initialize(): Promise<void> {
    try {
      // Load domain harness
      this.harness = await this.harnessLoader.loadHarness(this.config.harnessName);
      this.systemPrompt = await this.harnessLoader.loadSystemPrompt(this.harness.systemPromptFile);

      // Extract actor identity from JWT, or use fallback from request body
      if (this.config.jwtToken) {
        this.actorIdentity = await this.identityHook.extractIdentity(this.config.jwtToken);
      } else if (this.config.fallbackIdentity) {
        this.actorIdentity = {
          actorId: this.config.fallbackIdentity.actorId,
          role: this.config.fallbackIdentity.role as 'student' | 'parent' | 'admin',
          studentId: this.config.fallbackIdentity.studentId,
          children: this.config.fallbackIdentity.children || [],
        };
      }

      console.log(`Foundation Agent initialized with harness: ${this.harness.name}`);
    } catch (error) {
      throw new Error(`Failed to initialize Foundation Agent: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Process a user input through the full hook chain
   */
  async processInput(userInput: string, taskType: TaskType = 'conversation'): Promise<AgentResponse> {
    if (!this.harness) {
      throw new Error('Foundation Agent not initialized. Call initialize() first.');
    }

    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    try {
      // Create hook context
      const hookContext: HookContext = {
        actorIdentity: this.actorIdentity,
        domainHarness: this.harness,
        sessionId: this.config.sessionId,
        requestId,
        metadata: {}
      };

      // Domain-level RBAC check
      if (this.harness.allowedRoles && this.actorIdentity) {
        if (!this.harness.allowedRoles.includes(this.actorIdentity.role)) {
          return {
            response: `Access denied. The ${this.harness.name} domain requires role: ${this.harness.allowedRoles.join(' or ')}. Your role (${this.actorIdentity.role}) does not have access. Please use the appropriate domain for your role.`,
            blocked: true,
            reason: `Role ${this.actorIdentity.role} not allowed in domain ${this.harness.name}`
          };
        }
      }

      // BeforeModelCall hooks
      await this.auditHook.beforeModelCall({ input: userInput, taskType }, hookContext);

      const guardrailResult = await this.guardrailHook.beforeModelCall({ input: userInput }, hookContext);
      if (guardrailResult.blocked) {
        return {
          response: 'Your message was blocked by our safety filters.',
          blocked: true,
          reason: guardrailResult.reason
        };
      }

      // Select model via ModelRouter based on task type and harness config
      const model = this.modelRouter.getModelForTask(taskType, this.harness);

      // Resolve harness tool names to registered Strands tool instances
      const agentTools = this.harness.tools
        .map(name => getToolByName(name))
        .filter((t): t is NonNullable<typeof t> => t != null);

      // Convert existing conversation history to Strands MessageData format
      const messages: MessageData[] = this.conversationHistory.map(turn => ({
        role: turn.role,
        content: [{ text: turn.content }]
      }));

      // Create a Strands Agent wired to the harness model, tools, and system prompt
      const strandsAgent = new Agent({
        model,
        tools: agentTools,
        systemPrompt: this.systemPrompt ?? '',
        messages,
        printer: false
      });

      // Register RBAC + observability hooks on every tool call via Strands native hook system
      registerToolGuards(strandsAgent, this.rbacHook, this.langfuseHook, hookContext);

      // Invoke the agent and extract the text response
      const result = await strandsAgent.invoke(userInput);
      let responseText = result.toString();

      // Output guardrail check — retry once if blocked
      const outputCheck = await this.guardrailHook.beforeResponse(
        { response: responseText },
        hookContext
      );
      if (outputCheck.blocked) {
        console.warn(`[GUARDRAIL] Output blocked: ${outputCheck.reason}. Retrying...`);
        // Retry with a safety nudge appended to the conversation
        const retryResult = await strandsAgent.invoke(
          'Please rephrase your previous response. Do not reveal student IDs, do not make admission predictions, and do not compare siblings.'
        );
        const retryText = retryResult.toString();
        const retryCheck = await this.guardrailHook.beforeResponse(
          { response: retryText },
          hookContext
        );
        if (retryCheck.blocked) {
          console.error(`[GUARDRAIL] Retry also blocked: ${retryCheck.reason}. Using safe fallback.`);
          responseText = "Let's work through this together! Can you tell me what you noticed about the question? What clues stood out to you?";
        } else {
          responseText = retryText;
        }
      }

      // Add to conversation history
      this.conversationHistory.push(
        { role: 'user', content: userInput, timestamp: new Date().toISOString() },
        { role: 'assistant', content: responseText, timestamp: new Date().toISOString() }
      );

      // AfterModelCall hooks
      await this.auditHook.afterModelCall(
        { input: userInput, output: responseText, toolCalls: [] },
        hookContext
      );

      return {
        response: responseText,
        metadata: {
          requestId,
          toolCalls: agentTools.length,
          harness: this.harness.name,
          actorId: this.actorIdentity?.actorId
        }
      };

    } catch (error) {
      console.error('Error processing input:', error);

      return {
        response: 'I apologize, but I encountered an error processing your request. Please try again.',
        blocked: true,
        reason: 'Internal error'
      };
    }
  }

  /**
   * Get current actor identity
   */
  getActorIdentity(): ActorIdentity | undefined {
    return this.actorIdentity;
  }

  /**
   * Get current domain harness
   */
  getDomainHarness(): DomainHarness | undefined {
    return this.harness;
  }

  /**
   * Get conversation history
   */
  getConversationHistory(): ConversationTurn[] {
    return [...this.conversationHistory];
  }

  /**
   * Clear conversation history
   */
  clearConversation(): void {
    this.conversationHistory = [];
  }

  /**
   * Update system prompt (useful for dynamic prompt engineering)
   */
  async updateSystemPrompt(promptFile: string): Promise<void> {
    this.systemPrompt = await this.harnessLoader.loadSystemPrompt(promptFile);
    console.log('System prompt updated:', promptFile);
  }
}