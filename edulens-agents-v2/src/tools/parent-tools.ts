/**
 * Parent Advisor Tools - Simplified version for compilation
 */

import { tool } from '@strands-agents/sdk';
import { z } from 'zod';
import { getTestData } from '../data/test-data.js';

// Simplified Zod schemas
const QueryStudentProfileSchema = z.object({
  studentId: z.string().min(1, 'Student ID is required')
});

const QueryTestResultsSchema = z.object({
  studentId: z.string().min(1, 'Student ID is required'),
  limit: z.number().int().min(1).max(20).optional().default(5)
});

/**
 * Get comprehensive student profile
 */
async function queryStudentProfile(input: z.infer<typeof QueryStudentProfileSchema>): Promise<string> {
  const { studentId } = input;
  const data = getTestData();

  const student = data.students.find(s => s.studentId === studentId);
  if (!student) {
    throw new Error(`Student not found: ${studentId}`);
  }

  const profile = {
    student: {
      studentId: student.studentId,
      name: student.name,
      gradeLevel: student.gradeLevel,
      overallMastery: student.overallMastery
    },
    performance: {
      averageScore: student.testHistory.length > 0 ? (student.testHistory[0]?.score ?? 0) : 0,
      testCount: student.testHistory.length,
      lastTestDate: student.testHistory[0]?.date ?? 'No tests'
    },
    skills: {
      strengths: student.strengths,
      weaknesses: student.weaknesses
    },
    recommendations: ['Practice weak areas', 'Maintain strong performance in strengths']
  };

  return JSON.stringify(profile, null, 2);
}

/**
 * Get detailed test results
 */
async function queryTestResults(input: z.infer<typeof QueryTestResultsSchema>): Promise<string> {
  const { studentId, limit } = input;
  const data = getTestData();

  const student = data.students.find(s => s.studentId === studentId);
  if (!student) {
    throw new Error(`Student not found: ${studentId}`);
  }

  const tests = student.testHistory.slice(0, limit);

  const results = {
    student: {
      studentId: student.studentId,
      name: student.name
    },
    summary: {
      testCount: tests.length,
      averageScore: tests.length > 0 ? Math.round(tests.reduce((sum, test) => sum + test.score, 0) / tests.length) : 0,
      bestScore: tests.length > 0 ? Math.max(...tests.map(t => t.score)) : 0,
      mostRecentScore: tests.length > 0 ? (tests[0]?.score ?? 0) : 0
    },
    tests: tests.map(test => ({
      title: test.title,
      date: test.date,
      score: test.score,
      accuracy: `${Math.round((test.correct / test.total) * 100)}% (${test.correct}/${test.total})`
    }))
  };

  return JSON.stringify(results, null, 2);
}

// Tool definitions
export const parentAdvisorTools = [
  tool({
    name: 'query_student_profile',
    description: 'Get comprehensive student profile including performance, skills, and recommendations for parent advisory.',
    inputSchema: QueryStudentProfileSchema,
    callback: queryStudentProfile
  }),

  tool({
    name: 'query_test_results',
    description: 'Get detailed test results with trends and analysis. Helps parents understand their child\'s testing performance over time.',
    inputSchema: QueryTestResultsSchema,
    callback: queryTestResults
  })
];