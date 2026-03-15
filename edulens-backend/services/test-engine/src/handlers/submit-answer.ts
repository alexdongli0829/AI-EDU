/**
 * Submit Answer Handler - Fixed (non-adaptive) test delivery
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
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

    const db = await getDb();

    // Verify session exists and is active
    const session = await query(
      `SELECT ts.id, ts.test_id, ts.stage_id, ts.question_count, ts.contest_id,
              c.question_ids AS contest_question_ids
       FROM test_sessions ts
       LEFT JOIN contests c ON c.id = ts.contest_id
       WHERE ts.id = $1::uuid AND ts.status = 'active'`,
      sessionId
    ) as any[];

    if (!session || session.length === 0) {
      return errorResponse(404, 'Active test session not found');
    }

    const sessionData = session[0];

    // Get question details (for correctness check + subject inference)
    const questionResult = await query(
      `SELECT id, text, type, options, correct_answer, subject FROM questions WHERE id = $1::uuid`,
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
    await query(
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
    const allAnswers = await query(
      `SELECT sr.is_correct FROM session_responses sr WHERE sr.session_id = $1::uuid`,
      sessionId
    ) as any[];

    const answeredCount = allAnswers.length;
    const correctCount = allAnswers.filter((a: any) => a.is_correct).length;

    // Resolve maxItems and next-question strategy from session metadata
    let maxItems: number;
    const contestQIds: string[] | null = Array.isArray(sessionData.contest_question_ids)
      ? sessionData.contest_question_ids
      : null;

    let nextQFilter: string;
    let nextQParam: string;

    if (contestQIds && contestQIds.length > 0) {
      // Contest session: fixed question list
      maxItems = contestQIds.length;
      nextQFilter = ''; // handled separately below
      nextQParam = '';
    } else if (sessionData.stage_id) {
      // Stage-based session: use stored question_count and filter by stage_id + subject
      maxItems = parseInt(sessionData.question_count) || 20;
      const currentSubject = question.subject as string | null;
      if (currentSubject) {
        nextQFilter = `stage_id = $1 AND subject = $3 AND is_active = true`;
        nextQParam = sessionData.stage_id;
      } else {
        nextQFilter = `stage_id = $1 AND is_active = true`;
        nextQParam = sessionData.stage_id;
      }
    } else {
      // Test-based session: look up test config
      const testInfo = await query(
        `SELECT subject, grade_level, question_count FROM tests WHERE id = $1::uuid`,
        sessionData.test_id
      ) as any[];
      const testData = testInfo[0];
      if (!testData) {
        return errorResponse(500, 'Session has no associated test or stage');
      }
      const countResult = await query(
        `SELECT COUNT(*) as cnt FROM questions WHERE grade_level = $1 AND is_active = true`,
        testData.grade_level
      ) as any[];
      const availableCount = parseInt(countResult[0]?.cnt || '0');
      maxItems = Math.min(testData.question_count, availableCount);
      nextQFilter = `grade_level = $1 AND is_active = true`;
      nextQParam = testData.grade_level;
    }

    // Update session totals
    await query(
      `UPDATE test_sessions SET total_items = $1, correct_count = $2 WHERE id = $3::uuid`,
      answeredCount,
      correctCount,
      sessionId
    );

    // Check if test is complete
    if (answeredCount >= maxItems) {
      const rawScore = maxItems > 0 ? (correctCount / maxItems) * 100 : 0;
      const scaledScore = Math.round(rawScore);

      await query(
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
    let nextQQuery: string;
    let nextQParams: any[];

    if (contestQIds && contestQIds.length > 0) {
      // Contest: fetch by array position
      nextQQuery = `SELECT id, type, text, options, difficulty, skill_tags
                    FROM questions WHERE id = ANY($1::uuid[]) AND is_active = true
                    ORDER BY array_position($1::uuid[], id) LIMIT 1 OFFSET $2`;
      nextQParams = [contestQIds, answeredCount];
    } else {
      const currentSubjectForNext = sessionData.stage_id ? (question.subject as string | null) : null;
      nextQQuery = `SELECT id, type, text, options, difficulty, skill_tags
                    FROM questions WHERE ${nextQFilter}
                    ORDER BY difficulty ASC, id ASC LIMIT 1 OFFSET $2`;
      nextQParams = currentSubjectForNext && nextQFilter.includes('$3')
        ? [nextQParam, answeredCount, currentSubjectForNext]
        : [nextQParam, answeredCount];
    }

    const nextQuestionData = await query(nextQQuery, ...nextQParams) as any[];

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
