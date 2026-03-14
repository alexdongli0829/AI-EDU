/**
 * Lambda Handler: Delete Question
 * DELETE /admin/questions/:id
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { prisma } from '@edulens/database';
import { HTTP_STATUS } from '@edulens/common';
import { logger } from '../../utils/logger';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const questionId = event.pathParameters?.id;

  try {
    if (!questionId) {
      return {
        statusCode: HTTP_STATUS.BAD_REQUEST,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: {
            code: 'MISSING_QUESTION_ID',
            message: 'Question ID is required',
          },
        }),
      };
    }

    logger.info('Deleting question', { questionId });

    // Verify question exists
    const existingQuestion = await prisma.question.findUnique({
      where: { id: questionId },
    });

    if (!existingQuestion) {
      return {
        statusCode: HTTP_STATUS.NOT_FOUND,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: {
            code: 'QUESTION_NOT_FOUND',
            message: `Question ${questionId} not found`,
          },
        }),
      };
    }

    // Check if question has been used in sessions
    const responseCount = await prisma.sessionResponse.count({
      where: { questionId },
    });

    if (responseCount > 0) {
      // Don't allow deletion if question has responses
      // Instead, mark it as inactive or archived
      return {
        statusCode: HTTP_STATUS.CONFLICT,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: {
            code: 'QUESTION_IN_USE',
            message: `Question has ${responseCount} responses and cannot be deleted. Consider archiving instead.`,
          },
        }),
      };
    }

    // Delete question
    await prisma.question.delete({
      where: { id: questionId },
    });

    logger.info('Question deleted successfully', { questionId });

    return {
      statusCode: HTTP_STATUS.OK,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        message: 'Question deleted successfully',
      }),
    };
  } catch (error) {
    logger.error('Error deleting question', { questionId, error });

    return {
      statusCode: HTTP_STATUS.INTERNAL_ERROR,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to delete question',
        },
      }),
    };
  }
};
