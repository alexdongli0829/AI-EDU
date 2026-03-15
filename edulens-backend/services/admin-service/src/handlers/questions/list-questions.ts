/**
 * Lambda Handler: List Questions
 * GET /admin/questions
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getDb } from '../../lib/database';
import { HTTP_STATUS } from '@edulens/common';
import { logger } from '../../utils/logger';

function resp(statusCode: number, body: object): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'max-age=300',
    },
    body: JSON.stringify(body),
  };
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const subject = event.queryStringParameters?.subject;
    const stageId = event.queryStringParameters?.stageId;
    const limit = Math.min(parseInt(event.queryStringParameters?.limit || '50'), 200);
    const offset = parseInt(event.queryStringParameters?.offset || '0');

    logger.info('Listing questions', { subject, stageId, limit, offset });

    const db = await getDb();

    // Build dynamic WHERE clause
    const conditions: string[] = [];
    const params: any[] = [];

    if (subject) {
      params.push(subject);
      conditions.push(`subject = $${params.length}`);
    }
    if (stageId) {
      params.push(stageId);
      conditions.push(`stage_id = $${params.length}`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const questions = await db.unsafe<any[]>(
      `SELECT id, text, type, options, correct_answer, explanation, difficulty,
              estimated_time, skill_tags, subject, grade_level, stage_id, is_active, created_at
       FROM questions ${where}
       ORDER BY created_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    const countResult = await db.unsafe<any[]>(
      `SELECT COUNT(*)::int AS count FROM questions ${where}`,
      params
    );

    const total = countResult[0]?.count || 0;

    return resp(HTTP_STATUS.OK, {
      success: true,
      data: {
        questions: questions.map((q: any) => ({
          id: q.id,
          text: q.text,
          type: q.type,
          options: typeof q.options === 'string' ? JSON.parse(q.options) : (q.options || []),
          correctAnswer: q.correct_answer,
          explanation: q.explanation,
          difficulty: parseFloat(q.difficulty) || 0.5,
          estimatedTime: parseInt(q.estimated_time) || 60,
          skillTags: q.skill_tags || [],
          subject: q.subject,
          gradeLevel: q.grade_level,
          stageId: q.stage_id,
          isActive: q.is_active,
          createdAt: q.created_at,
        })),
        pagination: { total, limit, offset, hasMore: offset + questions.length < total },
      },
    });
  } catch (error) {
    logger.error('Error listing questions', { error });
    return resp(HTTP_STATUS.INTERNAL_ERROR, {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch questions' },
    });
  }
};
