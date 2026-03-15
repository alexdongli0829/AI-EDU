/**
 * Lambda Handler: Import Questions (CSV/JSON)
 * POST /admin/bulk/import
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { z } from 'zod';
import { prisma } from '@edulens/database';
import { HTTP_STATUS } from '@edulens/common';
import { logger } from '../../utils/logger';
import { parse } from 'csv-parse/sync';

// Validation schema for single question
const QuestionImportSchema = z.object({
  testId: z.string().uuid(),
  questionType: z.enum(['multiple_choice', 'short_answer', 'essay']),
  subject: z.enum(['math', 'reading', 'science', 'writing']),
  questionText: z.string().min(10),
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
    const body = JSON.parse(event.body || '{}');
    const format = body.format || 'json'; // 'json' or 'csv'
    const data = body.data;

    if (!data) {
      return {
        statusCode: HTTP_STATUS.BAD_REQUEST,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: {
            code: 'MISSING_DATA',
            message: 'Import data is required',
          },
        }),
      };
    }

    logger.info('Starting bulk import', { format });

    let questions: any[];

    // Parse based on format
    if (format === 'csv') {
      // Parse CSV
      questions = parse(data, {
        columns: true,
        skip_empty_lines: true,
        cast: true,
        cast_date: false,
      });

      // Transform CSV data
      questions = questions.map((q: any) => ({
        ...q,
        options: q.options ? JSON.parse(q.options) : [],
        skillTags: q.skillTags ? JSON.parse(q.skillTags) : [],
        difficultyLevel: parseInt(q.difficultyLevel),
        estimatedTimeSeconds: parseInt(q.estimatedTimeSeconds),
        orderIndex: parseInt(q.orderIndex),
      }));
    } else {
      // JSON format
      questions = Array.isArray(data) ? data : [data];
    }

    // Validate all questions
    const validatedQuestions = questions.map((q, index) => {
      try {
        return QuestionImportSchema.parse(q);
      } catch (error) {
        throw new Error(
          `Validation error at row ${index + 1}: ${(error as z.ZodError).message}`
        );
      }
    });

    logger.info('Questions validated', { count: validatedQuestions.length });

    // Import questions in transaction
    const results = await prisma.$transaction(
      validatedQuestions.map((q) =>
        prisma.question.create({
          data: q,
        })
      )
    );

    logger.info('Questions imported successfully', {
      count: results.length,
    });

    return {
      statusCode: HTTP_STATUS.CREATED,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        data: {
          imported: results.length,
          questions: results.map((q) => ({ id: q.id, questionText: q.questionText })),
        },
      }),
    };
  } catch (error) {
    logger.error('Error importing questions', { error });

    return {
      statusCode: HTTP_STATUS.BAD_REQUEST,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: {
          code: 'IMPORT_ERROR',
          message: error instanceof Error ? error.message : 'Failed to import questions',
        },
      }),
    };
  }
};
