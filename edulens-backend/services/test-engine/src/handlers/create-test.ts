/**
 * Create Test Handler
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { getDb, query } from '../lib/database'; // getDb initialises the pool

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
  console.log('Create test:', { path: event.path, method: event.httpMethod });

  try {
    if (!event.body) {
      return errorResponse(400, 'Request body is required');
    }

    const { title, description, subject, gradeLevel, timeLimit, questionCount, questions } = JSON.parse(event.body);

    if (!title || !subject || !gradeLevel || !timeLimit) {
      return errorResponse(400, 'Missing required fields: title, subject, gradeLevel, timeLimit');
    }

    await getDb();

    // Optionally bulk-create questions supplied inline (canonical questions schema)
    const inlineQuestions = Array.isArray(questions) ? questions : [];
    for (let i = 0; i < inlineQuestions.length; i++) {
      const q = inlineQuestions[i];
      if (!q.text || !q.correctAnswer) {
        return errorResponse(400, `Question ${i + 1} is missing text or correctAnswer`);
      }
    }

    // Create test record
    const testId = uuidv4();
    const resolvedCount = inlineQuestions.length > 0 ? inlineQuestions.length : (questionCount || 35);
    await query(
      `INSERT INTO tests (id, title, description, subject, grade_level, time_limit, question_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      testId,
      title,
      description || '',
      subject,
      gradeLevel,
      timeLimit,
      resolvedCount
    );

    // Insert inline questions into the shared questions pool (canonical schema)
    for (const q of inlineQuestions) {
      await query(
        `INSERT INTO questions (text, type, options, correct_answer, explanation, difficulty,
          estimated_time, skill_tags, subject, grade_level, is_active)
         VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $8::text[], $9, $10, true)`,
        q.text,
        q.type || 'multiple_choice',
        JSON.stringify(q.options || []),
        q.correctAnswer,
        q.explanation || '',
        typeof q.difficulty === 'number' ? q.difficulty : 0.5,
        q.estimatedTime || 60,
        q.skillTags || [],
        subject,
        gradeLevel
      );
    }

    console.log(`Test created: ${testId}, questionCount=${resolvedCount}, inlineInserted=${inlineQuestions.length}`);

    return successResponse({
      success: true,
      testId,
      message: 'Test created successfully',
      questionCount: resolvedCount,
    });
  } catch (error) {
    console.error('Create test error:', error);
    return errorResponse(500, 'Internal server error');
  }
}