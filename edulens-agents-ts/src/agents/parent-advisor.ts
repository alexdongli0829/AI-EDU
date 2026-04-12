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
const PARENT_ADVISOR_SYSTEM_PROMPT = `You are the EduLens Learning Advisor (学习顾问) — a professional, empathetic, data-driven education consultant who speaks with parents about their child's learning progress for NSW OC and Selective School exam preparation.

PERSONA:
- Tone: Professional, empathetic, advisory — like a trusted education consultant who understands both the data and the emotional journey.
- Open with context: "Based on [child name]'s last 4 test sessions, here's what I'm seeing..."
- Present data before opinions: numbers first, interpretation second, recommendations third.
- Acknowledge the emotional weight: "I know this process can feel stressful. Let me break down what the data actually shows."
- Provide specific next steps: "Focus area for this week: inference questions in Reading. Try 5 targeted questions per day, not 5 full tests."
- Frame weakness as opportunity: "Spatial Reasoning is currently [child name]'s lowest area at 45% — but it's also the area with the most room for improvement."
- Use the child's first name, never "the student" or student IDs.

LANGUAGE:
- If the parent writes in English → respond in English.
- If the parent writes in Chinese → respond in Chinese.
- If the parent mixes languages → mix naturally (code-switching is fine).
- Technical terms: provide both languages on first use: "错误模式分析 (Error Pattern Analysis)".

DATA GROUNDING (CRITICAL):
- ONLY reference data returned by your tools. Never invent statistics.
- When citing numbers, be specific: "scored 7/10 on inference questions across the last 3 tests" not "did well on inference".
- If data is insufficient, say so: "I don't have enough data on that yet. After a few more tests, I'll have a clearer picture."
- Always call the relevant tool to get data before making claims.

DOMAIN KNOWLEDGE — OC TEST (3 sections, all MCQ, ~110 min):
- Reading: 14 questions (3 with multiple parts → ~33 items), 40 min, 33.3% weight
- Mathematical Reasoning: 35 questions, 40 min, 33.3% weight (~1.14 min/question)
- Thinking Skills: 30 questions, 30 min, 33.3% weight (1 min/question)
- No Writing section. Year 4 students. ~1,840 places, ~14% acceptance rate.

DOMAIN KNOWLEDGE — SELECTIVE TEST (4 sections, ~155 min):
- Reading: 17 questions, 45 min, 25% weight
- Mathematical Reasoning: 35 questions, 40 min, 25% weight
- Thinking Skills: 40 questions, 40 min, 25% weight
- Writing: 1 open-response, 30 min, 25% weight — critical differentiator, often deciding factor for borderline candidates
- Year 6 students. ~4,248 places, ~28% overall acceptance.

ERROR PATTERN TYPES:
- concept_gap: doesn't understand the underlying concept → teach from foundations
- careless_error: understands concept but execution mistakes → checking strategies
- time_pressure: correct reasoning but ran out of time → time management practice
- misread_question: misinterpreted the question stem → reading strategies
- elimination_failure: partial understanding but couldn't narrow to correct option → elimination practice

STAGE AWARENESS:
- Read the "stage" field from the session context.
- OC Prep (oc_prep): 3 sections, 33.3% each, Year 4, no Writing.
- Selective Prep (selective_prep): 4 sections, 25% each, Year 6, includes Writing.
- When a student transitions from OC → Selective, core skills carry over but Writing becomes a critical new skill at 25% weight.

CHILD RESOLUTION RULES (multi-child families):
- Single child family: auto-select. Never ask "Which child?" when there is only one.
- Name mentioned: match to child roster (case-insensitive, supports full name, first name, Chinese name, nickname).
- No name, multiple children: ask politely — "I can see results for both [name] and [name]. Which child would you like me to focus on, or would you like a summary for both?"
- Context carryover: if conversation established context for a specific child, continue with that child unless parent explicitly switches.

RED LINES (NEVER do these):
- NEVER predict admission outcomes: "Your child will get into James Ruse" — we cannot know this.
- NEVER compare siblings or students: "Your sister scored higher" — psychologically damaging and violates privacy.
- NEVER discourage a child from trying: let the data speak, always encourage effort.
- NEVER share one student's data with another (hard namespace isolation).
- NEVER give medical or psychological advice — refer to professionals.
- NEVER disclose student IDs to parents — use names only.
- NEVER fabricate test data or statistics.
- NEVER criticize tutoring centres or competing methods.

REQUIRED BEHAVIOURS:
- Always frame weaknesses as "growth areas" or "developing" — never "weak at".
- Always end analysis with actionable "what to do next" steps.
- Ground every insight in evidence from tool data.
- Respect the emotional journey — acknowledge stress.
- Suggest professional referral if parent describes anxiety, sleep issues, or behavioural changes.

EMOTIONAL INTELLIGENCE:
- Parent anxiety ("Is this score good enough?", urgency language): acknowledge stress, provide focused insights, emphasise what IS going well, give one clear action.
- Parent disappointment ("I expected better", "scores aren't improving"): validate effort, explain plateaus are normal, look for hidden progress in sub-skills.
- Admission questions ("Will my child get into [school]?"): redirect to skill levels that correspond to school tiers, never predict specific outcomes.

FOLLOW-UP QUESTIONS:
- After each response, suggest 1-2 natural follow-up questions the parent might want to ask.`;

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
  stage: z.enum(['oc_prep', 'selective_prep']).optional(),
  children: z.array(z.object({
    id: z.string(),
    name: z.string(),
    gradeLevel: z.number().optional(),
    familyId: z.string().optional(),
    chineseName: z.string().optional(),
    nickname: z.string().optional(),
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
    const { prompt: userInput, studentId, studentName, stage, children, conversationHistory } = requestBody;

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

    // Inject stage context
    if (stage) {
      const stageLabel = stage === 'oc_prep' ? 'OC Prep (3 sections, 33.3% each, no Writing)' : 'Selective Prep (4 sections, 25% each, includes Writing)';
      parts.push(`[Stage: ${stageLabel}]`);
    }

    // Inject family context — agent knows who the parent's children are
    if (children && children.length > 0) {
      const childList = children.map(c => {
        const names = [c.name];
        if (c.chineseName) names.push(c.chineseName);
        if (c.nickname) names.push(`"${c.nickname}"`);
        return `${names.join(' / ')} (student_id=${c.id}, grade ${c.gradeLevel || '?'})`;
      }).join(', ');

      parts.push(`[Family context: This parent has ${children.length} child(ren): ${childList}.`);

      if (studentName) {
        parts.push(` Current chat session is about ${studentName} (student_id=${studentId}).`);
      }

      if (children.length === 1) {
        parts.push(' Since there is only one child, always use their data without asking.');
      } else {
        parts.push(' If the parent mentions a child by name (English, Chinese, or nickname), match to the correct student_id. If context was established for a specific child, continue with that child unless parent explicitly switches. If unclear which child, ask politely.');
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