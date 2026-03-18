/**
 * Parent Advisor Agent — Strands Agent with Bedrock AgentCore Runtime entry point.
 *
 * An experienced, caring AI educational advisor that speaks with parents about
 * their child's learning progress for NSW OC and Selective School exam prep.
 */

import Fastify from 'fastify';
import { Agent, BedrockModel } from '@strands-agents/sdk';
import { z } from 'zod';

import { parentAdvisorTools } from '../tools/parent-advisor-tools.js';
import { retrieveMemoriesTool } from '../tools/memory-tools.js';
import { checkInputGuardrails } from '../guardrails/input-guardrail.js';
import { checkOutputGuardrails } from '../guardrails/output-guardrail.js';
import { extractSignals } from '../guardrails/signal-extraction.js';
import { AgentPayload, AgentResponse } from '../shared/types.js';

console.log('Starting Parent Advisor Agent...');

// ---- System prompt ----
const PARENT_ADVISOR_SYSTEM_PROMPT = `You are an experienced, caring AI educational advisor for EduLens, speaking with a parent about their child's learning progress for NSW OC and Selective School exam preparation.

VOICE & TONE:
- Speak like a trusted teacher at a parent-teacher conference.
- Be warm but direct. Parents want clarity, not vagueness.
- Use the student's first name, never "the student".
- Acknowledge effort and progress before discussing weaknesses.
- Frame weaknesses as opportunities, not deficits.

LANGUAGE:
- Default to English.
- If the parent writes in Chinese, respond in Chinese.
- If the parent writes in any other language, respond in English.

DATA GROUNDING (CRITICAL):
- ONLY reference data returned by your tools. Never invent statistics.
- When citing numbers, be specific: "scored 7/10 on inference questions across the last 3 tests" not "did well on inference".
- If data is insufficient, say so: "I don't have enough data on that yet. After a few more tests, I'll have a clearer picture."
- Always call the relevant tool to get data before making claims.

CONSTRAINTS:
- Do NOT make predictions about exam outcomes or school admissions.
- Do NOT provide medical, psychological, or behavioral advice.
- Do NOT compare the child to other students or benchmarks.
- Provide actionable recommendations: specific skills to practice, question types to focus on, time management tips.

FOLLOW-UP QUESTIONS:
- After each response, suggest 1-2 natural follow-up questions the parent might want to ask, based on areas of the profile not yet discussed.`;

// ---- Model config ----
const MODEL_ID = process.env.MODEL_ID || 'us.anthropic.claude-sonnet-4-20250514-v1:0';

// ---- Create agent ----
const model = new BedrockModel({
  modelId: MODEL_ID,
  temperature: 0.3,
  stream: true,
});

const agent = new Agent({
  model,
  tools: [...parentAdvisorTools, retrieveMemoriesTool],
  systemPrompt: PARENT_ADVISOR_SYSTEM_PROMPT,
});

// ---- Zod schema for request validation ----
const requestSchema = z.object({
  prompt: z.string(),
  studentId: z.string().optional().default('mock-student-001'),
  studentName: z.string().optional().default(''),
  children: z.array(z.object({
    id: z.string(),
    name: z.string(),
    gradeLevel: z.number().optional(),
  })).optional().default([]),
  conversationHistory: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).optional().default([]),
});

// ---- Fastify server setup ----
const server = Fastify({ logger: false });

// Health check endpoint
server.get('/ping', async () => ({ status: 'healthy' }));

// Main invocation endpoint
server.post('/invocations', async (request, reply) => {
  try {
    // Parse and validate the request body
    const requestBody = requestSchema.parse(request.body);
    const { prompt: userInput, studentId, studentName, children, conversationHistory } = requestBody;

    console.log(`Parent Advisor received: ${userInput.slice(0, 100)} (student: ${studentId}, children: ${children.length}, history: ${conversationHistory.length} turns)`);

    // Pre-check input guardrails
    const guardrailResult = checkInputGuardrails(userInput);
    if (guardrailResult.blocked) {
      console.log(`Input blocked by guardrail: ${guardrailResult.reason}`);

      const blockedResponse: AgentResponse = {
        response: guardrailResult.redirect_message || 'Your message was blocked by our safety filters.',
        blocked: true,
        reason: guardrailResult.reason,
      };

      reply.header('Content-Type', 'application/json');
      return blockedResponse;
    }

    // Build context-enriched prompt with conversation history
    const parts: string[] = [];

    // Inject family context — agent knows who the parent's children are
    if (children && children.length > 0) {
      const childList = children.map(c =>
        `${c.name} (student_id=${c.id}, grade ${c.gradeLevel || '?'})`
      ).join(', ');

      parts.push(`[Family context: This parent has ${children.length} child(ren): ${childList}.`);

      if (studentName) {
        parts.push(` Current chat session is about ${studentName} (student_id=${studentId}).`);
      }

      if (children.length === 1) {
        parts.push(' Since there is only one child, always use their data without asking.');
      } else {
        parts.push(' If the parent asks about a specific child by name, match to the correct student_id. If unclear which child, ask politely.');
      }
      parts.push(' NEVER show student IDs to the parent — use names only.]');
    } else {
      // Fallback: single student context
      let contextLine = `[Context: The parent is asking about student_id=${studentId}`;
      if (studentName) {
        contextLine += `, name=${studentName}`;
      }
      contextLine += '. Use this student_id when calling tools. Never ask the parent for their student ID.]';
      parts.push(contextLine);
    }

    // Include conversation history for multi-turn context
    if (conversationHistory && conversationHistory.length > 0) {
      parts.push('\n[Previous conversation:]');
      for (const msg of conversationHistory) {
        const { role, content } = msg;
        if ((role === 'user' || role === 'assistant') && content) {
          const label = role === 'user' ? 'Parent' : 'Advisor';
          parts.push(`${label}: ${content}`);
        }
      }
      parts.push('[End of previous conversation]\n');
    }

    parts.push(`Parent: ${userInput}`);
    const enrichedPrompt = parts.join('\n');

    // Stream agent response and collect all text
    let responseText = '';

    for await (const agentEvent of agent.stream(enrichedPrompt)) {
      if (agentEvent.type === 'modelStreamUpdateEvent') {
        const modelEvent = agentEvent.event;
        if (modelEvent.type === 'modelContentBlockDeltaEvent' && modelEvent.delta.type === 'textDelta') {
          const text = modelEvent.delta.text;
          responseText += text;
        }
      }
    }

    // Post-check output guardrails
    const violations = checkOutputGuardrails(responseText);
    if (violations.length > 0) {
      const violationSummary = violations.map(v => `[${v.type}] ${v.message}`).join('; ');
      console.warn(`Output guardrail violations: ${violationSummary}`);

      // Re-run with guardrail instructions appended
      const retryPrompt = (
        `${userInput}\n\n` +
        `IMPORTANT: Your previous response violated these rules: ${violationSummary}. ` +
        `Please respond without making predictions, comparisons, or medical advice.`
      );

      responseText = '';
      for await (const agentEvent of agent.stream(retryPrompt)) {
        if (agentEvent.type === 'modelStreamUpdateEvent') {
          const modelEvent = agentEvent.event;
          if (modelEvent.type === 'modelContentBlockDeltaEvent' && modelEvent.delta.type === 'textDelta') {
            const text = modelEvent.delta.text;
            responseText += text;
          }
        }
      }
    }

    // Extract signals for analytics
    const signals = extractSignals(userInput + ' ' + responseText);
    if (signals.length > 0) {
      console.log(
        `Extracted ${signals.length} signals: ${signals.map(s => `${s.type}:${s.value}`).join(', ')}`
      );
    }

    // Return final response with signals
    const finalResponse: AgentResponse = {
      response: responseText,
      signals: signals.map(s => ({
        type: s.type,
        value: s.value,
        confidence: s.confidence,
      })),
    };

    reply.header('Content-Type', 'application/json');
    return finalResponse;

  } catch (error) {
    console.error('Error in parent advisor agent:', error);
    const errorResponse: AgentResponse = {
      response: 'I apologize, but I encountered an error. Please try again.',
      blocked: true,
      reason: 'Internal error'
    };

    reply.header('Content-Type', 'application/json');
    return errorResponse;
  }
});

// Start the server
server.listen({ host: '0.0.0.0', port: 8080 }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`Parent Advisor Agent listening on ${address}`);
});