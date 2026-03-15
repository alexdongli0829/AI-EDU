/**
 * Lambda Handler: Student Analytics
 * GET /admin/analytics/students/:studentId
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getDb } from '../../lib/database';
import { HTTP_STATUS } from '@edulens/common';
import { logger } from '../../utils/logger';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const studentId = event.pathParameters?.studentId;

  try {
    if (!studentId) {
      return {
        statusCode: HTTP_STATUS.BAD_REQUEST,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: { code: 'MISSING_STUDENT_ID', message: 'Student ID is required' },
        }),
      };
    }

    logger.info('Fetching student analytics', { studentId });

    const db = await getDb();

    // Student + user info
    const studentRows = await db`
      SELECT s.id, s.grade_level, s.core_profile,
             u.email, u.name
      FROM students s
      JOIN users u ON u.id = s.user_id
      WHERE s.id = ${studentId}::uuid LIMIT 1
    `;

    if (studentRows.length === 0) {
      return {
        statusCode: HTTP_STATUS.NOT_FOUND,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: { code: 'STUDENT_NOT_FOUND', message: `Student ${studentId} not found` },
        }),
      };
    }

    const student = studentRows[0];

    // Test session stats
    const completedSessions = await db`
      SELECT ts.id, ts.test_id, ts.scaled_score, ts.completed_at,
             t.title AS test_title, t.question_count
      FROM test_sessions ts
      LEFT JOIN tests t ON t.id = ts.test_id
      WHERE ts.student_id = ${studentId}::uuid AND ts.status = 'completed'
      ORDER BY ts.completed_at DESC
      LIMIT 20
    `;

    const totalSessionsResult = await db`
      SELECT COUNT(*)::int AS count FROM test_sessions WHERE student_id = ${studentId}::uuid
    `;

    const totalCompleted = completedSessions.length;
    const totalSessions = totalSessionsResult[0]?.count || 0;
    const avgScore = totalCompleted > 0
      ? completedSessions.reduce((sum: number, s: any) => sum + (s.scaled_score || 0), 0) / totalCompleted
      : 0;
    const completionRate = totalSessions > 0 ? (totalCompleted / totalSessions) * 100 : 0;

    // Chat session stats
    const chatSessions = await db`
      SELECT id, turn_count, started_at, last_message_at
      FROM chat_sessions
      WHERE student_id = ${studentId}::uuid
      ORDER BY started_at DESC
      LIMIT 20
    `;

    const totalChatMessages = chatSessions.reduce((sum: number, s: any) => sum + (s.turn_count || 0), 0);

    // Subject performance via session_responses
    const responseStats = await db`
      SELECT q.subject, COUNT(*)::int AS total,
             SUM(CASE WHEN sr.is_correct THEN 1 ELSE 0 END)::int AS correct
      FROM session_responses sr
      JOIN questions q ON q.id = sr.question_id
      JOIN test_sessions ts ON ts.id = sr.session_id
      WHERE ts.student_id = ${studentId}::uuid
      GROUP BY q.subject
    `;

    const subjectPerformance = responseStats.map((r: any) => ({
      subject: r.subject,
      accuracy: r.total > 0 ? (r.correct / r.total) * 100 : 0,
      questionCount: r.total,
    }));

    const coreProfile = student.core_profile;

    const analytics = {
      student: {
        id: student.id,
        name: student.name,
        email: student.email,
        gradeLevel: student.grade_level,
      },
      testPerformance: {
        totalTests: totalCompleted,
        averageScore: Math.round(avgScore * 10) / 10,
        completionRate: Math.round(completionRate * 10) / 10,
        recentSessions: completedSessions.slice(0, 5).map((s: any) => ({
          testId: s.test_id,
          testTitle: s.test_title,
          score: s.scaled_score,
          completedAt: s.completed_at,
        })),
      },
      chatActivity: {
        totalSessions: chatSessions.length,
        totalMessages: totalChatMessages,
        avgMessagesPerSession: chatSessions.length > 0
          ? Math.round((totalChatMessages / chatSessions.length) * 10) / 10 : 0,
        recentSessions: chatSessions.slice(0, 5).map((s: any) => ({
          sessionId: s.id,
          turnCount: s.turn_count,
          startedAt: s.started_at,
          lastMessageAt: s.last_message_at,
        })),
      },
      learningProfile: coreProfile ? {
        overallMastery: Math.round((coreProfile.overall_mastery || 0) * 100),
        strengths: coreProfile.strengths || [],
        weaknesses: coreProfile.weaknesses || [],
        lastUpdated: coreProfile.last_calculated || null,
      } : null,
      subjectPerformance,
      generatedAt: new Date().toISOString(),
    };

    logger.info('Student analytics generated', { studentId, totalTests: totalCompleted });

    return {
      statusCode: HTTP_STATUS.OK,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=300' },
      body: JSON.stringify({ success: true, data: analytics }),
    };
  } catch (error) {
    logger.error('Error fetching student analytics', { studentId, error });
    return {
      statusCode: HTTP_STATUS.INTERNAL_ERROR,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch student analytics' },
      }),
    };
  }
};
