/**
 * Lambda Handler: Create Question
 * POST /admin/questions
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { z } from 'zod';
import { getDb } from '../../lib/database';
import { HTTP_STATUS } from '@edulens/common';
import { logger } from '../../utils/logger';

const CreateQuestionSchema = z.object({
  text: z.string().min(5),
  type: z.enum(['multiple_choice', 'short_answer', 'essay']).default('multiple_choice'),
  options: z.array(z.any()).optional(),
  correctAnswer: z.string().optional(),
  explanation: z.string().optional(),
  difficulty: z.number().min(0).max(1).default(0.5),
  estimatedTime: z.number().int().min(10).max(3600).default(60),
  skillTags: z.array(z.string()).default([]),
  subject: z.string().optional(),
  gradeLevel: z.number().int().optional(),
  stageId: z.string().optional(),
  isActive: z.boolean().default(true),
});

function resp(statusCode: number, body: object): APIGatewayProxyResult {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(body),
  };
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const body = JSON.parse(event.body || '{}');
    const data = CreateQuestionSchema.parse(body);

    logger.info('Creating question', { type: data.type });

    const db = await getDb();

    const result = await db<{ id: string }[]>`
      INSERT INTO questions (
        text, type, options, correct_answer, explanation, difficulty,
        estimated_time, skill_tags, subject, grade_level, stage_id, is_active,
        created_at, updated_at
      ) VALUES (
        ${data.text},
        ${data.type},
        ${JSON.stringify(data.options || [])}::jsonb,
        ${data.correctAnswer || null},
        ${data.explanation || null},
        ${data.difficulty},
        ${data.estimatedTime},
        ${data.skillTags}::text[],
        ${data.subject || null},
        ${data.gradeLevel || null},
        ${data.stageId || null},
        ${data.isActive},
        NOW(), NOW()
      )
      RETURNING id
    `;

    logger.info('Question created', { id: result[0]?.id });

    return resp(HTTP_STATUS.CREATED, { success: true, id: result[0]?.id });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return resp(HTTP_STATUS.BAD_REQUEST, {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid request data', details: error.errors },
      });
    }
    logger.error('Error creating question', { error });
    return resp(HTTP_STATUS.INTERNAL_ERROR, {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to create question' },
    });
  }
};
