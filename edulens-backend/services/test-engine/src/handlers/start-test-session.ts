/**
 * Start Test Session Handler - Fixed (non-adaptive) test delivery
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { getDb, query } from '../lib/database';
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

    const { testId, studentId, contestId, testFormat, checkOnly } = JSON.parse(event.body);
    let stageId: string | undefined = JSON.parse(event.body).stageId;
    const subjectParam: string | undefined = JSON.parse(event.body).subject;

    if (!studentId) {
      return errorResponse(400, 'studentId is required');
    }
    if (!testId && !stageId && !contestId) {
      return errorResponse(400, 'Either testId, stageId, or contestId is required');
    }

    // Auto-resolve active stage when only testId is provided.
    // This ensures every session is tagged with stage_id so analytics
    // can correctly filter tests by stage.
    if (testId && !stageId) {
      const activeStageRows = await query(
        `SELECT stage_id FROM student_stages WHERE student_id = $1::uuid AND status = 'active' LIMIT 1`,
        studentId
      ) as any[];
      if (activeStageRows.length) {
        stageId = activeStageRows[0].stage_id;
      }
    }

    const [, sysConfig] = await Promise.all([getDb(), getSystemConfig()]);

    // --- Resolve test config ---
    // Start with system-config defaults; override from test record or stage test_formats
    let testTitle = 'Practice Test';
    let subject: string | null = subjectParam || null;
    let questionCount = cfgInt(sysConfig, 'testDefaultQuestionCount');
    let timeRemaining = cfgInt(sysConfig, 'testDefaultTimeLimitSeconds');
    let gradeLevelFilter: string | null = null;
    let studentStageId: string | null = null;

    if (testId) {
      const test = await query(
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
      const stageRows = await query(
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
      const subjectLabel = subject ? subject.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()) : (testFormat || 'Practice');
      if (!testTitle || testTitle === 'Practice Test') testTitle = `${stage.display_name} — ${subjectLabel}`;

      // Resolve the student_stage enrollment id
      const ssRows = await query(
        `SELECT id FROM student_stages WHERE student_id = $1 AND stage_id = $2 AND status = 'active'`,
        studentId, stageId
      ) as any[];

      if (ssRows.length) {
        studentStageId = ssRows[0].id;
      }
    }

    // --- Resolve contest: auto-set stageId and use contest's question_ids ---
    let contestQuestionIds: string[] | null = null;
    if (contestId) {
      const contestRows = await query(
        `SELECT id, status, stage_id, question_ids FROM contests WHERE id = $1::uuid`,
        contestId
      ) as any[];

      if (!contestRows.length) {
        return errorResponse(404, 'Contest not found');
      }
      if (contestRows[0].status !== 'active') {
        return errorResponse(409, `Contest is not currently active (status: ${contestRows[0].status})`);
      }

      // Auto-set stageId from contest and use its pinned question list
      if (!stageId) stageId = contestRows[0].stage_id;
      const rawIds = contestRows[0].question_ids;
      contestQuestionIds = Array.isArray(rawIds) ? rawIds : [];
    }

    // checkOnly mode: just return availability without touching sessions
    if (!checkOnly) {
      await query(
        `UPDATE test_sessions SET status = 'cancelled' WHERE student_id = $1::uuid AND status = 'active'`,
        studentId
      );
    }

    // --- Count available questions ---
    let countQuery: string;
    let countParams: any[];
    let availableCount: number;

    if (contestQuestionIds && contestQuestionIds.length > 0) {
      // Contest: use pinned question list — count is exactly the contest's questions
      availableCount = contestQuestionIds.length;
    } else if (stageId) {
      countQuery = `SELECT COUNT(*) as cnt FROM questions WHERE stage_id = $1 AND is_active = true`;
      countParams = [stageId];
      if (subject) {
        countQuery += ` AND subject = $2`;
        countParams.push(subject);
      }
      const countResult = await query(countQuery, ...countParams) as any[];
      availableCount = parseInt(countResult[0]?.cnt || '0');

      // Fallback: no stage-tagged questions → query by the student's grade_level
      if (availableCount === 0) {
        const studentRows = await query(
          `SELECT grade_level FROM students WHERE id = $1::uuid`,
          studentId
        ) as any[];
        const gradeLevel = studentRows[0]?.grade_level;
        if (gradeLevel) {
          gradeLevelFilter = gradeLevel;
          let fbQuery = `SELECT COUNT(*) as cnt FROM questions WHERE grade_level = $1 AND is_active = true`;
          const fbParams: any[] = [gradeLevel];
          if (subject) { fbQuery += ` AND subject = $2`; fbParams.push(subject); }
          const fbResult = await query(fbQuery, ...fbParams) as any[];
          availableCount = parseInt(fbResult[0]?.cnt || '0');
          // Note: keep stageId so session is tagged; gradeLevelFilter is set for question fetch
        }
      }
    } else {
      countQuery = `SELECT COUNT(*) as cnt FROM questions WHERE grade_level = $1 AND is_active = true`;
      countParams = [gradeLevelFilter];
      if (subject && subject !== 'mixed') {
        countQuery += ` AND subject = $2`;
        countParams.push(subject);
      }
      const countResult = await query(countQuery, ...countParams) as any[];
      availableCount = parseInt(countResult[0]?.cnt || '0');
    }

    // checkOnly: return availability result, no session created
    if (checkOnly) {
      return successResponse({ available: availableCount > 0, count: availableCount });
    }

    if (availableCount === 0) {
      return errorResponse(500, 'No questions available for this test');
    }

    const minQ = cfgInt(sysConfig, 'testMinQuestions');
    const maxQ = cfgInt(sysConfig, 'testMaxQuestions');
    // For contests use exact question count (no min/max clamp)
    const totalQuestions = contestQuestionIds
      ? availableCount
      : Math.max(minQ, Math.min(maxQ, Math.min(questionCount, availableCount)));

    // --- Create test session ---
    const sessionId = uuidv4();

    await query(
      `INSERT INTO test_sessions
         (id, test_id, student_id, student_stage_id, contest_id, status, time_remaining, estimated_ability, started_at, stage_id, question_count)
       VALUES
         ($1::uuid, $2, $3::uuid, $4, $5, 'active', $6, 0.0, NOW(), $7, $8)`,
      sessionId,
      testId ? testId : null,
      studentId,
      studentStageId,
      contestId ? contestId : null,
      timeRemaining,
      stageId || null,
      totalQuestions
    );

    // --- Fetch first question ---
    let firstQQuery: string;
    let firstQParams: any[];

    if (contestQuestionIds && contestQuestionIds.length > 0) {
      // Contest: fetch first question from the pinned list (maintain order by array position)
      firstQQuery = `SELECT id, type, text, options, difficulty, skill_tags
                     FROM questions WHERE id = ANY($1::uuid[]) AND is_active = true
                     ORDER BY array_position($1::uuid[], id) LIMIT 1`;
      firstQParams = [contestQuestionIds];
    } else if (stageId && !gradeLevelFilter) {
      // Stage has its own questions
      firstQQuery = `SELECT id, type, text, options, difficulty, skill_tags
                     FROM questions WHERE stage_id = $1 AND is_active = true`;
      firstQParams = [stageId];
      if (subject) {
        firstQQuery += ` AND subject = $2`;
        firstQParams.push(subject);
      }
      firstQQuery += ` ORDER BY difficulty ASC, id ASC LIMIT 1`;
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

    const questionData = await query(firstQQuery, ...firstQParams) as any[];

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
