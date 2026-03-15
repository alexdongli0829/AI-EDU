/**
 * Lambda Handler: Export Questions (CSV/JSON)
 * GET /admin/bulk/export
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { prisma } from '@edulens/database';
import { HTTP_STATUS } from '@edulens/common';
import { logger } from '../../utils/logger';
import { stringify } from 'csv-stringify/sync';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const testId = event.queryStringParameters?.testId;
    const format = event.queryStringParameters?.format || 'json'; // 'json' or 'csv'

    if (!testId) {
      return {
        statusCode: HTTP_STATUS.BAD_REQUEST,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: {
            code: 'MISSING_TEST_ID',
            message: 'Test ID is required for export',
          },
        }),
      };
    }

    logger.info('Exporting questions', { testId, format });

    // Fetch all questions for test
    const questions = await prisma.question.findMany({
      where: { testId },
      orderBy: { orderIndex: 'asc' },
    });

    if (questions.length === 0) {
      return {
        statusCode: HTTP_STATUS.NOT_FOUND,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: {
            code: 'NO_QUESTIONS',
            message: `No questions found for test ${testId}`,
          },
        }),
      };
    }

    logger.info('Questions fetched for export', { count: questions.length });

    // Format based on requested format
    if (format === 'csv') {
      // Convert to CSV
      const csvData = questions.map((q) => ({
        testId: q.testId,
        questionType: q.questionType,
        subject: q.subject,
        questionText: q.questionText,
        options: JSON.stringify(q.options),
        correctAnswer: q.correctAnswer,
        explanation: q.explanation || '',
        skillTags: JSON.stringify(q.skillTags),
        difficultyLevel: q.difficultyLevel,
        estimatedTimeSeconds: q.estimatedTimeSeconds,
        orderIndex: q.orderIndex,
      }));

      const csv = stringify(csvData, {
        header: true,
        columns: [
          'testId',
          'questionType',
          'subject',
          'questionText',
          'options',
          'correctAnswer',
          'explanation',
          'skillTags',
          'difficultyLevel',
          'estimatedTimeSeconds',
          'orderIndex',
        ],
      });

      return {
        statusCode: HTTP_STATUS.OK,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="questions-${testId}.csv"`,
        },
        body: csv,
      };
    } else {
      // JSON format
      return {
        statusCode: HTTP_STATUS.OK,
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="questions-${testId}.json"`,
        },
        body: JSON.stringify({
          success: true,
          data: {
            testId,
            count: questions.length,
            questions,
          },
        }, null, 2),
      };
    }
  } catch (error) {
    logger.error('Error exporting questions', { error });

    return {
      statusCode: HTTP_STATUS.INTERNAL_ERROR,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: {
          code: 'EXPORT_ERROR',
          message: 'Failed to export questions',
        },
      }),
    };
  }
};
