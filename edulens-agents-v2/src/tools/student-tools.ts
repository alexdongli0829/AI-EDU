/**
 * Student Tutor Tools - Simplified version for compilation
 */

import { tool } from '@strands-agents/sdk';
import { z } from 'zod';
import { getTestData } from '../data/test-data.js';

// Zod schemas for tool inputs
const LoadQuestionContextSchema = z.object({
  questionId: z.string().min(1, 'Question ID is required'),
  studentId: z.string().min(1, 'Student ID is required')
});

const QueryStudentLevelSchema = z.object({
  studentId: z.string().min(1, 'Student ID is required')
});

/**
 * Load question context for tutoring session
 */
async function loadQuestionContext(input: z.infer<typeof LoadQuestionContextSchema>): Promise<string> {
  const { questionId, studentId } = input;
  const data = getTestData();

  // Find the question
  const question = data.questions.find(q => q.questionId === questionId);
  if (!question) {
    throw new Error(`Question not found: ${questionId}`);
  }

  // Find student
  const student = data.students.find(s => s.studentId === studentId);
  if (!student) {
    throw new Error(`Student not found: ${studentId}`);
  }

  const correctOption = question.options.find(o => o.isCorrect);

  const context = {
    question: {
      questionId: question.questionId,
      text: question.text,
      options: question.options.map(o => `${o.label}. ${o.text}`),
      correctAnswer: question.correctAnswer,
      correctAnswerText: correctOption?.text,
      explanation: question.explanation,
      skillTags: question.skillTags,
      difficulty: question.difficulty
    },
    student: {
      studentId,
      name: student.name,
      gradeLevel: student.gradeLevel
    },
    tutoring: {
      approach: 'Use Socratic method - guide with questions, don\'t give direct answers'
    }
  };

  return JSON.stringify(context, null, 2);
}

/**
 * Query student's current mastery level
 */
async function queryStudentLevel(input: z.infer<typeof QueryStudentLevelSchema>): Promise<string> {
  const { studentId } = input;
  const data = getTestData();

  const student = data.students.find(s => s.studentId === studentId);
  if (!student) {
    throw new Error(`Student not found: ${studentId}`);
  }

  const level = {
    student: {
      studentId: student.studentId,
      name: student.name,
      gradeLevel: student.gradeLevel,
      overallMastery: student.overallMastery
    },
    strengths: student.strengths,
    weaknesses: student.weaknesses,
    recentProgress: {
      testCount: student.testHistory.length,
      latestScore: student.testHistory[0]?.score || 0
    }
  };

  return JSON.stringify(level, null, 2);
}

// Tool definitions using Strands SDK
export const studentTutorTools = [
  tool({
    name: 'load_question_context',
    description: 'Load the question text, correct answer, and student\'s response for the current tutoring session.',
    inputSchema: LoadQuestionContextSchema,
    callback: loadQuestionContext
  }),

  tool({
    name: 'query_student_level',
    description: 'Get the student\'s current mastery level for skills, strengths, weaknesses, and recent progress.',
    inputSchema: QueryStudentLevelSchema,
    callback: queryStudentLevel
  })
];