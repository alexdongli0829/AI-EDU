/**
 * Lambda Handler: Create Question
 * POST /admin/questions
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { z } from 'zod';
import { prisma } from '@edulens/database';
import { HTTP_STATUS } from '@edulens/common';
import { logger } from '../../utils/logger';

// Validation schema
const CreateQuestionSchema = z.object({
  testId: z.string().uuid(),
  questionType: z.enum(['multiple_choice', 'short_answer', 'essay']),
  subject: z.enum(['math', 'reading', 'science', 'writing']),
  questionText: z.string().min(10).max(5000),
  options: z.array(z.string()).optional(),
  correctAnswer: z.string().min(1),
  explanation: z.string().optional(),
  skillTags: z.array(z.string()).min(1),
  difficultyLevel: z.number().int().min(1).max(5),
  estimatedTimeSeconds: z.number().int().min(10).max(3600),
  orderIndex: z.number().int().min(0),
});

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    // TODO: Verify admin authentication
    // const adminId = event.requestContext.authorizer?.userId;

    // Parse and validate request
    const body = JSON.parse(event.body || '{}');
    const validatedData = CreateQuestionSchema.parse(body);

    logger.info('Creating question', {
      testId: validatedData.testId,
      questionType: validatedData.questionType,
    });

    // Verify test exists
    const test = await prisma.test.findUnique({
      where: { id: validatedData.testId },
    });

    if (!test) {
      return {
        statusCode: HTTP_STATUS.NOT_FOUND,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: {
            code: 'TEST_NOT_FOUND',
            message: `Test ${validatedData.testId} not found`,
          },
        }),
      };
    }

    // Validate multiple choice questions have options
    if (validatedData.questionType === 'multiple_choice') {
      if (!validatedData.options || validatedData.options.length < 2) {
        return {
          statusCode: HTTP_STATUS.BAD_REQUEST,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: false,
            error: {
              code: 'INVALID_OPTIONS',
              message: 'Multiple choice questions must have at least 2 options',
            },
          }),
        };
      }
    }

    // Create question
    const question = await prisma.question.create({
      data: {
        testId: validatedData.testId,
        questionType: validatedData.questionType,
        subject: validatedData.subject,
        questionText: validatedData.questionText,
        options: validatedData.options || [],
        correctAnswer: validatedData.correctAnswer,
        explanation: validatedData.explanation,
        skillTags: validatedData.skillTags,
        difficultyLevel: validatedData.difficultyLevel,
        estimatedTimeSeconds: validatedData.estimatedTimeSeconds,
        orderIndex: validatedData.orderIndex,
      },
    });

    logger.info('Question created successfully', {
      questionId: question.id,
      testId: question.testId,
    });

    return {
      statusCode: HTTP_STATUS.CREATED,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        data: question,
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

    logger.error('Error creating question', { error });

    return {
      statusCode: HTTP_STATUS.INTERNAL_ERROR,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create question',
        },
      }),
    };
  }
};
