/**
 * Common validation utilities using Zod
 */

import { z } from 'zod';
import {
  QuestionType,
  Subject,
  Difficulty,
  UserRole,
  ChatRole,
  MessageRole,
} from '../types/models';

// ==================== Common Schemas ====================

export const emailSchema = z.string().email('Invalid email address');

export const uuidSchema = z.string().uuid('Invalid UUID format');

export const positiveIntSchema = z.number().int().positive('Must be a positive integer');

export const nonNegativeIntSchema = z
  .number()
  .int()
  .nonnegative('Must be a non-negative integer');

// ==================== User & Auth Schemas ====================

export const userRoleSchema = z.nativeEnum(UserRole);

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const createUserSchema = z.object({
  email: emailSchema,
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required'),
  role: userRoleSchema,
});

// ==================== Student Schemas ====================

export const createStudentSchema = z.object({
  userId: uuidSchema,
  grade: z.number().int().min(1).max(12, 'Grade must be between 1 and 12'),
  dateOfBirth: z.coerce.date(),
  parentId: uuidSchema,
});

// ==================== Question Schemas ====================

export const questionTypeSchema = z.nativeEnum(QuestionType);
export const subjectSchema = z.nativeEnum(Subject);
export const difficultySchema = z.nativeEnum(Difficulty);

export const questionOptionSchema = z.object({
  id: z.string(),
  text: z.string().min(1, 'Option text is required'),
  isCorrect: z.boolean().optional(),
});

export const createQuestionSchema = z.object({
  testId: uuidSchema,
  type: questionTypeSchema,
  subject: subjectSchema,
  difficulty: difficultySchema,
  text: z.string().min(10, 'Question text must be at least 10 characters'),
  options: z.array(questionOptionSchema).optional(),
  correctAnswer: z.string().optional(),
  rubric: z.string().optional(),
  skillTags: z.array(z.string()).min(1, 'At least one skill tag is required'),
  estimatedTime: positiveIntSchema,
  order: nonNegativeIntSchema,
});

// ==================== Test Session Schemas ====================

export const createTestSessionSchema = z.object({
  studentId: uuidSchema,
  testId: uuidSchema,
});

export const submitAnswerSchema = z.object({
  questionId: uuidSchema,
  studentAnswer: z.string().min(1, 'Answer cannot be empty'),
  timeSpent: nonNegativeIntSchema,
});

// ==================== Chat Schemas ====================

export const chatRoleSchema = z.nativeEnum(ChatRole);
export const messageRoleSchema = z.nativeEnum(MessageRole);

export const createChatSessionSchema = z.object({
  studentId: uuidSchema,
  role: chatRoleSchema,
});

export const sendChatMessageSchema = z.object({
  content: z
    .string()
    .min(1, 'Message cannot be empty')
    .max(2000, 'Message too long (max 2000 characters)'),
});

// ==================== Pagination Schema ====================

export const paginationSchema = z.object({
  page: positiveIntSchema.default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});

// ==================== Validation Helper ====================

export function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}

export function validateSafe<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: z.ZodError } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return { success: false, errors: result.error };
}
