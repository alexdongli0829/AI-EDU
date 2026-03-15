/**
 * Lambda Handler: Delete Question
 * DELETE /admin/questions/:questionId
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getDb } from '../../lib/database';
import { HTTP_STATUS } from '@edulens/common';
import { logger } from '../../utils/logger';

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

    logger.info('Deleting question', { questionId });

    const db = await getDb();

    const existing = await db`SELECT id FROM questions WHERE id = ${questionId}::uuid LIMIT 1`;
    if (existing.length === 0) {
      return resp(HTTP_STATUS.NOT_FOUND, {
        success: false,
        error: { code: 'QUESTION_NOT_FOUND', message: `Question ${questionId} not found` },
      });
    }

    // Check if used in any session responses
    const usageResult = await db`
      SELECT COUNT(*)::int AS count FROM session_responses WHERE question_id = ${questionId}::uuid
    `;
    const responseCount = usageResult[0]?.count || 0;

    if (responseCount > 0) {
      return resp(HTTP_STATUS.CONFLICT, {
        success: false,
        error: {
          code: 'QUESTION_IN_USE',
          message: `Question has ${responseCount} responses and cannot be deleted. Consider marking it inactive instead.`,
        },
      });
    }

    await db`DELETE FROM questions WHERE id = ${questionId}::uuid`;

    logger.info('Question deleted', { questionId });
    return resp(HTTP_STATUS.OK, { success: true, message: 'Question deleted successfully' });
  } catch (error) {
    logger.error('Error deleting question', { questionId, error });
    return resp(HTTP_STATUS.INTERNAL_ERROR, {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to delete question' },
    });
  }
};
