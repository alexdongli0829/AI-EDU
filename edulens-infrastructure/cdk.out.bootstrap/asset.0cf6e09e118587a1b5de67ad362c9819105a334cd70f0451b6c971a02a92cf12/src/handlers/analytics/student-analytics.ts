/**
 * Lambda Handler: Student Analytics
 * GET /admin/analytics/students/:id
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { prisma } from '@edulens/database';
import { HTTP_STATUS } from '@edulens/common';
import { logger } from '../../utils/logger';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const studentId = event.pathParameters?.id;

  try {
    if (!studentId) {
      return {
        statusCode: HTTP_STATUS.BAD_REQUEST,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: {
            code: 'MISSING_STUDENT_ID',
            message: 'Student ID is required',
          },
        }),
      };
    }

    logger.info('Fetching student analytics', { studentId });

    // Verify student exists
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: { user: { select: { email: true, firstName: true, lastName: true } } },
    });

    if (!student) {
      return {
        statusCode: HTTP_STATUS.NOT_FOUND,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: {
            code: 'STUDENT_NOT_FOUND',
            message: `Student ${studentId} not found`,
          },
        }),
      };
    }

    // Get test session statistics
    const testSessions = await prisma.testSession.findMany({
      where: { studentId, status: 'completed' },
      select: {
        id: true,
        testId: true,
        score: true,
        completedAt: true,
        timeRemaining: true,
        test: { select: { title: true, totalQuestions: true, timeLimit: true } },
      },
      orderBy: { completedAt: 'desc' },
      take: 20,
    });

    const totalSessions = testSessions.length;
    const avgScore =
      totalSessions > 0
        ? testSessions.reduce((sum, s) => sum + (s.score || 0), 0) / totalSessions
        : 0;

    // Calculate completion rate
    const allSessions = await prisma.testSession.count({
      where: { studentId },
    });
    const completionRate =
      allSessions > 0 ? (totalSessions / allSessions) * 100 : 0;

    // Get chat session statistics
    const chatSessions = await prisma.chatSession.findMany({
      where: { studentId },
      select: {
        id: true,
        status: true,
        messageCount: true,
        startedAt: true,
        endedAt: true,
      },
      orderBy: { startedAt: 'desc' },
      take: 20,
    });

    const totalChatMessages = chatSessions.reduce(
      (sum, s) => sum + s.messageCount,
      0
    );

    // Get profile summary
    const profile = await prisma.studentProfile.findUnique({
      where: { studentId },
      select: {
        overallMastery: true,
        strengths: true,
        weaknesses: true,
        lastCalculated: true,
      },
    });

    // Get skill performance (from responses)
    const responses = await prisma.sessionResponse.findMany({
      where: {
        session: { studentId },
      },
      select: {
        isCorrect: true,
        question: { select: { skillTags: true, subject: true } },
      },
    });

    // Aggregate by subject
    const subjectPerformance: Record<string, { total: number; correct: number }> = {};

    for (const response of responses) {
      const subject = response.question.subject;
      if (!subjectPerformance[subject]) {
        subjectPerformance[subject] = { total: 0, correct: 0 };
      }
      subjectPerformance[subject].total++;
      if (response.isCorrect) {
        subjectPerformance[subject].correct++;
      }
    }

    const subjectStats = Object.entries(subjectPerformance).map(
      ([subject, stats]) => ({
        subject,
        accuracy: stats.total > 0 ? (stats.correct / stats.total) * 100 : 0,
        questionCount: stats.total,
      })
    );

    // Compile analytics
    const analytics = {
      student: {
        id: student.id,
        name: `${student.user.firstName} ${student.user.lastName}`,
        email: student.user.email,
        gradeLevel: student.gradeLevel,
      },

      testPerformance: {
        totalTests: totalSessions,
        averageScore: Math.round(avgScore * 10) / 10,
        completionRate: Math.round(completionRate * 10) / 10,
        recentSessions: testSessions.slice(0, 5).map((s) => ({
          testId: s.testId,
          testTitle: s.test.title,
          score: s.score,
          completedAt: s.completedAt,
        })),
      },

      chatActivity: {
        totalSessions: chatSessions.length,
        totalMessages: totalChatMessages,
        avgMessagesPerSession:
          chatSessions.length > 0
            ? Math.round((totalChatMessages / chatSessions.length) * 10) / 10
            : 0,
        recentSessions: chatSessions.slice(0, 5).map((s) => ({
          sessionId: s.id,
          status: s.status,
          messageCount: s.messageCount,
          startedAt: s.startedAt,
        })),
      },

      learningProfile: profile
        ? {
            overallMastery: Math.round((profile.overallMastery || 0) * 100),
            strengths: profile.strengths,
            weaknesses: profile.weaknesses,
            lastUpdated: profile.lastCalculated,
          }
        : null,

      subjectPerformance: subjectStats,

      generatedAt: new Date().toISOString(),
    };

    logger.info('Student analytics generated', {
      studentId,
      totalTests: totalSessions,
      totalChats: chatSessions.length,
    });

    return {
      statusCode: HTTP_STATUS.OK,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'max-age=300', // Cache for 5 minutes
      },
      body: JSON.stringify({
        success: true,
        data: analytics,
      }),
    };
  } catch (error) {
    logger.error('Error fetching student analytics', { studentId, error });

    return {
      statusCode: HTTP_STATUS.INTERNAL_ERROR,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch student analytics',
        },
      }),
    };
  }
};
