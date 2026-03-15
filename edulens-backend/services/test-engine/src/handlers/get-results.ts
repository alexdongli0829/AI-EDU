/**
 * GET /sessions/:sessionId/results
 * Return detailed test results with per-question breakdown and skill analysis.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { query } from '../lib/database';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const sessionId = event.pathParameters?.sessionId;
    if (!sessionId) return bad('sessionId is required');

    const sessions = await query(
      `SELECT id, student_id, test_id, stage_id, status, scaled_score, raw_score,
              total_items, correct_count, started_at, completed_at, question_count
       FROM test_sessions WHERE id = $1::uuid`,
      sessionId
    ) as any[];

    if (!sessions.length) return ok(404, { success: false, error: 'Session not found' });

    const session = sessions[0];

    const responses = await query(
      `SELECT sr.id, sr.question_id, sr.student_answer, sr.is_correct, sr.time_spent,
              q.text, q.type, q.correct_answer, q.explanation, q.skill_tags, q.subject,
              q.difficulty, q.estimated_time
       FROM session_responses sr
       JOIN questions q ON q.id = sr.question_id
       WHERE sr.session_id = $1::uuid
       ORDER BY sr.id`,
      sessionId
    ) as any[];

    const skillBreakdown: Record<string, { correct: number; total: number }> = {};
    const mappedResponses = responses.map((r: any) => {
      const tags: string[] = Array.isArray(r.skill_tags) ? r.skill_tags : [];
      for (const tag of tags) {
        if (!skillBreakdown[tag]) skillBreakdown[tag] = { correct: 0, total: 0 };
        skillBreakdown[tag].total++;
        if (r.is_correct) skillBreakdown[tag].correct++;
      }
      return {
        questionId: r.question_id,
        questionText: r.text,
        skillTags: tags,
        subject: r.subject,
        difficulty: parseFloat(r.difficulty) || 0.5,
        studentAnswer: r.student_answer,
        correctAnswer: r.correct_answer,
        explanation: r.explanation,
        isCorrect: r.is_correct,
        timeSpent: r.time_spent,
        estimatedTime: parseInt(r.estimated_time) || 60,
      };
    });

    const results = {
      sessionId: session.id,
      stageId: session.stage_id,
      testId: session.test_id,
      status: session.status,
      scaledScore: session.scaled_score,
      rawScore: session.raw_score,
      totalItems: session.total_items,
      correctCount: session.correct_count,
      startedAt: session.started_at,
      completedAt: session.completed_at,
      responses: mappedResponses,
      skillBreakdown,
    };

    return ok(200, { success: true, results });
  } catch (error) {
    console.error('get-results error:', error);
    return ok(500, { success: false, error: 'Internal server error' });
  }
}

function ok(statusCode: number, body: object): APIGatewayProxyResult {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(body),
  };
}

function bad(message: string): APIGatewayProxyResult {
  return ok(400, { success: false, error: message });
}
