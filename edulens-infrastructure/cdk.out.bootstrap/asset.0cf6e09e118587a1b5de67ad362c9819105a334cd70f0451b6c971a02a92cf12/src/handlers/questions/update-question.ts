/**
 * Lambda Handler: Update Question
 * PUT /admin/questions/:id
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { z } from 'zod';
import { prisma } from '@edulens/database';
import { HTTP_STATUS } from '@edulens/common';
import { logger } from '../../utils/logger';

// Validation schema (all fields optional for updates)
const UpdateQuestionSchema = z.object({
  questionText: z.string().min(10).max(5000).optional(),
  options: z.array(z.string()).optional(),
  correctAnswer: z.string().min(1).optional(),
  explanation: z.string().optional(),
  skillTags: z.array(z.string()).min(1).optional(),
  difficultyLevel: z.number().int().min(1).max(5).optional(),
  estimatedTimeSeconds: z.number().int().min(10).max(3600).optional(),
  orderIndex: z.number().int().min(0).optional(),
});

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

    // Parse and validate request
    const body = JSON.parse(event.body || '{}');
    const validatedData = UpdateQuestionSchema.parse(body);

    logger.info('Updating question', { questionId });

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

    // Update question
    const updatedQuestion = await prisma.question.update({
      where: { id: questionId },
      data: validatedData,
    });

    logger.info('Question updated successfully', { questionId });

    return {
      statusCode: HTTP_STATUS.OK,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        data: updatedQuestion,
      }),
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        statusCode: HTTP_STATUS.BAD_REQUEST,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: error.errors,
          },
        }),
      };
    }

    logger.error('Error updating question', { questionId, error });

    return {
      statusCode: HTTP_STATUS.INTERNAL_ERROR,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to update question',
        },
      }),
    };
  }
};
