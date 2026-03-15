/**
 * Lambda Handler: Import Questions (CSV/JSON)
 * POST /admin/bulk/import
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { z } from 'zod';
import { getDb } from '../../lib/database';
import { HTTP_STATUS } from '@edulens/common';
import { logger } from '../../utils/logger';
import { parse } from 'csv-parse/sync';

const QuestionImportSchema = z.object({
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
    const format = body.format || 'json';
    const data = body.data;

    if (!data) {
      return resp(HTTP_STATUS.BAD_REQUEST, {
        success: false,
        error: { code: 'MISSING_DATA', message: 'Import data is required' },
      });
    }

    logger.info('Starting bulk import', { format });

    let rawQuestions: any[];

    if (format === 'csv') {
      rawQuestions = parse(data, {
        columns: true,
        skip_empty_lines: true,
        cast: true,
        cast_date: false,
      });
      rawQuestions = rawQuestions.map((q: any) => ({
        ...q,
        options: q.options ? JSON.parse(q.options) : [],
        skillTags: q.skillTags ? JSON.parse(q.skillTags) : [],
        difficulty: parseFloat(q.difficulty) || 0.5,
        estimatedTime: parseInt(q.estimatedTime) || 60,
      }));
    } else {
      rawQuestions = Array.isArray(data) ? data : [data];
    }

    const validated = rawQuestions.map((q, i) => {
      try {
        return QuestionImportSchema.parse(q);
      } catch (error) {
        throw new Error(`Validation error at row ${i + 1}: ${(error as z.ZodError).message}`);
      }
    });

    logger.info('Questions validated', { count: validated.length });

    const db = await getDb();
    const ids: string[] = [];

    // Insert each question individually (postgres.js doesn't have a built-in batch upsert helper)
    for (const q of validated) {
      const result = await db<{ id: string }[]>`
        INSERT INTO questions (
          text, type, options, correct_answer, explanation, difficulty,
          estimated_time, skill_tags, subject, grade_level, stage_id, is_active,
          created_at, updated_at
        ) VALUES (
          ${q.text}, ${q.type},
          ${JSON.stringify(q.options || [])}::jsonb,
          ${q.correctAnswer || null}, ${q.explanation || null},
          ${q.difficulty}, ${q.estimatedTime},
          ${q.skillTags}::text[],
          ${q.subject || null}, ${q.gradeLevel || null}, ${q.stageId || null},
          ${q.isActive}, NOW(), NOW()
        )
        RETURNING id
      `;
      ids.push(result[0]?.id);
    }

    logger.info('Questions imported', { count: ids.length });

    return resp(HTTP_STATUS.CREATED, {
      success: true,
      data: { imported: ids.length, ids },
    });
  } catch (error) {
    logger.error('Error importing questions', { error });
    return resp(HTTP_STATUS.BAD_REQUEST, {
      success: false,
      error: {
        code: 'IMPORT_ERROR',
        message: error instanceof Error ? error.message : 'Failed to import questions',
      },
    });
  }
};
