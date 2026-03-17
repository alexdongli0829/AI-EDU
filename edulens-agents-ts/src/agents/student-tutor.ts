/**
 * Student Tutor Agent — Strands Agent with Bedrock AgentCore Runtime entry point.
 *
 * A patient, encouraging Socratic tutor that helps primary school students
 * understand questions they got wrong on NSW OC or Selective School practice tests.
 */

import { BedrockAgentCoreApp } from 'bedrock-agentcore/runtime';
import { Agent, BedrockModel } from '@strands-agents/sdk';
import { z } from 'zod';

import { studentTutorTools } from '../tools/student-tutor-tools.js';
import { retrieveMemoriesTool } from '../tools/memory-tools.js';
import { checkInputGuardrails } from '../guardrails/input-guardrail.js';
import { extractSignals } from '../guardrails/signal-extraction.js';
import { AgentResponse } from '../shared/types.js';

console.log('Starting Student Tutor Agent...');

// ---- System prompt ----
const STUDENT_TUTOR_SYSTEM_PROMPT = `You are a patient, encouraging Socratic tutor for EduLens, helping a primary school student understand a question they got wrong on a NSW OC or Selective School practice test.

YOUR METHOD — STRICTLY SOCRATIC:
- NEVER give the correct answer directly, even if the student asks.
- Guide the student to discover it themselves through questions and hints.
- Start with the most minimal hint. Only go deeper if still stuck.
- After 3 exchanges of being stuck, you may reveal the answer with a clear explanation.
- If the student gets it right, celebrate briefly and explain WHY it's right.

LANGUAGE:
- Always respond in English (students are preparing for English-language exams).

TONE:
- Age-appropriate for 9-12 year olds.
- Encouraging but honest.
- Keep responses short: 2-4 sentences maximum.
- Use simple vocabulary.

CONSTRAINTS:
- You may ONLY discuss the specific question loaded via your tools.
- Do NOT answer unrelated questions or engage in general tutoring.
- Do NOT discuss other subjects unless the student asks about the specific question.
- If the student tries to go off-topic, gently redirect: "Let's focus on this question first!"

IMPORTANT: At the start of the conversation, ALWAYS call load_question_context first to understand which question the student got wrong and what their answer was. Then begin your Socratic guidance.`;

// ---- Model config ----
const MODEL_ID = process.env.MODEL_ID || 'us.anthropic.claude-sonnet-4-20250514-v1:0';

// ---- Create agent ----
const model = new BedrockModel({
  modelId: MODEL_ID,
  temperature: 0.5, // Slightly more creative for tutoring
  stream: true,
});

const agent = new Agent({
  model,
  tools: [...studentTutorTools, retrieveMemoriesTool],
  systemPrompt: STUDENT_TUTOR_SYSTEM_PROMPT,
});

// ---- BedrockAgentCoreApp setup ----
const app = new BedrockAgentCoreApp({
  invocationHandler: {
    requestSchema: z.object({
      prompt: z.string().default("I don't know how to solve this."),
      studentId: z.string().optional().default('mock-student-001'),
      questionId: z.string().optional().default('mock-q-001'),
      conversationHistory: z.array(z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      })).optional().default([]),
    }),

    process: async function* (request, context) {
      const { prompt: userInput, studentId, questionId, conversationHistory } = request;

      console.log(`Student Tutor received: ${userInput.slice(0, 100)} (student: ${studentId}, question: ${questionId}, history: ${conversationHistory.length} turns)`);

      // Pre-check input guardrails (students need content filtering too)
      const guardrailResult = checkInputGuardrails(userInput);
      if (guardrailResult.blocked) {
        console.log(`Input blocked by guardrail: ${guardrailResult.reason}`);

        const blockedResponse: AgentResponse = {
          response: guardrailResult.redirect_message || 'Your message was blocked by our safety filters.',
          blocked: true,
          reason: guardrailResult.reason,
        };

        yield { event: 'message', data: { text: JSON.stringify(blockedResponse) } };
        return;
      }

      // Build context-enriched prompt with conversation history
      const parts: string[] = [];

      // Inject student/question context
      parts.push(`[Context: student_id=${studentId}, question_id=${questionId}. Use these when calling tools. Never ask the student for IDs.]`);

      // Include conversation history for multi-turn
      if (conversationHistory && conversationHistory.length > 0) {
        parts.push('\n[Previous conversation:]');
        for (const msg of conversationHistory) {
          const { role, content } = msg;
          if ((role === 'user' || role === 'assistant') && content) {
            const label = role === 'user' ? 'Student' : 'Tutor';
            parts.push(`${label}: ${content}`);
          }
        }
        parts.push('[End of previous conversation]\n');
      }

      parts.push(`Student: ${userInput}`);
      const enrichedPrompt = parts.join('\n');

      try {
        // Stream agent response
        let responseText = '';

        for await (const agentEvent of agent.stream(enrichedPrompt)) {
          if (agentEvent.type === 'modelStreamUpdateEvent') {
            const modelEvent = agentEvent.event;
            if (modelEvent.type === 'modelContentBlockDeltaEvent' && modelEvent.delta.type === 'textDelta') {
              const text = modelEvent.delta.text;
              responseText += text;
              yield { event: 'message', data: { text } };
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

        // Final response with signals
        const finalResponse: AgentResponse = {
          response: responseText,
          signals: signals.map(s => ({
            type: s.type,
            value: s.value,
            confidence: s.confidence,
          })),
        };

        yield { event: 'message', data: { text: JSON.stringify({ signals: finalResponse.signals }) } };

      } catch (error) {
        console.error('Error in student tutor agent:', error);
        yield { event: 'message', data: { text: 'I apologize, but I encountered an error. Please try again.' } };
      }
    },
  },
});

// Run the application
console.log('Student Tutor Agent listening on port 8080...');
app.run();