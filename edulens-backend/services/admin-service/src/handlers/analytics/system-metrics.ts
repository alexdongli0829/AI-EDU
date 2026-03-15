/**
 * Lambda Handler: System Metrics
 * GET /admin/analytics/metrics
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getDb } from '../../lib/database';
import { getRedisClient } from '@edulens/database';
import { HTTP_STATUS } from '@edulens/common';
import { logger } from '../../utils/logger';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    logger.info('Fetching system metrics');

    const db = await getDb();

    const [
      usersResult,
      studentsResult,
      testsResult,
      questionsResult,
      activeSessionsResult,
      completedSessionsResult,
      chatSessionsResult,
    ] = await Promise.all([
      db`SELECT COUNT(*)::int AS count FROM users`,
      db`SELECT COUNT(*)::int AS count FROM students`,
      db`SELECT COUNT(*)::int AS count FROM tests`,
      db`SELECT COUNT(*)::int AS count FROM questions WHERE is_active = true`,
      db`SELECT COUNT(*)::int AS count FROM test_sessions WHERE status IN ('pending', 'in_progress')`,
      db`SELECT COUNT(*)::int AS count FROM test_sessions WHERE status = 'completed'`,
      db`SELECT COUNT(*)::int AS count FROM chat_sessions`,
    ]);

    const avgScoreResult = await db`
      SELECT AVG(scaled_score)::float AS avg FROM test_sessions
      WHERE status = 'completed' AND scaled_score IS NOT NULL
    `;

    const totalMessages = await db`SELECT COUNT(*)::int AS count FROM chat_messages`;

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [recentSessions, recentChats, studentsWithProfile] = await Promise.all([
      db`SELECT COUNT(*)::int AS count FROM test_sessions WHERE created_at >= ${oneDayAgo}`,
      db`SELECT COUNT(*)::int AS count FROM chat_sessions WHERE started_at >= ${oneDayAgo}`,
      db`SELECT COUNT(*)::int AS count FROM students WHERE core_profile IS NOT NULL`,
    ]);

    const totalChatSessions = chatSessionsResult[0]?.count || 0;
    const totalMessages_ = totalMessages[0]?.count || 0;

    // Redis stats
    let redisConnected = false;
    let redisCacheHitRate = 0;

    try {
      const redis = getRedisClient();
      await redis.ping();
      redisConnected = true;
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

    const totalStudents = studentsResult[0]?.count || 0;
    const totalProfiles = studentsWithProfile[0]?.count || 0;

    const metrics = {
      totalUsers: usersResult[0]?.count || 0,
      totalStudents,
      totalTests: testsResult[0]?.count || 0,
      totalQuestions: questionsResult[0]?.count || 0,
      testSessions: {
        active: activeSessionsResult[0]?.count || 0,
        completed: completedSessionsResult[0]?.count || 0,
        total: (activeSessionsResult[0]?.count || 0) + (completedSessionsResult[0]?.count || 0),
        avgScore: avgScoreResult[0]?.avg || 0,
      },
      chatSessions: {
        total: totalChatSessions,
        totalMessages: totalMessages_,
        avgMessagesPerSession: totalChatSessions > 0
          ? Math.round((totalMessages_ / totalChatSessions) * 10) / 10 : 0,
      },
      profiles: {
        total: totalProfiles,
        coverage: totalStudents > 0 ? Math.round((totalProfiles / totalStudents) * 100) : 0,
      },
      recentActivity: {
        testSessions: recentSessions[0]?.count || 0,
        chatSessions: recentChats[0]?.count || 0,
        profilesUpdated: 0,
      },
      health: {
        database: 'connected',
        redis: redisConnected ? 'connected' : 'disconnected',
        cacheHitRate: Math.round(redisCacheHitRate * 10) / 10,
      },
      generatedAt: new Date().toISOString(),
    };

    return {
      statusCode: HTTP_STATUS.OK,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=60' },
      body: JSON.stringify({ success: true, data: metrics }),
    };
  } catch (error) {
    logger.error('Error fetching system metrics', { error });
    return {
      statusCode: HTTP_STATUS.INTERNAL_ERROR,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch system metrics' },
      }),
    };
  }
};
