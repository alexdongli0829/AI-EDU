/**
 * SSE Streaming Chat Handler for Student Tutor (Socratic)
 *
 * Deployed via ALB + Lambda Response Streaming (awslambda.streamifyResponse).
 * Returns a text/event-stream response so the frontend's EventSource API
 * receives tokens as they arrive from Bedrock.
 */

import { v4 as uuidv4 } from 'uuid';
import { getDb, query } from '../../lib/database';
import { streamChatCompletion, Message } from '../../lib/bedrock';
import { getSystemConfig, cfgInt, cfgStr, cfgNum } from '../../lib/system-config';

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
    const writeSSE = (data: object) => { stream.write(`data: ${JSON.stringify(data)}\n\n`); };

    try {
      const sessionId: string | undefined =
        event.pathParameters?.sessionId ?? event.queryStringParameters?.sessionId;
      const body = event.body ? JSON.parse(event.body) : {};
      const { message } = body;

      if (!sessionId || !message) {
        writeSSE({ type: 'error', error: 'sessionId and message are required' });
        stream.end();
        return;
      }

      const [prisma, sysConfig] = await Promise.all([getDb(), getSystemConfig()]);
      const maxHistoryTurns = cfgInt(sysConfig, 'chatMaxHistoryTurns');
      const bedrockOptions = {
        modelId:     cfgStr(sysConfig, 'aiStudentChatModelId'),
        maxTokens:   cfgInt(sysConfig, 'aiMaxTokensChat'),
        temperature: cfgNum(sysConfig, 'aiTemperatureChat'),
      };

      // Verify session
      const sessions = await db.unsafe<any[]>(
        `SELECT id, student_id, role, status, agent_state
         FROM chat_sessions WHERE id = $1::uuid AND status = 'active'`,
        sessionId
      );
      if (!sessions?.length) {
        writeSSE({ type: 'error', error: 'Student chat session not found or inactive' });
        stream.end();
        return;
      }

      const studentId: string = sessions[0].student_id;

      await query(
        `UPDATE chat_sessions SET agent_state = 'processing' WHERE id = $1::uuid`,
        sessionId
      );

      const userMessageId = uuidv4();
      await query(
        `INSERT INTO chat_messages (id, session_id, role, content, timestamp)
         VALUES ($1::uuid, $2::uuid, 'user', $3, NOW())`,
        userMessageId, sessionId, message
      );

      const [questionContext, profile, rawHistory] = await Promise.all([
        loadQuestionContext(prisma, sessionId),
        loadStudentProfile(prisma, studentId),
        loadMessageHistory(prisma, sessionId, maxHistoryTurns * 2),
      ]);

      const systemPrompt = buildSocraticPrompt(questionContext, profile);
      const chatHistory: Message[] = rawHistory
        .filter((m: any) => m.role !== 'system')
        .map((m: any) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

      writeSSE({ type: 'start', userMessageId });

      await query(
        `UPDATE chat_sessions SET agent_state = 'responding' WHERE id = $1::uuid`,
        sessionId
      );

      let fullResponse = '';
      for await (const chunk of streamChatCompletion(chatHistory, systemPrompt, bedrockOptions)) {
        if (chunk.type === 'content' && chunk.content) {
          fullResponse += chunk.content;
          writeSSE({ type: 'token', content: chunk.content });
        } else if (chunk.type === 'error') {
          writeSSE({ type: 'error', error: chunk.error ?? 'Bedrock stream error' });
          stream.end();
          return;
        }
      }

      const assistantMessageId = uuidv4();
      await query(
        `INSERT INTO chat_messages (id, session_id, role, content, timestamp)
         VALUES ($1::uuid, $2::uuid, 'assistant', $3, NOW())`,
        assistantMessageId, sessionId, fullResponse
      );

      await query(
        `UPDATE chat_sessions SET agent_state = 'waiting_feedback' WHERE id = $1::uuid`,
        sessionId
      );

      writeSSE({ type: 'done', assistantMessageId, agentState: 'waiting_feedback' });
    } catch (err) {
      console.error('Stream student chat error:', err);
      writeSSE({ type: 'error', error: 'Internal server error' });
    } finally {
      stream.end();
    }
  }
);

// ---------------------------------------------------------------------------
// Context loaders
// ---------------------------------------------------------------------------

async function loadQuestionContext(prisma: any, sessionId: string): Promise<any | null> {
  try {
    const rows = await db.unsafe<any[]>(
      `SELECT content FROM chat_messages
       WHERE session_id = $1::uuid AND role = 'system'
       ORDER BY timestamp ASC LIMIT 1`,
      sessionId
    );
    if (!rows?.length) return null;

    const meta = JSON.parse(rows[0].content);
    const { questionId, sessionResponseId } = meta;
    if (!questionId) return null;

    const [questionRows, responseRows] = await Promise.all([
      db.unsafe<any[]>(
        `SELECT text, options, correct_answer, skill_tags, difficulty, estimated_time
         FROM questions WHERE id = $1::uuid`,
        questionId
      ),
      sessionResponseId
        ? db.unsafe<any[]>(
            `SELECT student_answer, time_spent FROM session_responses WHERE id = $1::uuid`,
            sessionResponseId
          )
        : Promise.resolve([]),
    ]);

    return {
      question:        questionRows?.[0]  ?? null,
      studentResponse: responseRows?.[0]  ?? null,
    };
  } catch {
    return null;
  }
}

async function loadStudentProfile(prisma: any, studentId: string): Promise<any | null> {
  try {
    const rows = await db.unsafe<any[]>(
      `SELECT skill_graph, error_patterns, overall_mastery, weaknesses
       FROM student_profiles WHERE student_id = $1::uuid`,
      studentId
    );
    return rows?.[0] ?? null;
  } catch {
    return null;
  }
}

async function loadMessageHistory(prisma: any, sessionId: string, limit: number): Promise<any[]> {
  return db.unsafe<any[]>(
    `SELECT role, content FROM chat_messages
     WHERE session_id = $1::uuid
     ORDER BY timestamp ASC LIMIT $2`,
    sessionId, limit
  );
}

// ---------------------------------------------------------------------------
// Socratic system prompt (same as non-streaming send-message)
// ---------------------------------------------------------------------------

function buildSocraticPrompt(ctx: any | null, profile: any | null): string {
  const lines: string[] = [
    `You are a Socratic tutor for EduLens, helping a student understand why they got`,
    `a NSW OC/Selective School exam question wrong.`,
    ``,
    `## Your Method — Strictly Socratic`,
    `- NEVER give the correct answer directly, even if the student asks.`,
    `- Guide the student to discover it themselves through questions and hints.`,
    `- Start with the most minimal hint. Only go deeper if the student is still stuck.`,
    `- If the student gets it right, celebrate briefly and explain WHY it was right.`,
    `- Keep language age-appropriate (the student is ~9-12 years old).`,
    `- Responses should be short — 2-4 sentences maximum.`,
  ];

  if (ctx?.question) {
    const q = ctx.question;
    lines.push(``, `## Question Being Reviewed`);
    lines.push(`**Question:** ${q.text}`);
    lines.push(`**Difficulty:** ${q.difficulty}`);
    lines.push(`**Skills tested:** ${(q.skill_tags ?? []).join(', ')}`);
    if (q.correct_answer) lines.push(`**Correct Answer:** ${q.correct_answer} _(do NOT tell the student)_`);
    if (q.options) {
      const opts: any[] = Array.isArray(q.options) ? q.options : [];
      const correct = opts.find((o) => o.isCorrect);
      if (correct) lines.push(`**Correct Option:** ${correct.text} _(do NOT tell the student)_`);
    }
  }

  if (ctx?.studentResponse) {
    const sr = ctx.studentResponse;
    lines.push(``, `**Student's Wrong Answer:** ${sr.student_answer}`);
    const timeNote =
      sr.time_spent && ctx?.question?.estimated_time
        ? sr.time_spent < ctx.question.estimated_time * 0.5
          ? 'They answered very quickly — likely rushed.'
          : sr.time_spent > ctx.question.estimated_time * 1.8
          ? 'They spent a long time — likely conceptually confused.'
          : ''
        : '';
    if (timeNote) lines.push(`**Time Signal:** ${timeNote}`);
  }

  if (profile) {
    const mastery = (profile.overall_mastery * 100).toFixed(0);
    lines.push(``, `## Student Context`, `Overall mastery: ${mastery}%`);
    if (profile.weaknesses?.length) {
      lines.push(`Weak areas: ${profile.weaknesses.slice(0, 3).join(', ')}`);
    }
  }

  lines.push(``, `Start by acknowledging the attempt, then ask a guiding question.`);
  return lines.join('\n');
}
