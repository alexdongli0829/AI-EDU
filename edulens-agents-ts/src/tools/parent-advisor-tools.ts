/**
 * EduLens tools for Parent Advisor agent — TypeScript implementation.
 * Each tool returns structured JSON data from mock data (replace with Aurora queries later).
 */

import { tool } from '@strands-agents/sdk';
import { getMockStudent } from './mock-data.js';

/**
 * Get the student's Learning DNA overview including mastery level, strengths, weaknesses, and recent trends.
 */
export function queryStudentProfile(studentId: string): string {
  const s = getMockStudent(studentId);
  if (!s) {
    return JSON.stringify({
      studentId,
      error: 'no_data',
      message: 'No test data available for this student yet. They may need to complete their first practice test.',
    }, null, 2);
  }
  const history = s.testHistory;

  let trend: string;
  if (history.length >= 2) {
    const diff = history[0].score - history[1].score;
    trend = diff > 0 ? 'improving' : diff === 0 ? 'stable' : 'declining';
  } else {
    trend = 'insufficient data';
  }

  return JSON.stringify({
    studentId: s.studentId,
    name: s.name,
    gradeLevel: s.gradeLevel,
    overallMastery: `${(s.overallMastery * 100).toFixed(0)}%`,
    strengths: s.strengths,
    weaknesses: s.weaknesses,
    recentTrend: trend,
    lastThreeTests: history,
  }, null, 2);
}

/**
 * Get recent test scores and details for a student.
 */
export function queryTestResults(studentId: string, limit = 5): string {
  const s = getMockStudent(studentId);
  if (!s) {
    return JSON.stringify({
      studentName: 'Unknown',
      testCount: 0,
      tests: [],
      message: 'No test history available for this student yet.',
    }, null, 2);
  }
  const tests = s.testHistory.slice(0, limit);

  return JSON.stringify({
    studentName: s.name,
    testCount: tests.length,
    tests: tests.map(t => ({
      ...t,
      percentage: `${t.score}%`,
      accuracy: `${t.correct}/${t.total}`,
    })),
  }, null, 2);
}

/**
 * Get per-skill mastery percentages for a given subject.
 */
export function querySkillBreakdown(studentId: string, subject: string): string {
  const s = getMockStudent(studentId);
  if (!s) {
    return JSON.stringify({
      studentName: 'Unknown',
      subject,
      skills: [],
      message: 'No skill data available for this student yet.',
    }, null, 2);
  }
  const breakdown = s.skillBreakdown[subject] || {};
  const skills = [];

  for (const [skillName, mastery] of Object.entries(breakdown)) {
    const status = mastery >= 0.75 ? 'strong' : mastery >= 0.55 ? 'developing' : 'needs_focus';
    skills.push({
      skill: skillName,
      mastery: `${(mastery * 100).toFixed(0)}%`,
      status,
    });
  }

  return JSON.stringify({
    studentName: s.name,
    subject,
    skills,
  }, null, 2);
}

/**
 * Get time management analysis including average time per question, rushing indicators, and stamina curve.
 */
export function queryTimeBehavior(studentId: string): string {
  const s = getMockStudent(studentId);
  if (!s) {
    return JSON.stringify({
      studentName: 'Unknown',
      message: 'No time behavior data available for this student yet.',
    }, null, 2);
  }
  const tb = s.timeBehavior;

  return JSON.stringify({
    studentName: s.name,
    avgTimePerQuestion: `${tb.avgTimePerQuestion} seconds`,
    rushingIndicator: `${(tb.rushingIndicator * 100).toFixed(0)}% of answers show rushing`,
    staminaCurve: tb.staminaCurve,
    fastAnswers: `${tb.fastAnswers} questions answered in under 15 seconds`,
  }, null, 2);
}

/**
 * Get error classification breakdown showing error types and their frequencies.
 */
export function queryErrorPatterns(studentId: string): string {
  const s = getMockStudent(studentId);
  if (!s) {
    return JSON.stringify({
      studentName: 'Unknown',
      totalErrors: 0,
      patterns: [],
      message: 'No error pattern data available for this student yet.',
    }, null, 2);
  }
  const patterns = s.errorPatterns;
  const totalErrors = patterns.reduce((sum, e) => sum + e.frequency, 0);

  return JSON.stringify({
    studentName: s.name,
    totalErrors,
    patterns: patterns.map(e => ({
      type: e.type,
      count: e.frequency,
      percentage: `${((e.frequency / totalErrors) * 100).toFixed(0)}%`,
      severity: e.severity,
    })),
  }, null, 2);
}

// Tool definitions for Strands SDK using tool() factory
export const parentAdvisorTools = [
  tool({
    name: 'query_student_profile',
    description: 'Get the student\'s Learning DNA overview including mastery level, strengths, weaknesses, and recent trends.',
    inputSchema: {
      type: 'object',
      properties: {
        studentId: {
          type: 'string',
          description: 'The student ID to look up.',
        },
      },
      required: ['studentId'],
    },
    callback: (input: any) => queryStudentProfile(input.studentId),
  }),
  tool({
    name: 'query_test_results',
    description: 'Get recent test scores and details for a student.',
    inputSchema: {
      type: 'object',
      properties: {
        studentId: {
          type: 'string',
          description: 'The student ID.',
        },
        limit: {
          type: 'number',
          description: 'Number of recent tests to return (default 5).',
          default: 5,
        },
      },
      required: ['studentId'],
    },
    callback: (input: any) => queryTestResults(input.studentId, input.limit),
  }),
  tool({
    name: 'query_skill_breakdown',
    description: 'Get per-skill mastery percentages for a given subject.',
    inputSchema: {
      type: 'object',
      properties: {
        studentId: {
          type: 'string',
          description: 'The student ID.',
        },
        subject: {
          type: 'string',
          description: 'The subject — one of "reading", "math", "thinking", or "writing".',
        },
      },
      required: ['studentId', 'subject'],
    },
    callback: (input: any) => querySkillBreakdown(input.studentId, input.subject),
  }),
  tool({
    name: 'query_time_behavior',
    description: 'Get time management analysis including average time per question, rushing indicators, and stamina curve.',
    inputSchema: {
      type: 'object',
      properties: {
        studentId: {
          type: 'string',
          description: 'The student ID.',
        },
      },
      required: ['studentId'],
    },
    callback: (input: any) => queryTimeBehavior(input.studentId),
  }),
  tool({
    name: 'query_error_patterns',
    description: 'Get error classification breakdown showing error types and their frequencies.',
    inputSchema: {
      type: 'object',
      properties: {
        studentId: {
          type: 'string',
          description: 'The student ID.',
        },
      },
      required: ['studentId'],
    },
    callback: (input: any) => queryErrorPatterns(input.studentId),
  }),
];
