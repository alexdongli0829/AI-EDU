/**
 * Lambda Handler: System Metrics
 * GET /admin/analytics/metrics
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { prisma, redis } from '@edulens/database';
import { HTTP_STATUS } from '@edulens/common';
import { logger } from '../../utils/logger';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    logger.info('Fetching system metrics');

    // Get counts in parallel
    const [
      totalUsers,
      totalStudents,
      totalTests,
      totalQuestions,
      activeSessions,
      totalChatSessions,
      totalProfiles,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.student.count(),
      prisma.test.count(),
      prisma.question.count(),
      prisma.testSession.count({
        where: { status: { in: ['pending', 'in_progress'] } },
      }),
      prisma.chatSession.count(),
      prisma.studentProfile.count(),
    ]);

    // Get test session statistics
    const completedSessions = await prisma.testSession.count({
      where: { status: 'completed' },
    });

    const avgScore = await prisma.testSession.aggregate({
      where: { status: 'completed', score: { not: null } },
      _avg: { score: true },
    });

    // Get chat statistics
    const totalMessages = await prisma.chatMessage.count();

    const avgMessagesPerSession = totalChatSessions > 0
      ? totalMessages / totalChatSessions
      : 0;

    // Get recent activity (last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [recentSessions, recentChats, recentProfiles] = await Promise.all([
      prisma.testSession.count({
        where: { createdAt: { gte: oneDayAgo } },
      }),
      prisma.chatSession.count({
        where: { createdAt: { gte: oneDayAgo } },
      }),
      prisma.studentProfile.count({
        where: { lastCalculated: { gte: oneDayAgo } },
      }),
    ]);

    // Try to get Redis info
    let redisConnected = false;
    let redisCacheHitRate = 0;

    try {
      await redis.ping();
      redisConnected = true;

      // Get Redis stats (if available)
      const info = await redis.info('stats');
      const hitMatches = info.match(/keyspace_hits:(\d+)/);
      const missMatches = info.match(/keyspace_misses:(\d+)/);

      if (hitMatches && missMatches) {
        const hits = parseInt(hitMatches[1]);
        const misses = parseInt(missMatches[1]);
        const total = hits + misses;
        redisCacheHitRate = total > 0 ? (hits / total) * 100 : 0;
      }
    } catch (error) {
      logger.warn('Redis connection failed', { error });
    }

    const metrics = {
      // Overall counts
      totalUsers,
      totalStudents,
      totalTests,
      totalQuestions,

      // Session statistics
      testSessions: {
        active: activeSessions,
        completed: completedSessions,
        total: activeSessions + completedSessions,
        avgScore: avgScore._avg.score || 0,
      },

      // Chat statistics
      chatSessions: {
        total: totalChatSessions,
        totalMessages,
        avgMessagesPerSession: Math.round(avgMessagesPerSession * 10) / 10,
      },

      // Profile statistics
      profiles: {
        total: totalProfiles,
        coverage: totalStudents > 0
          ? Math.round((totalProfiles / totalStudents) * 100)
          : 0,
      },

      // Recent activity (24h)
      recentActivity: {
        testSessions: recentSessions,
        chatSessions: recentChats,
        profilesUpdated: recentProfiles,
      },

      // System health
      health: {
        database: 'connected',
        redis: redisConnected ? 'connected' : 'disconnected',
        cacheHitRate: Math.round(redisCacheHitRate * 10) / 10,
      },

      // Timestamp
      generatedAt: new Date().toISOString(),
    };

    logger.info('System metrics generated');

    return {
      statusCode: HTTP_STATUS.OK,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'max-age=60', // Cache for 1 minute
      },
      body: JSON.stringify({
        success: true,
        data: metrics,
      }),
    };
  } catch (error) {
    logger.error('Error fetching system metrics', { error });

    return {
      statusCode: HTTP_STATUS.INTERNAL_ERROR,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch system metrics',
        },
      }),
    };
  }
};
