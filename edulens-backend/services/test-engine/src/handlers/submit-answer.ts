/**
 * Submit Answer Handler - Fixed (non-adaptive) test delivery
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
  console.log('Submit answer:', { path: event.path, method: event.httpMethod });

  try {
    const sessionId = event.pathParameters?.sessionId;
    if (!sessionId) {
      return errorResponse(400, 'sessionId is required');
    }

    if (!event.body) {
      return errorResponse(400, 'Request body is required');
    }

    const { questionId, answer, timeSpent } = JSON.parse(event.body);

    if (!questionId || answer === undefined || !timeSpent) {
      return errorResponse(400, 'questionId, answer, and timeSpent are required');
    }

    const prisma = await getPrismaClient();

    // Verify session exists and is active
    const session = await prisma.$queryRawUnsafe(
      `SELECT id, test_id FROM test_sessions WHERE id = $1::uuid AND status = 'active'`,
      sessionId
    ) as any[];

    if (!session || session.length === 0) {
      return errorResponse(404, 'Active test session not found');
    }

    const sessionData = session[0];

    // Get question details (for correctness check)
    const questionResult = await prisma.$queryRawUnsafe(
      `SELECT id, text, type, options, correct_answer FROM questions WHERE id = $1::uuid`,
      questionId
    ) as any[];

    if (!questionResult || questionResult.length === 0) {
      return errorResponse(404, 'Question not found');
    }

    const question = questionResult[0];

    // Determine correctness — options stored as [{id, text, isCorrect}]
    const rawOptions: any[] = Array.isArray(question.options)
      ? question.options
      : JSON.parse(question.options || '[]');
    const matchedOption = rawOptions.find((o: any) =>
      typeof o === 'string'
        ? o.toLowerCase().trim() === answer.toLowerCase().trim()
        : (o.text || '').toLowerCase().trim() === answer.toLowerCase().trim()
    );
    const isCorrect = matchedOption
      ? (typeof matchedOption === 'string'
          ? matchedOption.toLowerCase() === (question.correct_answer || '').toLowerCase()
          : !!matchedOption.isCorrect)
      : false;

    // Save answer
    const answerId = uuidv4();
    await prisma.$executeRawUnsafe(
      `INSERT INTO session_responses (id, session_id, question_id, student_answer, is_correct, time_spent)
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6)`,
      answerId,
      sessionId,
      questionId,
      answer,
      isCorrect,
      timeSpent
    );

    // Count total answers in this session (includes the one just saved)
    const allAnswers = await prisma.$queryRawUnsafe(
      `SELECT sr.is_correct FROM session_responses sr WHERE sr.session_id = $1::uuid`,
      sessionId
    ) as any[];

    const answeredCount = allAnswers.length;
    const correctCount = allAnswers.filter((a: any) => a.is_correct).length;

    // Get test info
    const testInfo = await prisma.$queryRawUnsafe(
      `SELECT subject, grade_level, question_count FROM tests WHERE id = $1::uuid`,
      sessionData.test_id
    ) as any[];

    const testData = testInfo[0];

    // Count available questions (same query used at session start)
    let countQuery = `SELECT COUNT(*) as cnt FROM questions WHERE grade_level = $1 AND is_active = true`;
    const countParams: any[] = [testData.grade_level];
    if (testData.subject && testData.subject !== 'mixed') {
      countQuery += ` AND subject = $2`;
      countParams.push(testData.subject);
    }
    const countResult = await prisma.$queryRawUnsafe(countQuery, ...countParams) as any[];
    const availableCount = parseInt(countResult[0]?.cnt || '0');
    const maxItems = Math.min(testData.question_count, availableCount);

    // Update session totals
    await prisma.$executeRawUnsafe(
      `UPDATE test_sessions SET total_items = $1, correct_count = $2 WHERE id = $3::uuid`,
      answeredCount,
      correctCount,
      sessionId
    );

    // Check if test is complete
    if (answeredCount >= maxItems) {
      const rawScore = maxItems > 0 ? (correctCount / maxItems) * 100 : 0;
      const scaledScore = Math.round(rawScore);

      await prisma.$executeRawUnsafe(
        `UPDATE test_sessions SET status = 'completed', completed_at = NOW(), scaled_score = $1, raw_score = $2 WHERE id = $3::uuid`,
        scaledScore,
        rawScore / 100,
        sessionId
      );

      console.log(`Test completed for session ${sessionId}. Score: ${scaledScore}%`);

      return successResponse({
        success: true,
        isCorrect,
        testCompleted: true,
        sessionId,
        finalResults: {
          scaledScore,
          rawScore: Math.round(rawScore),
          totalItems: answeredCount,
          correctCount,
        },
      });
    }

    // Fetch next question using OFFSET = answeredCount (0-based index)
    let nextQQuery = `SELECT id, type, text, options, difficulty, skill_tags
                      FROM questions WHERE grade_level = $1 AND is_active = true`;
    const nextQParams: any[] = [testData.grade_level];
    if (testData.subject && testData.subject !== 'mixed') {
      nextQQuery += ` AND subject = $2`;
      nextQParams.push(testData.subject);
    }
    nextQQuery += ` ORDER BY difficulty ASC, id ASC LIMIT 1 OFFSET $${nextQParams.length + 1}`;
    nextQParams.push(answeredCount);

    const nextQuestionData = await prisma.$queryRawUnsafe(nextQQuery, ...nextQParams) as any[];

    let nextQuestion = null;
    if (nextQuestionData && nextQuestionData.length > 0) {
      const q = nextQuestionData[0];
      const rawOpts: any[] = Array.isArray(q.options) ? q.options : JSON.parse(q.options || '[]');
      const displayOpts = rawOpts.map((o: any) => typeof o === 'string' ? o : o.text);
      nextQuestion = {
        id: q.id,
        type: q.type,
        text: q.text,
        options: displayOpts,
        skillTags: q.skill_tags || [],
      };
    }

    return successResponse({
      success: true,
      isCorrect,
      testCompleted: false,
      sessionId,
      nextQuestion,
      questionNumber: answeredCount + 1,
      progress: {
        answeredQuestions: answeredCount,
        totalQuestions: maxItems,
      },
    });
  } catch (error) {
    console.error('Submit answer error:', error);
    return errorResponse(500, 'Internal server error');
  }
}
