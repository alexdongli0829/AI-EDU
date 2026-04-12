/**
 * Database query tools for EduLens agents — production implementation
 *
 * Uses the same postgres.js + SecretsManager pattern as other backend services.
 * Each function returns data in a format suitable for MCP tool responses.
 */

import postgres from 'postgres';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

// -------------------------------------------------------------------------
// Database connection (singleton)
// -------------------------------------------------------------------------

let _sql: postgres.Sql | null = null;

async function getDb(): Promise<postgres.Sql> {
  if (_sql) return _sql;

  const secretArn = process.env.DB_SECRET_ARN;
  if (!secretArn) throw new Error('DB_SECRET_ARN is not set');

  const client = new SecretsManagerClient({
    region: process.env.AWS_REGION_NAME || process.env.AWS_REGION || 'us-west-2',
  });
  const { SecretString } = await client.send(
    new GetSecretValueCommand({ SecretId: secretArn }),
  );
  if (!SecretString) throw new Error('Empty secret');

  const { username, password, host, port, dbname } = JSON.parse(SecretString);
  const url = `postgresql://${username}:${encodeURIComponent(password)}@${host}:${port}/${dbname}?sslmode=require`;

  _sql = postgres(url, { max: 3, idle_timeout: 60, max_lifetime: 3600 });
  return _sql;
}

// -------------------------------------------------------------------------
// Tool: query_student_profile
// -------------------------------------------------------------------------

export async function queryStudentProfile(studentId: string) {
  const db = await getDb();

  const [profile] = await db`
    SELECT sp.student_id, s.first_name, s.last_name, s.grade_level,
           sp.overall_mastery, sp.strengths, sp.weaknesses,
           sp.learning_dna, sp.updated_at
    FROM student_profiles sp
    JOIN students s ON s.id = sp.student_id
    WHERE sp.student_id = ${studentId}
    LIMIT 1
  `;

  if (!profile) return { error: `No profile found for student ${studentId}` };

  // Get recent test trend
  const tests = await db`
    SELECT ts.id, ts.title, ts.completed_at, ts.score, ts.correct_count, ts.total_questions
    FROM test_sessions ts
    WHERE ts.student_id = ${studentId} AND ts.status = 'completed'
    ORDER BY ts.completed_at DESC
    LIMIT 3
  `;

  const recentTrend = tests.length >= 2
    ? tests[0].score > tests[1].score ? 'improving'
      : tests[0].score === tests[1].score ? 'stable' : 'declining'
    : 'insufficient data';

  return {
    studentId: profile.student_id,
    name: `${profile.first_name} ${profile.last_name || ''}`.trim(),
    gradeLevel: profile.grade_level,
    overallMastery: `${(profile.overall_mastery * 100).toFixed(0)}%`,
    strengths: profile.strengths || [],
    weaknesses: profile.weaknesses || [],
    recentTrend,
    lastThreeTests: tests.map((t: any) => ({
      title: t.title,
      date: t.completed_at?.toISOString?.()?.split('T')[0] ?? '',
      score: t.score,
      correct: t.correct_count,
      total: t.total_questions,
    })),
  };
}

// -------------------------------------------------------------------------
// Tool: query_test_results
// -------------------------------------------------------------------------

export async function queryTestResults(studentId: string, limit = 5) {
  const db = await getDb();

  const tests = await db`
    SELECT ts.id, ts.title, ts.completed_at, ts.score,
           ts.correct_count, ts.total_questions, ts.time_spent_seconds
    FROM test_sessions ts
    WHERE ts.student_id = ${studentId} AND ts.status = 'completed'
    ORDER BY ts.completed_at DESC
    LIMIT ${limit}
  `;

  return {
    testCount: tests.length,
    tests: tests.map((t: any) => ({
      id: t.id,
      title: t.title,
      date: t.completed_at?.toISOString?.()?.split('T')[0] ?? '',
      score: t.score,
      accuracy: `${t.correct_count}/${t.total_questions}`,
      timeSpent: t.time_spent_seconds ? `${Math.round(t.time_spent_seconds / 60)} minutes` : 'N/A',
    })),
  };
}

// -------------------------------------------------------------------------
// Tool: query_skill_breakdown
// -------------------------------------------------------------------------

export async function querySkillBreakdown(studentId: string, subject: string) {
  const db = await getDb();

  const skills = await db`
    SELECT sr.skill_tag, COUNT(*) as total,
           SUM(CASE WHEN sr.is_correct THEN 1 ELSE 0 END) as correct
    FROM session_responses sr
    JOIN test_sessions ts ON ts.id = sr.session_id
    WHERE ts.student_id = ${studentId}
      AND sr.skill_tag LIKE ${subject + '.%'}
      AND ts.status = 'completed'
    GROUP BY sr.skill_tag
  `;

  return {
    subject,
    skills: skills.map((s: any) => {
      const mastery = s.total > 0 ? s.correct / s.total : 0;
      return {
        skill: s.skill_tag.replace(`${subject}.`, ''),
        mastery: `${(mastery * 100).toFixed(0)}%`,
        status: mastery >= 0.75 ? 'strong' : mastery >= 0.55 ? 'developing' : 'needs_focus',
        sampleSize: s.total,
      };
    }),
  };
}

// -------------------------------------------------------------------------
// Tool: query_time_behavior
// -------------------------------------------------------------------------

export async function queryTimeBehavior(studentId: string) {
  const db = await getDb();

  const [stats] = await db`
    SELECT
      AVG(sr.time_spent_seconds) as avg_time,
      COUNT(CASE WHEN sr.time_spent_seconds < 15 THEN 1 END) as fast_answers,
      COUNT(*) as total_answers
    FROM session_responses sr
    JOIN test_sessions ts ON ts.id = sr.session_id
    WHERE ts.student_id = ${studentId} AND ts.status = 'completed'
  `;

  if (!stats || stats.total_answers === 0) {
    return { error: 'No response data available for time analysis' };
  }

  const rushingIndicator = stats.fast_answers / stats.total_answers;

  // Stamina analysis: compare accuracy of first half vs last half
  const halves = await db`
    WITH ranked AS (
      SELECT sr.is_correct,
             ROW_NUMBER() OVER (PARTITION BY sr.session_id ORDER BY sr.question_order) as rn,
             COUNT(*) OVER (PARTITION BY sr.session_id) as total
      FROM session_responses sr
      JOIN test_sessions ts ON ts.id = sr.session_id
      WHERE ts.student_id = ${studentId} AND ts.status = 'completed'
    )
    SELECT
      CASE WHEN rn <= total / 2 THEN 'first_half' ELSE 'second_half' END as half,
      AVG(CASE WHEN is_correct THEN 1.0 ELSE 0.0 END) as accuracy
    FROM ranked
    GROUP BY CASE WHEN rn <= total / 2 THEN 'first_half' ELSE 'second_half' END
  `;

  const firstHalf = halves.find((h: any) => h.half === 'first_half');
  const secondHalf = halves.find((h: any) => h.half === 'second_half');
  const staminaDrop = firstHalf && secondHalf
    ? `accuracy drops ${((firstHalf.accuracy - secondHalf.accuracy) * 100).toFixed(0)}% in second half`
    : 'insufficient data for stamina analysis';

  return {
    avgTimePerQuestion: `${Math.round(stats.avg_time)} seconds`,
    rushingIndicator: `${(rushingIndicator * 100).toFixed(0)}% of answers show rushing`,
    staminaCurve: staminaDrop,
    fastAnswers: `${stats.fast_answers} questions answered in under 15 seconds`,
  };
}

// -------------------------------------------------------------------------
// Tool: query_error_patterns
// -------------------------------------------------------------------------

export async function queryErrorPatterns(studentId: string) {
  const db = await getDb();

  const errors = await db`
    SELECT sr.error_type, COUNT(*) as frequency,
           CASE
             WHEN sr.error_type IN ('concept_gap', 'time_pressure') THEN 'high'
             WHEN sr.error_type = 'careless_error' THEN 'medium'
             ELSE 'low'
           END as severity
    FROM session_responses sr
    JOIN test_sessions ts ON ts.id = sr.session_id
    WHERE ts.student_id = ${studentId}
      AND ts.status = 'completed'
      AND sr.is_correct = false
      AND sr.error_type IS NOT NULL
    GROUP BY sr.error_type
    ORDER BY frequency DESC
  `;

  const totalErrors = errors.reduce((sum: number, e: any) => sum + Number(e.frequency), 0);

  return {
    totalErrors,
    patterns: errors.map((e: any) => ({
      type: e.error_type,
      count: Number(e.frequency),
      percentage: `${((Number(e.frequency) / totalErrors) * 100).toFixed(0)}%`,
      severity: e.severity,
    })),
  };
}

// -------------------------------------------------------------------------
// Tool: load_question_context (for Student Tutor)
// -------------------------------------------------------------------------

export async function loadQuestionContext(questionId: string) {
  const db = await getDb();

  const [question] = await db`
    SELECT q.id, q.text, q.options, q.correct_answer, q.explanation,
           q.skill_tags, q.difficulty, q.estimated_time_seconds
    FROM questions q
    WHERE q.id = ${questionId}
    LIMIT 1
  `;

  if (!question) return { error: `Question ${questionId} not found` };

  return {
    questionId: question.id,
    questionText: question.text,
    options: question.options,
    correctAnswer: question.correct_answer,
    explanation: question.explanation,
    skillTags: question.skill_tags || [],
    difficulty: question.difficulty,
    estimatedTime: question.estimated_time_seconds,
  };
}

// -------------------------------------------------------------------------
// Tool: query_student_level
// -------------------------------------------------------------------------

export async function queryStudentLevel(studentId: string) {
  const db = await getDb();

  const [profile] = await db`
    SELECT sp.overall_mastery, sp.learning_dna, s.first_name
    FROM student_profiles sp
    JOIN students s ON s.id = sp.student_id
    WHERE sp.student_id = ${studentId}
    LIMIT 1
  `;

  if (!profile) return { error: `No profile found for student ${studentId}` };

  return {
    studentName: profile.first_name,
    overallMastery: `${(profile.overall_mastery * 100).toFixed(0)}%`,
    learningDna: profile.learning_dna,
  };
}

// -------------------------------------------------------------------------
// Tool: record_understanding (writes signal to DB)
// -------------------------------------------------------------------------

export async function recordUnderstanding(input: {
  studentId: string;
  questionId: string;
  understood: boolean;
  notes?: string;
}) {
  const db = await getDb();

  await db`
    INSERT INTO understanding_signals (student_id, question_id, understood, notes, created_at)
    VALUES (${input.studentId}, ${input.questionId}, ${input.understood}, ${input.notes ?? null}, NOW())
  `;

  return {
    recorded: true,
    studentId: input.studentId,
    questionId: input.questionId,
    understood: input.understood,
  };
}
