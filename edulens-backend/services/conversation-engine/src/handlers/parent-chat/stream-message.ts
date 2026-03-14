/**
 * SSE Streaming Chat Handler for Parent Advisor
 *
 * Deployed via ALB + Lambda Response Streaming (awslambda.streamifyResponse).
 * Returns a text/event-stream response so the frontend's EventSource API
 * receives tokens as they arrive from Bedrock.
 *
 * Deployment note: Lambda function must be configured with
 *   InvokeMode = RESPONSE_STREAM  (function URL or ALB streaming).
 */

import { v4 as uuidv4 } from 'uuid';
import { getPrismaClient } from '../../lib/database';
import { streamChatCompletion, Message } from '../../lib/bedrock';

const MAX_HISTORY_TURNS = 10;
const MAX_MEMORY_SUMMARIES = 3;

// awslambda is injected by the Lambda runtime; declare here for TypeScript
declare const awslambda: {
  streamifyResponse: (
    handler: (event: any, responseStream: any, context: any) => Promise<void>
  ) => (event: any, context: any) => Promise<void>;
  HttpResponseStream: {
    from: (stream: any, metadata: object) => any;
  };
};

export const handler = awslambda.streamifyResponse(
  async (event: any, responseStream: any): Promise<void> => {
    const metadata = {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': 'true',
      },
    };

    const stream = awslambda.HttpResponseStream.from(responseStream, metadata);

    const writeSSE = (data: object) => {
      stream.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    try {
      // Parse request
      const sessionId: string | undefined =
        event.pathParameters?.sessionId ?? event.queryStringParameters?.sessionId;
      const body = event.body ? JSON.parse(event.body) : {};
      const { message } = body;

      if (!sessionId || !message) {
        writeSSE({ type: 'error', error: 'sessionId and message are required' });
        stream.end();
        return;
      }

      const prisma = await getPrismaClient();

      // Verify session
      const sessions = await prisma.$queryRawUnsafe<any[]>(
        `SELECT id, user_id, student_id, agent_type, status
         FROM chat_sessions WHERE id = $1 AND status = 'active'`,
        sessionId
      );
      if (!sessions?.length) {
        writeSSE({ type: 'error', error: 'Chat session not found or inactive' });
        stream.end();
        return;
      }

      const session = sessions[0];
      const studentId: string | null = session.student_id;

      // Transition: IDLE → PROCESSING
      await prisma.$executeRawUnsafe(
        `UPDATE chat_sessions SET agent_state = 'processing' WHERE id = $1`,
        sessionId
      );

      // Persist user message
      const userMessageId = uuidv4();
      await prisma.$executeRawUnsafe(
        `INSERT INTO chat_messages (id, session_id, role, content, timestamp)
         VALUES ($1, $2, 'user', $3, NOW())`,
        userMessageId, sessionId, message
      );

      // Load context
      const [profile, memories, rawHistory] = await Promise.all([
        loadStudentProfile(prisma, studentId),
        loadConversationMemories(prisma, studentId),
        loadMessageHistory(prisma, sessionId, MAX_HISTORY_TURNS * 2),
      ]);

      const systemPrompt = buildSystemPrompt(profile, memories);
      const chatHistory: Message[] = rawHistory.map((m: any) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

      // Signal that we're starting to respond
      writeSSE({ type: 'start', userMessageId });

      // Transition: PROCESSING → RESPONDING
      await prisma.$executeRawUnsafe(
        `UPDATE chat_sessions SET agent_state = 'responding' WHERE id = $1`,
        sessionId
      );

      // Stream tokens to client and accumulate full response
      let fullResponse = '';
      for await (const chunk of streamChatCompletion(chatHistory, systemPrompt)) {
        if (chunk.type === 'content' && chunk.content) {
          fullResponse += chunk.content;
          writeSSE({ type: 'token', content: chunk.content });
        } else if (chunk.type === 'error') {
          writeSSE({ type: 'error', error: chunk.error ?? 'Bedrock stream error' });
          stream.end();
          return;
        }
      }

      // Persist the complete assistant message
      const assistantMessageId = uuidv4();
      await prisma.$executeRawUnsafe(
        `INSERT INTO chat_messages (id, session_id, role, content, timestamp)
         VALUES ($1, $2, 'assistant', $3, NOW())`,
        assistantMessageId, sessionId, fullResponse
      );

      // Transition: RESPONDING → WAITING_FEEDBACK
      await prisma.$executeRawUnsafe(
        `UPDATE chat_sessions SET agent_state = 'waiting_feedback' WHERE id = $1`,
        sessionId
      );

      // Signal completion with suggested follow-ups
      writeSSE({
        type: 'done',
        assistantMessageId,
        agentState: 'waiting_feedback',
      });
    } catch (err) {
      console.error('Stream parent chat error:', err);
      writeSSE({ type: 'error', error: 'Internal server error' });
    } finally {
      stream.end();
    }
  }
);

// ---------------------------------------------------------------------------
// Context loaders (shared with send-message.ts)
// ---------------------------------------------------------------------------

async function loadStudentProfile(prisma: any, studentId: string | null): Promise<any | null> {
  if (!studentId) return null;
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT skill_graph, error_patterns, time_behavior, overall_mastery, strengths, weaknesses
       FROM student_profiles WHERE student_id = $1`,
      studentId
    );
    return rows?.[0] ?? null;
  } catch {
    return null;
  }
}

async function loadConversationMemories(prisma: any, studentId: string | null): Promise<any[]> {
  if (!studentId) return [];
  try {
    return await prisma.$queryRawUnsafe<any[]>(
      `SELECT summary, key_topics, insights_extracted, created_at
       FROM conversation_memory
       WHERE student_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      studentId, MAX_MEMORY_SUMMARIES
    );
  } catch {
    return [];
  }
}

async function loadMessageHistory(prisma: any, sessionId: string, limit: number): Promise<any[]> {
  return prisma.$queryRawUnsafe<any[]>(
    `SELECT role, content FROM chat_messages
     WHERE session_id = $1
     ORDER BY timestamp ASC
     LIMIT $2`,
    sessionId, limit
  );
}

// ---------------------------------------------------------------------------
// System prompt builder (same logic as send-message.ts)
// ---------------------------------------------------------------------------

function buildSystemPrompt(profile: any | null, memories: any[]): string {
  const lines: string[] = [];

  lines.push(
    `You are an AI educational advisor for EduLens, helping parents understand their child's`,
    `learning progress for NSW OC and Selective School exam preparation.`,
    ``,
    `## Your Rules`,
    `- Ground every response in the student data provided below. Quote specific numbers.`,
    `- Be specific, not generic. Reference actual skills, patterns, and trends.`,
    `- Be supportive and constructive.`,
    `- Stay focused on educational progress. Decline off-topic requests politely.`,
    `- If data is insufficient, say so and suggest completing more tests.`,
  );

  if (profile) {
    lines.push(``, `## Student Learning DNA`);
    lines.push(`**Overall Mastery:** ${(profile.overall_mastery * 100).toFixed(0)}%`);

    if (profile.strengths?.length) lines.push(`**Strengths:** ${profile.strengths.join(', ')}`);
    if (profile.weaknesses?.length) lines.push(`**Areas Needing Work:** ${profile.weaknesses.join(', ')}`);

    const skillGraph: any[] = profile.skill_graph ?? [];
    if (skillGraph.length) {
      const sorted = [...skillGraph].sort((a, b) => b.mastery_level - a.mastery_level);
      lines.push(``, `**Top Skills:**`);
      for (const s of sorted.slice(0, 5)) {
        const pct = (s.mastery_level * 100).toFixed(0);
        lines.push(`- ${s.skill_name}: ${pct}% mastery (${s.attempts} attempts)`);
      }
    }

    const errorPatterns: any[] = profile.error_patterns ?? [];
    if (errorPatterns.length) {
      lines.push(``, `**Error Patterns:**`);
      for (const p of errorPatterns.slice(0, 3)) {
        lines.push(`- ${p.error_type.replace(/_/g, ' ')}: ${p.frequency}× (${p.severity})`);
      }
    }

    const tb = profile.time_behavior;
    if (tb) {
      lines.push(``, `**Time Behaviour:**`);
      lines.push(`- Avg: ${Number(tb.average_speed ?? 0).toFixed(0)}s/question`);
      if ((tb.rushing_indicator ?? 0) > 0.3) {
        lines.push(`- Rushing on ${((tb.rushing_indicator ?? 0) * 100).toFixed(0)}% of questions`);
      }
    }
  } else {
    lines.push(``, `## Student Data`, `No profile yet — encourage the child to complete a test first.`);
  }

  if (memories.length > 0) {
    lines.push(``, `## Previous Conversations`);
    for (const mem of memories) {
      const topics = Array.isArray(mem.key_topics) && mem.key_topics.length
        ? ` (${mem.key_topics.join(', ')})` : '';
      lines.push(`- ${mem.summary}${topics}`);
    }
    lines.push(``, `Reference these when the parent asks about previously discussed topics.`);
  }

  return lines.join('\n');
}
