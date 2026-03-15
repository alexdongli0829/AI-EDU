/**
 * Start Test Session Handler - Fixed (non-adaptive) test delivery
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { getPrismaClient } from '../lib/database';
import { getSystemConfig, cfgInt } from '../lib/system-config';

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

    const { testId, studentId, stageId, contestId, testFormat } = JSON.parse(event.body);

    if (!studentId) {
      return errorResponse(400, 'studentId is required');
    }
    if (!testId && !stageId) {
      return errorResponse(400, 'Either testId or stageId is required');
    }

    const [prisma, sysConfig] = await Promise.all([getPrismaClient(), getSystemConfig()]);

    // --- Resolve test config ---
    // Start with system-config defaults; override from test record or stage test_formats
    let testTitle = 'Practice Test';
    let subject: string | null = null;
    let questionCount = cfgInt(sysConfig, 'testDefaultQuestionCount');
    let timeRemaining = cfgInt(sysConfig, 'testDefaultTimeLimitSeconds');
    let gradeLevelFilter: string | null = null;
    let studentStageId: string | null = null;

    if (testId) {
      const test = await prisma.$queryRawUnsafe(
        `SELECT id, title, subject, grade_level, time_limit, question_count FROM tests WHERE id = $1::uuid`,
        testId
      ) as any[];

      if (!test || test.length === 0) {
        return errorResponse(404, 'Test not found');
      }

      const t = test[0];
      testTitle = t.title;
      subject = t.subject;
      gradeLevelFilter = t.grade_level;
      questionCount = t.question_count;
      timeRemaining = t.time_limit;
    }

    if (stageId) {
      // Load stage config and resolve the student's stage enrollment id
      const stageRows = await prisma.$queryRawUnsafe(
        `SELECT id, display_name, test_formats FROM stages WHERE id = $1 AND is_active = true`,
        stageId
      ) as any[];

      if (!stageRows.length) {
        return errorResponse(404, `Stage '${stageId}' not found or not active`);
      }

      const stage = stageRows[0];
      const formats = stage.test_formats || {};
      const fmt = formats[testFormat || 'practice'] || {};
      if (fmt.question_count) questionCount = fmt.question_count;
      if (fmt.time_limit_seconds) timeRemaining = fmt.time_limit_seconds;
      if (!testTitle || testTitle === 'Practice Test') testTitle = `${stage.display_name} — ${testFormat || 'Practice'}`;

      // Resolve the student_stage enrollment id
      const ssRows = await prisma.$queryRawUnsafe(
        `SELECT id FROM student_stages WHERE student_id = $1 AND stage_id = $2 AND status = 'active'`,
        studentId, stageId
      ) as any[];

      if (ssRows.length) {
        studentStageId = ssRows[0].id;
      }
    }

    // --- Validate contest if provided ---
    if (contestId) {
      const contestRows = await prisma.$queryRawUnsafe(
        `SELECT id, status FROM contests WHERE id = $1::uuid`,
        contestId
      ) as any[];

      if (!contestRows.length) {
        return errorResponse(404, 'Contest not found');
      }
      if (contestRows[0].status !== 'active') {
        return errorResponse(409, `Contest is not currently active (status: ${contestRows[0].status})`);
      }
    }

    // Cancel any existing active sessions for this student (allow fresh start)
    await prisma.$executeRawUnsafe(
      `UPDATE test_sessions SET status = 'cancelled' WHERE student_id = $1::uuid AND status = 'active'`,
      studentId
    );

    // --- Count available questions ---
    let countQuery: string;
    let countParams: any[];

    if (stageId) {
      countQuery = `SELECT COUNT(*) as cnt FROM questions WHERE stage_id = $1 AND is_active = true`;
      countParams = [stageId];
    } else {
      countQuery = `SELECT COUNT(*) as cnt FROM questions WHERE grade_level = $1 AND is_active = true`;
      countParams = [gradeLevelFilter];
      if (subject && subject !== 'mixed') {
        countQuery += ` AND subject = $2`;
        countParams.push(subject);
      }
    }

    const countResult = await prisma.$queryRawUnsafe(countQuery, ...countParams) as any[];
    const availableCount = parseInt(countResult[0]?.cnt || '0');

    if (availableCount === 0) {
      return errorResponse(500, 'No questions available for this test');
    }

    const minQ = cfgInt(sysConfig, 'testMinQuestions');
    const maxQ = cfgInt(sysConfig, 'testMaxQuestions');
    const totalQuestions = Math.max(minQ, Math.min(maxQ, Math.min(questionCount, availableCount)));

    // --- Create test session ---
    const sessionId = uuidv4();

    await prisma.$executeRawUnsafe(
      `INSERT INTO test_sessions
         (id, test_id, student_id, student_stage_id, contest_id, status, time_remaining, estimated_ability, started_at)
       VALUES
         ($1::uuid, $2, $3::uuid, $4, $5, 'active', $6, 0.0, NOW())`,
      sessionId,
      testId ? testId : null,
      studentId,
      studentStageId,
      contestId ? contestId : null,
      timeRemaining
    );

    // --- Fetch first question ---
    let firstQQuery: string;
    let firstQParams: any[];

    if (stageId) {
      firstQQuery = `SELECT id, type, text, options, difficulty, skill_tags
                     FROM questions WHERE stage_id = $1 AND is_active = true
                     ORDER BY difficulty ASC, id ASC LIMIT 1`;
      firstQParams = [stageId];
    } else {
      firstQQuery = `SELECT id, type, text, options, difficulty, skill_tags
                     FROM questions WHERE grade_level = $1 AND is_active = true`;
      firstQParams = [gradeLevelFilter];
      if (subject && subject !== 'mixed') {
        firstQQuery += ` AND subject = $2`;
        firstQParams.push(subject);
      }
      firstQQuery += ` ORDER BY difficulty ASC, id ASC LIMIT 1`;
    }

    const questionData = await prisma.$queryRawUnsafe(firstQQuery, ...firstQParams) as any[];

    if (!questionData || questionData.length === 0) {
      return errorResponse(500, 'Unable to fetch first question');
    }

    const q = questionData[0];
    const rawOptions: any[] = Array.isArray(q.options) ? q.options : JSON.parse(q.options || '[]');
    const displayOptions = rawOptions.map((o: any) => typeof o === 'string' ? o : o.text);

    console.log(`Test session started: ${sessionId} for student ${studentId} stage=${stageId || 'none'} contest=${contestId || 'none'}`);

    return successResponse({
      success: true,
      sessionId,
      testId: testId || null,
      stageId: stageId || null,
      contestId: contestId || null,
      testTitle,
      subject,
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
