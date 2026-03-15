/**
 * Get Test Details Handler
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getDb, query } from '../lib/database';

function successResponse(data: any): APIGatewayProxyResult {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
    },
    body: JSON.stringify(data),
  };
}

function errorResponse(statusCode: number, message: string): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
    },
    body: JSON.stringify({
      success: false,
      error: message,
    }),
  };
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  console.log('Get test details:', { path: event.path, method: event.httpMethod });

  try {
    const testId = event.pathParameters?.testId;
    if (!testId) {
      return errorResponse(400, 'testId is required');
    }

    const includeQuestions = event.queryStringParameters?.includeQuestions === 'true';

    const db = await getDb();

    // Get test details
    const testResult = await query(
      `SELECT * FROM tests WHERE id = $1`,
      testId
    ) as any[];

    if (!testResult || testResult.length === 0) {
      return errorResponse(404, 'Test not found');
    }

    const test = testResult[0];

    let questions = null;
    if (includeQuestions) {
      const questionsResult = await query(
        `SELECT 
          id,
          question_type,
          question_text,
          options,
          skill_tags,
          difficulty_level,
          order_index
         FROM questions 
         WHERE test_id = $1 
         ORDER BY order_index`,
        testId
      ) as any[];

      questions = questionsResult.map((q: any) => ({
        id: q.id,
        type: q.question_type,
        text: q.question_text,
        options: JSON.parse(q.options || '[]'),
        skillTags: q.skill_tags,
        difficultyLevel: q.difficulty_level,
        orderIndex: q.order_index
        // Note: We don't include correct_answer for security
      }));
    }

    // Get test statistics (number of sessions, average score, etc.)
    const statsResult = await query(
      `SELECT 
        COUNT(*) as total_sessions,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_sessions,
        AVG(CASE WHEN status = 'completed' THEN estimated_ability END) as avg_ability,
        STDDEV(CASE WHEN status = 'completed' THEN estimated_ability END) as ability_stddev
       FROM test_sessions 
       WHERE test_id = $1`,
      testId
    ) as any[];

    const stats = statsResult[0] || {};

    return successResponse({
      success: true,
      test: {
        id: test.id,
        title: test.title,
        description: test.description,
        subject: test.subject,
        gradeLevel: test.grade_level,
        timeLimit: test.time_limit,
        questionCount: test.question_count,
        createdAt: test.created_at,
        updatedAt: test.updated_at
      },
      questions,
      statistics: {
        totalSessions: parseInt(stats.total_sessions || '0'),
        completedSessions: parseInt(stats.completed_sessions || '0'),
        averageAbility: parseFloat(stats.avg_ability || '0'),
        abilityStandardDeviation: parseFloat(stats.ability_stddev || '0')
      }
    });
  } catch (error) {
    console.error('Get test details error:', error);
    return errorResponse(500, 'Internal server error');
  }
}