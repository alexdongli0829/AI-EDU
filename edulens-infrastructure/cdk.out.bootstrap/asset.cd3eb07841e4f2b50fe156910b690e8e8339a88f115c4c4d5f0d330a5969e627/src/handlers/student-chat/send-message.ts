/**
 * Student Explanation Agent — Socratic Chat
 *
 * Guides a student to understand why they got a question wrong,
 * using the Socratic method (hints, questions, never just giving the answer).
 *
 * Context loaded per turn:
 *  - The original question + correct answer + student's wrong answer
 *  - Student's Learning DNA (to tailor difficulty of hints)
 *  - Current session history
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { getPrismaClient } from '../../lib/database';
import { getChatCompletion, Message } from '../../lib/bedrock';

const MAX_HISTORY_TURNS = 10;

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const prisma = await getPrismaClient();

  try {
    const sessionId = event.pathParameters?.sessionId;
    if (!sessionId) return error(400, 'sessionId is required');
    if (!event.body) return error(400, 'Request body is required');

    const { message } = JSON.parse(event.body);
    if (!message) return error(400, 'message is required');

    // Verify session
    const sessions = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id, student_id, role, agent_state
       FROM chat_sessions WHERE id = $1::uuid AND role = 'student_tutor'`,
      sessionId
    );
    if (!sessions?.length) return error(404, 'Student chat session not found or inactive');

    const studentId: string = sessions[0].student_id;

    // Transition: IDLE → PROCESSING
    await prisma.$executeRawUnsafe(
      `UPDATE chat_sessions SET agent_state = 'processing' WHERE id = $1::uuid`,
      sessionId
    );

    // Persist user message
    const userMessageId = uuidv4();
    await prisma.$executeRawUnsafe(
      `INSERT INTO chat_messages (id, session_id, role, content, timestamp)
       VALUES ($1::uuid, $2::uuid, 'user', $3, NOW())`,
      userMessageId, sessionId, message
    );

    // Load context
    const [questionContext, profile, rawHistory] = await Promise.all([
      loadQuestionContext(prisma, sessionId),
      loadStudentProfile(prisma, studentId),
      loadMessageHistory(prisma, sessionId, MAX_HISTORY_TURNS * 2),
    ]);

    const systemPrompt = buildSocraticPrompt(questionContext, profile);
    const chatHistory: Message[] = rawHistory
      .filter((m: any) => m.role !== 'system')
      .map((m: any) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    // Transition: PROCESSING → RESPONDING
    await prisma.$executeRawUnsafe(
      `UPDATE chat_sessions SET agent_state = 'responding' WHERE id = $1::uuid`,
      sessionId
    );

    const aiResponse = await getChatCompletion(chatHistory, systemPrompt);

    // Persist assistant message
    const assistantMessageId = uuidv4();
    await prisma.$executeRawUnsafe(
      `INSERT INTO chat_messages (id, session_id, role, content, timestamp)
       VALUES ($1::uuid, $2::uuid, 'assistant', $3, NOW())`,
      assistantMessageId, sessionId, aiResponse
    );

    // Transition: RESPONDING → WAITING_FEEDBACK
    await prisma.$executeRawUnsafe(
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
    console.error('Student chat send-message error:', err);
    return error(500, 'Internal server error');
  }
}

// ---------------------------------------------------------------------------
// Context loaders
// ---------------------------------------------------------------------------

async function loadQuestionContext(prisma: any, sessionId: string): Promise<any | null> {
  try {
    // The first system message stores the question context as JSON
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT content FROM chat_messages
       WHERE session_id = $1::uuid AND role = 'system'
       ORDER BY timestamp ASC LIMIT 1`,
      sessionId
    );
    if (!rows?.length) return null;

    const meta = JSON.parse(rows[0].content);
    const { questionId, sessionResponseId } = meta;
    if (!questionId) return null;

    // Load question details + the student's original wrong answer
    const [questionRows, responseRows] = await Promise.all([
      prisma.$queryRawUnsafe<any[]>(
        `SELECT text, options, correct_answer, skill_tags, difficulty, estimated_time
         FROM questions WHERE id = $1::uuid`,
        questionId
      ),
      sessionResponseId
        ? prisma.$queryRawUnsafe<any[]>(
            `SELECT student_answer, time_spent FROM session_responses WHERE id = $1::uuid`,
            sessionResponseId
          )
        : Promise.resolve([]),
    ]);

    return {
      question: questionRows?.[0] ?? null,
      studentResponse: responseRows?.[0] ?? null,
    };
  } catch {
    return null;
  }
}

async function loadStudentProfile(prisma: any, studentId: string): Promise<any | null> {
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT skill_graph, error_patterns, overall_mastery
       FROM student_profiles WHERE student_id = $1::uuid`,
      studentId
    );
    return rows?.[0] ?? null;
  } catch {
    return null;
  }
}

async function loadMessageHistory(prisma: any, sessionId: string, limit: number): Promise<any[]> {
  return prisma.$queryRawUnsafe<any[]>(
    `SELECT role, content FROM chat_messages
     WHERE session_id = $1::uuid
     ORDER BY timestamp ASC LIMIT $2`,
    sessionId, limit
  );
}

// ---------------------------------------------------------------------------
// Socratic system prompt
// ---------------------------------------------------------------------------

function buildSocraticPrompt(ctx: any | null, profile: any | null): string {
  const lines: string[] = [];

  lines.push(
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
  );

  if (ctx?.question) {
    const q = ctx.question;
    lines.push(``, `## Question Being Reviewed`);
    lines.push(`**Question:** ${q.text}`);
    lines.push(`**Difficulty:** ${q.difficulty}`);
    lines.push(`**Skills tested:** ${(q.skill_tags ?? []).join(', ')}`);

    if (q.correct_answer) {
      lines.push(`**Correct Answer:** ${q.correct_answer} _(do NOT tell the student)_`);
    }
    if (q.options) {
      const opts: any[] = Array.isArray(q.options) ? q.options : [];
      const correct = opts.find((o) => o.isCorrect);
      if (correct) {
        lines.push(`**Correct Option:** ${correct.text} _(do NOT tell the student)_`);
      }
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

  lines.push(
    ``,
    `Start by acknowledging the attempt, then ask a guiding question to nudge`,
    `the student toward the right thinking.`
  );

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

function success(data: object): APIGatewayProxyResult {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(data),
  };
}

function error(statusCode: number, message: string): APIGatewayProxyResult {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ success: false, error: message }),
  };
}
