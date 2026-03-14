/**
 * Create Test Handler
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { getPrismaClient } from '../lib/database';

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

    const { title, description, subject, gradeLevel, timeLimit, questions } = JSON.parse(event.body);

    if (!title || !subject || !gradeLevel || !timeLimit || !questions || !Array.isArray(questions)) {
      return errorResponse(400, 'Missing required fields: title, subject, gradeLevel, timeLimit, questions');
    }

    const prisma = await getPrismaClient();

    // Create test
    const testId = uuidv4();
    await prisma.$executeRawUnsafe(
      `INSERT INTO tests (id, title, description, subject, grade_level, time_limit, question_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      testId,
      title,
      description || '',
      subject,
      gradeLevel,
      timeLimit,
      questions.length
    );

    // Create questions
    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      const {
        questionType = 'multiple_choice',
        questionText,
        options,
        correctAnswer,
        skillTags = [],
        difficultyLevel = 3
      } = question;

      if (!questionText || !correctAnswer) {
        return errorResponse(400, `Question ${i + 1} is missing questionText or correctAnswer`);
      }

      const questionId = uuidv4();
      await prisma.$executeRawUnsafe(
        `INSERT INTO questions (id, test_id, question_type, subject, question_text, options, correct_answer, skill_tags, difficulty_level, order_index)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        questionId,
        testId,
        questionType,
        subject,
        questionText,
        JSON.stringify(options || []),
        correctAnswer,
        skillTags,
        difficultyLevel,
        i
      );
    }

    console.log(`Test created: ${testId} with ${questions.length} questions`);

    return successResponse({
      success: true,
      testId,
      message: 'Test created successfully',
      questionCount: questions.length
    });
  } catch (error) {
    console.error('Create test error:', error);
    return errorResponse(500, 'Internal server error');
  }
}