/**
 * Lambda Handler: Update Question
 * PUT /admin/questions/:questionId
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { z } from 'zod';
import { getDb } from '../../lib/database';
import { HTTP_STATUS } from '@edulens/common';
import { logger } from '../../utils/logger';

const UpdateQuestionSchema = z.object({
  text: z.string().min(5).optional(),
  type: z.enum(['multiple_choice', 'short_answer', 'essay']).optional(),
  options: z.array(z.any()).optional(),
  correctAnswer: z.string().optional(),
  explanation: z.string().optional(),
  difficulty: z.number().min(0).max(1).optional(),
  estimatedTime: z.number().int().min(10).max(3600).optional(),
  skillTags: z.array(z.string()).optional(),
  subject: z.string().optional(),
  gradeLevel: z.number().int().optional(),
  stageId: z.string().optional(),
  isActive: z.boolean().optional(),
});

function resp(statusCode: number, body: object): APIGatewayProxyResult {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(body),
  };
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const questionId = event.pathParameters?.questionId;

  try {
    if (!questionId) {
      return resp(HTTP_STATUS.BAD_REQUEST, {
        success: false,
        error: { code: 'MISSING_QUESTION_ID', message: 'Question ID is required' },
      });
    }

    const body = JSON.parse(event.body || '{}');
    const data = UpdateQuestionSchema.parse(body);

    logger.info('Updating question', { questionId });

    const db = await getDb();

    const existing = await db`SELECT id FROM questions WHERE id = ${questionId}::uuid LIMIT 1`;
    if (existing.length === 0) {
      return resp(HTTP_STATUS.NOT_FOUND, {
        success: false,
        error: { code: 'QUESTION_NOT_FOUND', message: `Question ${questionId} not found` },
      });
    }

    await db.unsafe(
      `UPDATE questions SET
        text = COALESCE($2, text),
        type = COALESCE($3, type),
        options = COALESCE($4::jsonb, options),
        correct_answer = COALESCE($5, correct_answer),
        explanation = COALESCE($6, explanation),
        difficulty = COALESCE($7, difficulty),
        estimated_time = COALESCE($8, estimated_time),
        skill_tags = COALESCE($9::text[], skill_tags),
        subject = COALESCE($10, subject),
        grade_level = COALESCE($11, grade_level),
        stage_id = COALESCE($12, stage_id),
        is_active = COALESCE($13, is_active),
        updated_at = NOW()
       WHERE id = $1::uuid`,
      [
        questionId,
        data.text ?? null,
        data.type ?? null,
        data.options != null ? JSON.stringify(data.options) : null,
        data.correctAnswer ?? null,
        data.explanation ?? null,
        data.difficulty ?? null,
        data.estimatedTime ?? null,
        data.skillTags ?? null,
        data.subject ?? null,
        data.gradeLevel ?? null,
        data.stageId ?? null,
        data.isActive ?? null,
      ]
    );

    logger.info('Question updated', { questionId });
    return resp(HTTP_STATUS.OK, { success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return resp(HTTP_STATUS.BAD_REQUEST, {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid request data', details: error.errors },
      });
    }
    logger.error('Error updating question', { questionId, error });
    return resp(HTTP_STATUS.INTERNAL_ERROR, {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to update question' },
    });
  }
};
