/**
 * Start Test Session Handler - Fixed (non-adaptive) test delivery
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
  console.log('Start test session:', { path: event.path, method: event.httpMethod });

  try {
    if (!event.body) {
      return errorResponse(400, 'Request body is required');
    }

    const { testId, studentId } = JSON.parse(event.body);

    if (!testId || !studentId) {
      return errorResponse(400, 'testId and studentId are required');
    }

    const prisma = await getPrismaClient();

    // Verify test exists
    const test = await prisma.$queryRawUnsafe(
      `SELECT id, title, subject, grade_level, time_limit, question_count FROM tests WHERE id = $1::uuid`,
      testId
    ) as any[];

    if (!test || test.length === 0) {
      return errorResponse(404, 'Test not found');
    }

    const testData = test[0];

    // Check if student already has an active session for this test
    const existingSession = await prisma.$queryRawUnsafe(
      `SELECT id FROM test_sessions WHERE test_id = $1::uuid AND student_id = $2::uuid AND status = 'active'`,
      testId,
      studentId
    ) as any[];

    if (existingSession && existingSession.length > 0) {
      return errorResponse(409, 'Student already has an active session for this test');
    }

    // Count available questions for this test's subject + grade
    let countQuery = `SELECT COUNT(*) as cnt FROM questions WHERE grade_level = $1 AND is_active = true`;
    const countParams: any[] = [testData.grade_level];
    if (testData.subject && testData.subject !== 'mixed') {
      countQuery += ` AND subject = $2`;
      countParams.push(testData.subject);
    }
    const countResult = await prisma.$queryRawUnsafe(countQuery, ...countParams) as any[];
    const availableCount = parseInt(countResult[0]?.cnt || '0');

    if (availableCount === 0) {
      return errorResponse(500, 'No questions available for this test');
    }

    const totalQuestions = Math.min(testData.question_count, availableCount);

    // Create test session
    const sessionId = uuidv4();
    const timeRemaining = testData.time_limit; // seconds

    await prisma.$executeRawUnsafe(
      `INSERT INTO test_sessions (id, test_id, student_id, status, time_remaining, estimated_ability, started_at)
       VALUES ($1::uuid, $2::uuid, $3::uuid, 'active', $4, 0.0, NOW())`,
      sessionId,
      testId,
      studentId,
      timeRemaining
    );

    // Fetch first question (index 0) using fixed ordering
    let firstQQuery = `SELECT id, type, text, options, difficulty, skill_tags
                       FROM questions WHERE grade_level = $1 AND is_active = true`;
    const firstQParams: any[] = [testData.grade_level];
    if (testData.subject && testData.subject !== 'mixed') {
      firstQQuery += ` AND subject = $2`;
      firstQParams.push(testData.subject);
    }
    firstQQuery += ` ORDER BY difficulty ASC, id ASC LIMIT 1`;

    const questionData = await prisma.$queryRawUnsafe(firstQQuery, ...firstQParams) as any[];

    if (!questionData || questionData.length === 0) {
      return errorResponse(500, 'Unable to fetch first question');
    }

    const q = questionData[0];
    const rawOptions: any[] = Array.isArray(q.options) ? q.options : JSON.parse(q.options || '[]');
    const displayOptions = rawOptions.map((o: any) => typeof o === 'string' ? o : o.text);

    console.log(`Test session started: ${sessionId} for student ${studentId}`);

    return successResponse({
      success: true,
      sessionId,
      testId,
      testTitle: testData.title,
      subject: testData.subject,
      timeRemaining,
      currentQuestion: {
        id: q.id,
        type: q.type,
        text: q.text,
        options: displayOptions,
        skillTags: q.skill_tags || [],
      },
      questionNumber: 1,
      totalQuestions,
    });
  } catch (error) {
    console.error('Start test session error:', error);
    return errorResponse(500, 'Internal server error');
  }
}
