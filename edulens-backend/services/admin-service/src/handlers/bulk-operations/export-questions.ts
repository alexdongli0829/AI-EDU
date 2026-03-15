/**
 * Lambda Handler: Export Questions (CSV/JSON)
 * GET /admin/bulk/export
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getDb } from '../../lib/database';
import { HTTP_STATUS } from '@edulens/common';
import { logger } from '../../utils/logger';
import { stringify } from 'csv-stringify/sync';

function resp(statusCode: number, body: object, headers?: Record<string, string>): APIGatewayProxyResult {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', ...headers },
    body: JSON.stringify(body),
  };
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const stageId = event.queryStringParameters?.stageId;
    const subject = event.queryStringParameters?.subject;
    const format = event.queryStringParameters?.format || 'json';

    logger.info('Exporting questions', { stageId, subject, format });

    const db = await getDb();

    const conditions: string[] = [];
    const params: any[] = [];

    if (stageId) { params.push(stageId); conditions.push(`stage_id = $${params.length}`); }
    if (subject) { params.push(subject); conditions.push(`subject = $${params.length}`); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const questions = await db.unsafe<any[]>(
      `SELECT id, text, type, options, correct_answer, explanation, difficulty,
              estimated_time, skill_tags, subject, grade_level, stage_id, is_active, created_at
       FROM questions ${where}
       ORDER BY created_at DESC`,
      params
    );

    if (questions.length === 0) {
      return resp(HTTP_STATUS.NOT_FOUND, {
        success: false,
        error: { code: 'NO_QUESTIONS', message: 'No questions found matching the filters' },
      });
    }

    logger.info('Questions fetched for export', { count: questions.length });

    const mapped = questions.map((q: any) => ({
      id: q.id,
      text: q.text,
      type: q.type,
      options: typeof q.options === 'string' ? q.options : JSON.stringify(q.options || []),
      correctAnswer: q.correct_answer,
      explanation: q.explanation,
      difficulty: q.difficulty,
      estimatedTime: q.estimated_time,
      skillTags: JSON.stringify(q.skill_tags || []),
      subject: q.subject,
      gradeLevel: q.grade_level,
      stageId: q.stage_id,
      isActive: q.is_active,
      createdAt: q.created_at,
    }));

    if (format === 'csv') {
      const csv = stringify(mapped, { header: true });
      return {
        statusCode: HTTP_STATUS.OK,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="questions.csv"',
          'Access-Control-Allow-Origin': '*',
        },
        body: csv,
      };
    }

    return {
      statusCode: HTTP_STATUS.OK,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': 'attachment; filename="questions.json"',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ success: true, data: { count: mapped.length, questions: mapped } }, null, 2),
    };
  } catch (error) {
    logger.error('Error exporting questions', { error });
    return resp(HTTP_STATUS.INTERNAL_ERROR, {
      success: false,
      error: { code: 'EXPORT_ERROR', message: 'Failed to export questions' },
    });
  }
};
