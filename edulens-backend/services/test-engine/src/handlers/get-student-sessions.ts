/**
 * GET /sessions/student/{studentId}
 * Return all completed test sessions for a student with per-question answers.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { query } from '../lib/database';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const studentId = event.pathParameters?.studentId || event.queryStringParameters?.studentId;
    if (!studentId) return response(400, { success: false, error: 'studentId is required' });

    const stageId = event.queryStringParameters?.stageId;

    // Get all completed sessions for this student, optionally filtered by stage
    const params: any[] = [studentId];
    const stageFilter = stageId ? `AND ts.stage_id = $2` : '';
    if (stageId) params.push(stageId);

    const sessions = await query(
      `SELECT
        ts.id as session_id,
        ts.test_id,
        ts.stage_id,
        t.title as test_title,
        t.subject,
        ts.status,
        ts.started_at,
        ts.completed_at,
        ts.estimated_ability,
        ts.scaled_score,
        ts.raw_score,
        ts.total_items,
        ts.correct_count,
        t.time_limit
       FROM test_sessions ts
       LEFT JOIN tests t ON ts.test_id = t.id
       WHERE ts.student_id = $1::uuid
         AND ts.status = 'completed'
         ${stageFilter}
       ORDER BY ts.completed_at DESC`,
      ...params
    ) as any[];

    // For each session, get the per-question answers
    const sessionsWithAnswers = await Promise.all(
      sessions.map(async (session: any) => {
        const answers = await query(
          `SELECT
            sr.question_id,
            sr.student_answer,
            sr.is_correct,
            sr.time_spent,
            q.text as question_text,
            q.options as question_options,
            q.correct_answer,
            q.skill_tags,
            q.difficulty,
            q.subject as question_subject
           FROM session_responses sr
           JOIN questions q ON sr.question_id = q.id
           WHERE sr.session_id = $1::uuid
           ORDER BY sr.id ASC`,
          session.session_id
        ) as any[];

        return {
          sessionId: session.session_id,
          testId: session.test_id,
          stageId: session.stage_id || null,
          testTitle: session.test_title || 'OC Practice Test',
          subject: session.subject,
          status: session.status,
          startedAt: session.started_at,
          completedAt: session.completed_at,
          timeLimit: parseInt(session.time_limit) || 1800,
          finalResults: {
            estimatedAbility: parseFloat(session.estimated_ability) || 0,
            scaledScore: parseFloat(session.scaled_score) || 0,
            rawScore: parseFloat(session.raw_score) || 0,
            totalItems: parseInt(session.total_items) || 0,
            correctCount: parseInt(session.correct_count) || 0,
          },
          answers: answers.map((a: any) => {
            const rawOpts: any[] = Array.isArray(a.question_options)
              ? a.question_options
              : JSON.parse(a.question_options || '[]');
            const displayOptions = rawOpts.map((o: any) => typeof o === 'string' ? o : o.text);
            // Derive correct answer text from options if correct_answer field is absent
            const correctOpt = rawOpts.find((o: any) => typeof o !== 'string' && o.isCorrect);
            const correctAnswer = a.correct_answer || (correctOpt ? correctOpt.text : '');
            return {
              questionId: a.question_id,
              questionText: a.question_text || '',
              options: displayOptions,
              correctAnswer,
              studentAnswer: a.student_answer || '',
              isCorrect: a.is_correct,
              timeSpent: parseInt(a.time_spent) || 0,
              skillTags: a.skill_tags || [],
              difficulty: parseFloat(a.difficulty) || 0.5,
              subject: a.question_subject,
            };
          }),
        };
      })
    );

    return response(200, {
      success: true,
      sessions: sessionsWithAnswers,
      totalSessions: sessionsWithAnswers.length,
    });
  } catch (error) {
    console.error('get-student-sessions error:', error);
    return response(500, { success: false, error: 'Internal server error' });
  }
}

function response(statusCode: number, body: object): APIGatewayProxyResult {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(body),
  };
}
