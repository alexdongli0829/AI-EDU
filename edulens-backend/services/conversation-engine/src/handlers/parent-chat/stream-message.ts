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
import { query } from '../../lib/database';
import { streamChatCompletion, Message } from '../../lib/bedrock';
import { getSystemConfig, cfgInt, cfgStr, cfgNum } from '../../lib/system-config';

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

      const sysConfig = await getSystemConfig();
      const maxHistoryTurns  = cfgInt(sysConfig, 'chatMaxHistoryTurns');
      const maxMemorySummaries = cfgInt(sysConfig, 'chatMaxMemorySummaries');
      const bedrockOptions = {
        modelId:     cfgStr(sysConfig, 'aiParentChatModelId'),
        maxTokens:   cfgInt(sysConfig, 'aiMaxTokensChat'),
        temperature: cfgNum(sysConfig, 'aiTemperatureChat'),
      };

      // Verify session
      const sessions = await query(
        `SELECT id, user_id, student_id, agent_type, status, stage_id
         FROM chat_sessions WHERE id = $1 AND status = 'active'`,
        sessionId
      ) as any[];
      if (!sessions?.length) {
        writeSSE({ type: 'error', error: 'Chat session not found or inactive' });
        stream.end();
        return;
      }

      const session = sessions[0];
      const studentId: string | null = session.student_id;
      const stageId: string | null = session.stage_id ?? null;

      // Transition: IDLE → PROCESSING
      await query(
        `UPDATE chat_sessions SET agent_state = 'processing' WHERE id = $1`,
        sessionId
      );

      // Persist user message
      const userMessageId = uuidv4();
      await query(
        `INSERT INTO chat_messages (id, session_id, role, content, timestamp)
         VALUES ($1, $2, 'user', $3, NOW())`,
        userMessageId, sessionId, message
      );

      // Load context (profile + stage layers + memories + history in parallel)
      const [profile, coreProfile, stageContext, memories, rawHistory] = await Promise.all([
        loadStudentProfile(studentId),
        loadCoreProfile(studentId),
        loadStageContext(studentId, stageId),
        loadConversationMemories(studentId, maxMemorySummaries),
        loadMessageHistory(sessionId, maxHistoryTurns * 2),
      ]);

      const systemPrompt = buildSystemPrompt(profile, coreProfile, stageContext, memories);
      const chatHistory: Message[] = rawHistory.map((m: any) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

      // Signal that we're starting to respond
      writeSSE({ type: 'start', userMessageId });

      // Transition: PROCESSING → RESPONDING
      await query(
        `UPDATE chat_sessions SET agent_state = 'responding' WHERE id = $1`,
        sessionId
      );

      // Stream tokens to client and accumulate full response
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

      // Persist the complete assistant message
      const assistantMessageId = uuidv4();
      await query(
        `INSERT INTO chat_messages (id, session_id, role, content, timestamp)
         VALUES ($1, $2, 'assistant', $3, NOW())`,
        assistantMessageId, sessionId, fullResponse
      );

      // Transition: RESPONDING → WAITING_FEEDBACK
      await query(
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

async function loadStudentProfile(studentId: string | null): Promise<any | null> {
  if (!studentId) return null;
  try {
    const rows = await query(
      `SELECT skill_graph, error_patterns, time_behavior, overall_mastery, strengths, weaknesses
       FROM student_profiles WHERE student_id = $1`,
      studentId
    ) as any[];
    return rows?.[0] ?? null;
  } catch {
    return null;
  }
}

async function loadCoreProfile(studentId: string | null): Promise<any | null> {
  if (!studentId) return null;
  try {
    const rows = await query(
      `SELECT core_profile FROM students WHERE id = $1::uuid`,
      studentId
    ) as any[];
    return rows?.[0]?.core_profile ?? null;
  } catch {
    return null;
  }
}

async function loadStageContext(
  studentId: string | null,
  stageId: string | null
): Promise<{ stageName: string; stageProfile: any; stageSystemPrompt: string | null } | null> {
  if (!studentId || !stageId) return null;
  try {
    const rows = await query(
      `SELECT s.display_name, s.system_prompts, ss.stage_profile
       FROM student_stages ss
       JOIN stages s ON ss.stage_id = s.id
       WHERE ss.student_id = $1 AND ss.stage_id = $2`,
      studentId, stageId
    ) as any[];
    if (!rows?.length) return null;
    const row = rows[0];
    return {
      stageName: row.display_name,
      stageProfile: row.stage_profile ?? {},
      stageSystemPrompt: row.system_prompts?.parent_advisor ?? null,
    };
  } catch {
    return null;
  }
}

async function loadConversationMemories(studentId: string | null, limit: number): Promise<any[]> {
  if (!studentId) return [];
  try {
    return await query(
      `SELECT summary, key_topics, insights_extracted, created_at
       FROM conversation_memory
       WHERE student_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      studentId, limit
    ) as any[];
  } catch {
    return [];
  }
}

async function loadMessageHistory(sessionId: string, limit: number): Promise<any[]> {
  return query(
    `SELECT role, content FROM chat_messages
     WHERE session_id = $1
     ORDER BY timestamp ASC
     LIMIT $2`,
    sessionId, limit
  ) as Promise<any[]>;
}

// ---------------------------------------------------------------------------
// System prompt builder (same logic as send-message.ts)
// ---------------------------------------------------------------------------

function buildSystemPrompt(
  profile: any | null,
  coreProfile: any | null,
  stageCtx: { stageName: string; stageProfile: any; stageSystemPrompt: string | null } | null,
  memories: any[]
): string {
  const lines: string[] = [];

  // Stage-specific system prompt override takes precedence for persona/rules
  if (stageCtx?.stageSystemPrompt) {
    lines.push(stageCtx.stageSystemPrompt);
  } else {
    lines.push(
      `You are an AI educational advisor for EduLens, helping parents understand their child's`,
      `learning progress${stageCtx ? ` in the ${stageCtx.stageName} stage` : ''}.`,
      ``,
      `## Your Rules`,
      `- Ground every response in the student data provided below. Quote specific numbers.`,
      `- Be specific, not generic. Reference actual skills, patterns, and trends.`,
      `- Be supportive and constructive.`,
      `- Stay focused on educational progress. Decline off-topic requests politely.`,
      `- If data is insufficient, say so and suggest completing more tests.`,
    );
  }

  if (stageCtx) {
    lines.push(``, `## Current Stage: ${stageCtx.stageName}`);
    const sp = stageCtx.stageProfile;
    if (sp.overall_mastery != null) {
      lines.push(`**Stage Mastery:** ${(sp.overall_mastery * 100).toFixed(0)}%`);
    }
    if (sp.strengths?.length) lines.push(`**Stage Strengths:** ${sp.strengths.join(', ')}`);
    if (sp.weaknesses?.length) lines.push(`**Stage Weaknesses:** ${sp.weaknesses.join(', ')}`);

    const stageSkillGraph: any[] = sp.skill_graph ?? [];
    if (stageSkillGraph.length) {
      const sorted = Object.entries(stageSkillGraph as any)
        .map(([id, v]: [string, any]) => ({ id, ...(typeof v === 'object' ? v : {}) }))
        .sort((a: any, b: any) => (b.mastery_level ?? 0) - (a.mastery_level ?? 0));
      lines.push(``, `**Stage Skill Levels (top 5):**`);
      for (const s of sorted.slice(0, 5)) {
        const pct = ((s.mastery_level ?? 0) * 100).toFixed(0);
        lines.push(`- ${s.id}: ${pct}% mastery`);
      }
    }
  }

  // Lifetime Learning DNA from legacy profile (or core_profile)
  const errorPatterns: any[] = coreProfile?.error_patterns ?? profile?.error_patterns ?? [];
  const timeBehavior = coreProfile?.time_behavior ?? profile?.time_behavior;
  const overallMastery = profile?.overall_mastery;

  if (overallMastery != null || errorPatterns.length || timeBehavior) {
    lines.push(``, `## Lifetime Learning Profile`);
    if (overallMastery != null) {
      lines.push(`**Lifetime Mastery:** ${(overallMastery * 100).toFixed(0)}%`);
    }
    if (profile?.strengths?.length) lines.push(`**Strengths:** ${profile.strengths.join(', ')}`);
    if (profile?.weaknesses?.length) lines.push(`**Areas Needing Work:** ${profile.weaknesses.join(', ')}`);

    if (errorPatterns.length) {
      lines.push(``, `**Recurring Error Patterns:**`);
      for (const p of errorPatterns.slice(0, 3)) {
        lines.push(`- ${p.error_type.replace(/_/g, ' ')}: ${p.frequency}× (${p.severity})`);
      }
    }

    if (timeBehavior) {
      lines.push(``, `**Time Behaviour:**`);
      lines.push(`- Avg: ${Number(timeBehavior.average_speed ?? 0).toFixed(0)}s/question`);
      if ((timeBehavior.rushing_indicator ?? 0) > 0.3) {
        lines.push(`- Rushing on ${((timeBehavior.rushing_indicator ?? 0) * 100).toFixed(0)}% of questions`);
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
