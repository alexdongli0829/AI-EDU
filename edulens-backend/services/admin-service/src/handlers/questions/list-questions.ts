/**
 * Lambda Handler: List Questions
 * GET /admin/questions
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { prisma } from '@edulens/database';
import { HTTP_STATUS } from '@edulens/common';
import { logger } from '../../utils/logger';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    // Parse query parameters
    const testId = event.queryStringParameters?.testId;
    const subject = event.queryStringParameters?.subject;
    const skillTag = event.queryStringParameters?.skillTag;
    const limit = parseInt(event.queryStringParameters?.limit || '50');
    const offset = parseInt(event.queryStringParameters?.offset || '0');

    logger.info('Listing questions', { testId, subject, skillTag, limit, offset });

    // Build filter
    const where: any = {};

    if (testId) {
      where.testId = testId;
    }

    if (subject) {
      where.subject = subject;
    }

    if (skillTag) {
      where.skillTags = {
        has: skillTag,
      };
    }

    // Fetch questions
    const questions = await prisma.question.findMany({
      where,
      orderBy: [{ testId: 'asc' }, { orderIndex: 'asc' }],
      skip: offset,
      take: limit,
      select: {
        id: true,
        testId: true,
        questionType: true,
        subject: true,
        questionText: true,
        skillTags: true,
        difficultyLevel: true,
        estimatedTimeSeconds: true,
        orderIndex: true,
        createdAt: true,
      },
    });

    // Get total count
    const totalCount = await prisma.question.count({ where });

    logger.info('Questions fetched', {
      count: questions.length,
      totalCount,
    });

    return {
      statusCode: HTTP_STATUS.OK,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'max-age=300', // Cache for 5 minutes
      },
      body: JSON.stringify({
        success: true,
        data: {
          questions,
          pagination: {
            total: totalCount,
            limit,
            offset,
            hasMore: offset + questions.length < totalCount,
          },
        },
      }),
    };
  } catch (error) {
    logger.error('Error listing questions', { error });

    return {
      statusCode: HTTP_STATUS.INTERNAL_ERROR,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch questions',
        },
      }),
    };
  }
};
