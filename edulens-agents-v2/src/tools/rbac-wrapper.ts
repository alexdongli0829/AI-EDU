/**
 * Tool RBAC Guard — uses Strands SDK native hook system to enforce RBAC on every tool call.
 *
 * This uses agent.addHook(BeforeToolCallEvent) to intercept tool calls
 * BEFORE execution, check RBAC permissions, and cancel unauthorized calls.
 * This is the proper Strands SDK pattern — no tool wrapping needed.
 */

import { BeforeToolCallEvent, AfterToolCallEvent } from '@strands-agents/sdk';
import type { Agent } from '@strands-agents/sdk';
import { RBACHook } from '../hooks/rbac-hook.js';
import { LangfuseHook } from '../hooks/langfuse-hook.js';
import { HookContext } from '../shared/types.js';

/**
 * Register RBAC + observability hooks on a Strands Agent instance.
 * Must be called after agent creation but before invoke().
 */
export function registerToolGuards(
  agent: Agent,
  rbacHook: RBACHook,
  langfuseHook: LangfuseHook,
  hookContext: HookContext
): void {
  // Before each tool call: check RBAC permissions
  agent.addHook(BeforeToolCallEvent, async (event) => {
    const { toolUse } = event;

    const rbacResult = await rbacHook.beforeToolCall(
      { toolName: toolUse.name, input: toolUse.input },
      hookContext
    );

    if (rbacResult.blocked) {
      console.warn(`[RBAC] Tool call blocked: ${toolUse.name} — ${rbacResult.reason}`);
      // Setting cancel to a string makes Strands use it as the tool result error message
      event.cancel = rbacResult.reason || `Access denied: you don't have permission to use ${toolUse.name}`;
    }
  });

  // After each tool call: track in Langfuse for observability
  agent.addHook(AfterToolCallEvent, (event) => {
    const { toolUse, error } = event;

    langfuseHook.trackToolCall({
      toolName: toolUse.name,
      input: toolUse.input,
      output: event.result?.toJSON?.() ?? null,
      duration: 0, // AfterToolCallEvent doesn't carry duration; Langfuse span timing handles it
      success: !error,
      error: error?.message
    }, hookContext);
  });
}
