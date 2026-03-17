/**
 * EduLens tools for Student Tutor agent — TypeScript implementation.
 */

import { tool } from '@strands-agents/sdk';
import { MOCK_STUDENT, MOCK_QUESTION } from './mock-data.js';

/**
 * Load the question text, the correct answer, and the student's wrong answer for the current tutoring session.
 */
export function loadQuestionContext(questionId: string): string {
  const q = MOCK_QUESTION;
  const correctOption = q.options.find(o => o.isCorrect);
  const studentOption = q.options.find(o => o.label === q.studentAnswer);

  return JSON.stringify({
    questionId: q.questionId,
    questionText: q.text,
    options: q.options.map(o => `${o.label}. ${o.text}`),
    correctAnswer: q.correctAnswer,
    correctAnswerText: correctOption?.text || null,
    explanation: q.explanation,
    studentAnswer: q.studentAnswer,
    studentAnswerText: studentOption?.text || null,
    studentTimeSpent: `${q.studentTimeSpent} seconds (expected ${q.estimatedTime}s)`,
    skillTags: q.skillTags,
    difficulty: q.difficulty,
  }, null, 2);
}

/**
 * Get the student's current overall mastery level and mastery for skills relevant to the current question.
 */
export function queryStudentLevel(studentId: string): string {
  const relevantSkills = [];

  for (const tag of MOCK_QUESTION.skillTags) {
    const parts = tag.split('.');
    if (parts.length === 2) {
      const [subject, skill] = parts;
      const breakdown = MOCK_STUDENT.skillBreakdown[subject] || {};
      const mastery = breakdown[skill];
      relevantSkills.push({
        tag,
        mastery: mastery !== undefined ? `${(mastery * 100).toFixed(0)}%` : 'unknown',
      });
    }
  }

  return JSON.stringify({
    studentName: MOCK_STUDENT.name,
    overallMastery: `${(MOCK_STUDENT.overallMastery * 100).toFixed(0)}%`,
    relevantSkills,
  }, null, 2);
}

/**
 * Record whether the student demonstrated understanding of the concept during this tutoring exchange.
 */
export function recordUnderstanding(
  studentId: string,
  questionId: string,
  understood: boolean,
  notes = ''
): string {
  // In production, this would write to AgentCore Memory
  return JSON.stringify({
    recorded: true,
    studentId,
    questionId,
    understood,
    notes: notes || null,
  }, null, 2);
}

// Tool definitions for Strands SDK using tool() factory
export const studentTutorTools = [
  tool({
    name: 'load_question_context',
    description: 'Load the question text, the correct answer, and the student\'s wrong answer for the current tutoring session.',
    inputSchema: {
      type: 'object',
      properties: {
        questionId: {
          type: 'string',
          description: 'The question ID to load.',
        },
      },
      required: ['questionId'],
    },
    callback: (input: any) => loadQuestionContext(input.questionId),
  }),
  tool({
    name: 'query_student_level',
    description: 'Get the student\'s current overall mastery level and mastery for skills relevant to the current question.',
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
    callback: (input: any) => queryStudentLevel(input.studentId),
  }),
  tool({
    name: 'record_understanding',
    description: 'Record whether the student demonstrated understanding of the concept during this tutoring exchange.',
    inputSchema: {
      type: 'object',
      properties: {
        studentId: {
          type: 'string',
          description: 'The student ID.',
        },
        questionId: {
          type: 'string',
          description: 'The question ID.',
        },
        understood: {
          type: 'boolean',
          description: 'Whether the student demonstrated understanding.',
        },
        notes: {
          type: 'string',
          description: 'Optional notes about the student\'s understanding.',
          default: '',
        },
      },
      required: ['studentId', 'questionId', 'understood'],
    },
    callback: (input: any) => recordUnderstanding(input.studentId, input.questionId, input.understood, input.notes),
  }),
];