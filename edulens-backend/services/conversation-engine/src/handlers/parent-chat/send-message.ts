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
import { query } from '../../lib/database';
import { getChatCompletion, Message } from '../../lib/bedrock';

// How many recent turns to keep verbatim in the context window
const MAX_HISTORY_TURNS = 10;
// How many Tier-2 summaries to inject for cross-session recall
const MAX_MEMORY_SUMMARIES = 3;

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  console.log('Send parent chat message:', { path: event.path, method: event.httpMethod });

  try {
    const sessionId = event.pathParameters?.sessionId;
    if (!sessionId) return error(400, 'sessionId is required');

    if (!event.body) return error(400, 'Request body is required');

    const { message } = JSON.parse(event.body);
    if (!message) return error(400, 'message is required');

    // ----------------------------------------------------------------
    // 1. Load session and verify it's active
    // ----------------------------------------------------------------
    const sessions = await query(
      `SELECT id, student_id, role, agent_state, metadata
       FROM chat_sessions WHERE id = $1::uuid`,
      sessionId
    ) as any[];
    if (!sessions?.length) return error(404, 'Chat session not found or inactive');

    const session = sessions[0];
    const meta = typeof session.metadata === 'string' ? JSON.parse(session.metadata) : (session.metadata || {});
    const studentId: string | null = meta.studentId || session.student_id;

    // ----------------------------------------------------------------
    // 2. Transition: IDLE → PROCESSING
    // ----------------------------------------------------------------
    await query(
      `UPDATE chat_sessions SET agent_state = 'processing' WHERE id = $1::uuid`,
      sessionId
    );

    // ----------------------------------------------------------------
    // 3. Persist the user message
    // ----------------------------------------------------------------
    const userMessageId = uuidv4();
    await query(
      `INSERT INTO chat_messages (id, session_id, role, content, timestamp)
       VALUES ($1::uuid, $2::uuid, 'user', $3, NOW())`,
      userMessageId, sessionId, message
    );

    // ----------------------------------------------------------------
    // 4. Load context for the AI
    //    a) Student Learning DNA (Tier 3 — permanent profile)
    //    b) Conversation memory summaries (Tier 2 — cross-session recall)
    //    c) Recent message history (Tier 1 — current + cached)
    // ----------------------------------------------------------------
    const [profile, memories, rawHistory] = await Promise.all([
      loadStudentProfile(studentId),
      loadConversationMemories(studentId),
      loadMessageHistory(sessionId, MAX_HISTORY_TURNS * 2),
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
    await query(
      `UPDATE chat_sessions SET agent_state = 'responding' WHERE id = $1::uuid`,
      sessionId
    );

    const aiResponse = await getChatCompletion(chatHistory, systemPrompt);

    // ----------------------------------------------------------------
    // 7. Persist the assistant message
    // ----------------------------------------------------------------
    const assistantMessageId = uuidv4();
    await query(
      `INSERT INTO chat_messages (id, session_id, role, content, timestamp)
       VALUES ($1::uuid, $2::uuid, 'assistant', $3, NOW())`,
      assistantMessageId, sessionId, aiResponse
    );

    // ----------------------------------------------------------------
    // 8. Transition: RESPONDING → WAITING_FEEDBACK
    // ----------------------------------------------------------------
    await query(
      `UPDATE chat_sessions SET agent_state = 'waiting_feedback' WHERE id = $1::uuid`,
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
      const resetId = event.pathParameters?.sessionId;
      if (resetId) {
        await query(
          `UPDATE chat_sessions SET agent_state = 'idle' WHERE id = $1::uuid`,
          resetId
        );
      }
    } catch { /* ignore */ }

    return error(500, 'Internal server error');
  }
}

// ---------------------------------------------------------------------------
// Context loaders
// ---------------------------------------------------------------------------

async function loadStudentProfile(studentId: string | null): Promise<any | null> {
  if (!studentId) return null;
  try {
    // Load actual test session results — more reliable than empty profile table
    const sessions = await query(
      `SELECT ts.id, t.title, t.subject, ts.scaled_score, ts.correct_count, ts.total_items,
              ts.completed_at
       FROM test_sessions ts
       LEFT JOIN tests t ON ts.test_id = t.id
       WHERE ts.student_id = $1::uuid AND ts.status = 'completed'
       ORDER BY ts.completed_at DESC LIMIT 10`,
      studentId
    ) as any[];

    if (!sessions.length) return null;

    // Load per-question answers for the most recent 3 sessions
    const recentIds = sessions.slice(0, 3).map((s: any) => s.id);
    const answers = await query(
      `SELECT sr.session_id, sr.is_correct, sr.time_spent, q.subject, q.skill_tags, q.text
       FROM session_responses sr
       JOIN questions q ON sr.question_id = q.id
       WHERE sr.session_id = ANY($1::uuid[])
       ORDER BY sr.created_at ASC`,
      recentIds
    ) as any[];

    // Also try the profile table
    let profile = null;
    try {
      const rows = await query(
        `SELECT skill_graph, error_patterns, time_behavior, overall_mastery, strengths, weaknesses
         FROM student_profiles WHERE student_id = $1::uuid`,
        studentId
      ) as any[];
      profile = rows?.[0] ?? null;
    } catch {}

    return { sessions, answers, profile };
  } catch (err) {
    console.error('loadStudentProfile error:', err);
    return null;
  }
}

async function loadConversationMemories(studentId: string | null): Promise<any[]> {
  if (!studentId) return [];
  try {
    return await query(
      `SELECT summary, key_topics, insights_extracted, created_at
       FROM conversation_memory
       WHERE student_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      studentId, MAX_MEMORY_SUMMARIES
    ) as any[];
  } catch {
    return [];
  }
}

async function loadMessageHistory(sessionId: string, limit: number): Promise<any[]> {
  return query(
    `SELECT role, content FROM chat_messages
     WHERE session_id = $1::uuid
     ORDER BY timestamp ASC
     LIMIT $2`,
    sessionId, limit
  ) as Promise<any[]>;
}

// ---------------------------------------------------------------------------
// System prompt builder — injects Learning DNA + Tier-2 memory
// ---------------------------------------------------------------------------

function buildSystemPrompt(data: any | null, memories: any[]): string {
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

  if (data?.sessions?.length) {
    const sessions = data.sessions;
    const answers = data.answers || [];

    lines.push(``, `## Test History (${sessions.length} completed tests)`);
    for (const s of sessions) {
      const score = parseFloat(s.scaled_score) || 0;
      const correct = parseInt(s.correct_count) || 0;
      const total = parseInt(s.total_items) || 0;
      const date = s.completed_at ? new Date(s.completed_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) : '?';
      lines.push(`- ${s.title || s.subject} (${date}): ${score}% — ${correct}/${total} correct`);
    }

    // Skill breakdown from answers
    if (answers.length) {
      const skillStats: Record<string, { correct: number; total: number }> = {};
      for (const a of answers) {
        const tags: string[] = a.skill_tags || [];
        const subject = a.subject || 'unknown';
        const key = tags.length ? tags[0] : subject;
        if (!skillStats[key]) skillStats[key] = { correct: 0, total: 0 };
        skillStats[key].total++;
        if (a.is_correct) skillStats[key].correct++;
      }

      lines.push(``, `## Skill Breakdown (from recent tests)`);
      const sorted = Object.entries(skillStats).sort((a, b) => (b[1].correct / b[1].total) - (a[1].correct / a[1].total));
      for (const [skill, { correct, total }] of sorted) {
        const pct = Math.round((correct / total) * 100);
        lines.push(`- ${skill}: ${pct}% (${correct}/${total})`);
      }

      // Time analysis
      const avgTime = answers.reduce((s: number, a: any) => s + (parseInt(a.time_spent) || 0), 0) / answers.length;
      const fastAnswers = answers.filter((a: any) => (parseInt(a.time_spent) || 0) < 5).length;
      lines.push(``, `## Time Analysis`);
      lines.push(`- Average time per question: ${avgTime.toFixed(0)} seconds`);
      if (fastAnswers > 0) {
        lines.push(`- ${fastAnswers} questions answered in under 5 seconds (possibly rushing)`);
      }
    }

    // Score trend
    const bySubject: Record<string, number[]> = {};
    for (const s of [...sessions].reverse()) {
      const subj = s.subject || 'unknown';
      if (!bySubject[subj]) bySubject[subj] = [];
      bySubject[subj].push(parseFloat(s.scaled_score) || 0);
    }
    const trending = Object.entries(bySubject).filter(([, scores]) => scores.length >= 2);
    if (trending.length) {
      lines.push(``, `## Score Trends`);
      for (const [subj, scores] of trending) {
        const first = scores[0], last = scores[scores.length - 1];
        const dir = last > first + 5 ? 'improving' : last < first - 5 ? 'declining' : 'stable';
        lines.push(`- ${subj}: ${first}% → ${last}% (${dir})`);
      }
    }
  } else if (data?.profile && data.profile.overall_mastery > 0) {
    // Fallback to profile table if it has data
    const profile = data.profile;
    lines.push(``, `## Student Profile`);
    lines.push(`**Overall Mastery:** ${(profile.overall_mastery * 100).toFixed(0)}%`);
    if (profile.strengths?.length) lines.push(`**Strengths:** ${profile.strengths.join(', ')}`);
    if (profile.weaknesses?.length) lines.push(`**Areas Needing Work:** ${profile.weaknesses.join(', ')}`);
  } else {
    lines.push(
      ``,
      `## Student Data`,
      `No test data available yet. Encourage the parent to have their child complete a practice test first.`
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
