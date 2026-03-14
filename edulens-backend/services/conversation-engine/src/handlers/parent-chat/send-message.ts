/**
 * Send Parent Chat Message Handler
 *
 * Improvements over the original placeholder:
 *  1. Profile grounding  — loads the student's Learning DNA before every call
 *  2. 3-tier memory      — injects Tier-2 conversation summaries for cross-session recall
 *  3. Agent state machine — transitions IDLE → PROCESSING → RESPONDING → WAITING_FEEDBACK
 *  4. Token-budget prompt — structured system prompt with explicit data sections
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { getPrismaClient } from '../../lib/database';
import { getChatCompletion, Message } from '../../lib/bedrock';

// How many recent turns to keep verbatim in the context window
const MAX_HISTORY_TURNS = 10;
// How many Tier-2 summaries to inject for cross-session recall
const MAX_MEMORY_SUMMARIES = 3;

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  console.log('Send parent chat message:', { path: event.path, method: event.httpMethod });

  const prisma = await getPrismaClient();

  try {
    const sessionId = event.pathParameters?.sessionId;
    if (!sessionId) return error(400, 'sessionId is required');

    if (!event.body) return error(400, 'Request body is required');

    const { message } = JSON.parse(event.body);
    if (!message) return error(400, 'message is required');

    // ----------------------------------------------------------------
    // 1. Load session and verify it's active
    // ----------------------------------------------------------------
    const sessions = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id, user_id, student_id, agent_type, status
       FROM chat_sessions WHERE id = $1 AND status = 'active'`,
      sessionId
    );
    if (!sessions?.length) return error(404, 'Chat session not found or inactive');

    const session = sessions[0];
    const studentId: string | null = session.student_id;

    // ----------------------------------------------------------------
    // 2. Transition: IDLE → PROCESSING
    // ----------------------------------------------------------------
    await prisma.$executeRawUnsafe(
      `UPDATE chat_sessions SET agent_state = 'processing' WHERE id = $1`,
      sessionId
    );

    // ----------------------------------------------------------------
    // 3. Persist the user message
    // ----------------------------------------------------------------
    const userMessageId = uuidv4();
    await prisma.$executeRawUnsafe(
      `INSERT INTO chat_messages (id, session_id, role, content, timestamp)
       VALUES ($1, $2, 'user', $3, NOW())`,
      userMessageId, sessionId, message
    );

    // ----------------------------------------------------------------
    // 4. Load context for the AI
    //    a) Student Learning DNA (Tier 3 — permanent profile)
    //    b) Conversation memory summaries (Tier 2 — cross-session recall)
    //    c) Recent message history (Tier 1 — current + cached)
    // ----------------------------------------------------------------
    const [profile, memories, rawHistory] = await Promise.all([
      loadStudentProfile(prisma, studentId),
      loadConversationMemories(prisma, studentId),
      loadMessageHistory(prisma, sessionId, MAX_HISTORY_TURNS * 2),
    ]);

    // ----------------------------------------------------------------
    // 5. Build the grounded system prompt
    // ----------------------------------------------------------------
    const systemPrompt = buildSystemPrompt(profile, memories);

    // Convert DB rows → Bedrock message format
    const chatHistory: Message[] = rawHistory.map((m: any) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    // ----------------------------------------------------------------
    // 6. Call the AI — transition PROCESSING → RESPONDING
    // ----------------------------------------------------------------
    await prisma.$executeRawUnsafe(
      `UPDATE chat_sessions SET agent_state = 'responding' WHERE id = $1`,
      sessionId
    );

    const aiResponse = await getChatCompletion(chatHistory, systemPrompt);

    // ----------------------------------------------------------------
    // 7. Persist the assistant message
    // ----------------------------------------------------------------
    const assistantMessageId = uuidv4();
    await prisma.$executeRawUnsafe(
      `INSERT INTO chat_messages (id, session_id, role, content, timestamp)
       VALUES ($1, $2, 'assistant', $3, NOW())`,
      assistantMessageId, sessionId, aiResponse
    );

    // ----------------------------------------------------------------
    // 8. Transition: RESPONDING → WAITING_FEEDBACK
    // ----------------------------------------------------------------
    await prisma.$executeRawUnsafe(
      `UPDATE chat_sessions SET agent_state = 'waiting_feedback' WHERE id = $1`,
      sessionId
    );

    return success({
      success: true,
      userMessageId,
      assistantMessageId,
      response: aiResponse,
      agentState: 'waiting_feedback',
    });
  } catch (err) {
    console.error('Send parent chat message error:', err);

    // Best-effort: reset agent state on error
    try {
      const prismaReset = await getPrismaClient();
      const sessionId = event.pathParameters?.sessionId;
      if (sessionId) {
        await prismaReset.$executeRawUnsafe(
          `UPDATE chat_sessions SET agent_state = 'idle' WHERE id = $1`,
          sessionId
        );
      }
    } catch { /* ignore */ }

    return error(500, 'Internal server error');
  }
}

// ---------------------------------------------------------------------------
// Context loaders
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

async function loadConversationMemories(
  prisma: any,
  studentId: string | null
): Promise<any[]> {
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

async function loadMessageHistory(
  prisma: any,
  sessionId: string,
  limit: number
): Promise<any[]> {
  return prisma.$queryRawUnsafe<any[]>(
    `SELECT role, content FROM chat_messages
     WHERE session_id = $1
     ORDER BY timestamp ASC
     LIMIT $2`,
    sessionId, limit
  );
}

// ---------------------------------------------------------------------------
// System prompt builder — injects Learning DNA + Tier-2 memory
// ---------------------------------------------------------------------------

function buildSystemPrompt(profile: any | null, memories: any[]): string {
  const lines: string[] = [];

  lines.push(
    `You are an AI educational advisor for EduLens, helping parents understand their child's`,
    `learning progress for NSW OC and Selective School exam preparation.`,
    ``,
    `## Your Rules`,
    `- Ground every response in the student data provided below. Quote specific numbers.`,
    `- Be specific (e.g. "She got 6/10 on number patterns") not generic ("math is low").`,
    `- Be supportive and constructive.`,
    `- Stay focused on the student's educational progress. Decline off-topic requests politely.`,
    `- If you don't have enough data to answer confidently, say so.`,
  );

  // --- Tier 3: Learning DNA ---
  if (profile) {
    lines.push(``, `## Student Learning DNA`);
    lines.push(`**Overall Mastery:** ${(profile.overall_mastery * 100).toFixed(0)}%`);

    if (profile.strengths?.length) {
      lines.push(`**Strengths:** ${profile.strengths.join(', ')}`);
    }
    if (profile.weaknesses?.length) {
      lines.push(`**Areas Needing Work:** ${profile.weaknesses.join(', ')}`);
    }

    const skillGraph: any[] = profile.skill_graph ?? [];
    if (skillGraph.length) {
      const sorted = [...skillGraph].sort((a, b) => b.mastery_level - a.mastery_level);
      lines.push(``, `**Top Skills:**`);
      for (const s of sorted.slice(0, 5)) {
        const pct = (s.mastery_level * 100).toFixed(0);
        const conf = (s.confidence * 100).toFixed(0);
        lines.push(`- ${s.skill_name}: ${pct}% mastery (${s.attempts} attempts, ${conf}% confidence)`);
      }
      if (sorted.length > 5) {
        lines.push(``, `**Weakest Skills:**`);
        for (const s of sorted.slice(-3).reverse()) {
          const pct = (s.mastery_level * 100).toFixed(0);
          lines.push(`- ${s.skill_name}: ${pct}% mastery (${s.attempts} attempts)`);
        }
      }
    }

    const errorPatterns: any[] = profile.error_patterns ?? [];
    if (errorPatterns.length) {
      lines.push(``, `**Error Patterns:**`);
      for (const p of errorPatterns.slice(0, 3)) {
        lines.push(`- ${p.error_type.replace(/_/g, ' ')}: ${p.frequency} occurrences (${p.severity} severity)`);
      }
    }

    const tb = profile.time_behavior;
    if (tb) {
      lines.push(``, `**Time Behaviour:**`);
      lines.push(`- Avg time per question: ${Number(tb.average_speed ?? 0).toFixed(0)}s`);
      if ((tb.rushing_indicator ?? 0) > 0.3) {
        lines.push(`- Rushing detected: ${((tb.rushing_indicator ?? 0) * 100).toFixed(0)}% of questions answered too quickly`);
      }
      if (tb.hesitation_pattern?.length) {
        lines.push(`- Hesitates on: ${tb.hesitation_pattern.join(', ')}`);
      }
    }
  } else {
    lines.push(
      ``,
      `## Student Data`,
      `No profile available yet. Encourage the parent to have their child complete a test first.`
    );
  }

  // --- Tier 2: Cross-session recall ---
  if (memories.length > 0) {
    lines.push(``, `## Previous Conversations (for context)`);
    for (const mem of memories) {
      const topics =
        Array.isArray(mem.key_topics) && mem.key_topics.length
          ? ` (topics: ${mem.key_topics.join(', ')})`
          : '';
      lines.push(`- ${mem.summary}${topics}`);
    }
    lines.push(
      ``,
      `Reference prior conversations naturally when the parent asks about something discussed before.`
    );
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

function success(data: object): APIGatewayProxyResult {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': 'true',
    },
    body: JSON.stringify(data),
  };
}

function error(statusCode: number, message: string): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': 'true',
    },
    body: JSON.stringify({ success: false, error: message }),
  };
}
