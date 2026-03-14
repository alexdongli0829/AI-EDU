/**
 * Unit Tests: Session Manager Service
 */

import { SessionManager } from '../../src/services/session-manager';
import { prisma } from '@edulens/database';
import { NotFoundError, SessionAlreadyStartedError } from '@edulens/common';

// Mock Prisma
jest.mock('@edulens/database', () => ({
  prisma: {
    student: {
      findUnique: jest.fn(),
    },
    test: {
      findUnique: jest.fn(),
    },
    testSession: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    sessionResponse: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    question: {
      findUnique: jest.fn(),
    },
  },
  cacheGet: jest.fn(),
  cacheSet: jest.fn(),
  cacheDel: jest.fn(),
}));

describe('SessionManager', () => {
  let sessionManager: SessionManager;

  beforeEach(() => {
    sessionManager = new SessionManager();
    jest.clearAllMocks();
  });

  describe('createSession', () => {
    it('should create a new test session successfully', async () => {
      const studentId = 'student-123';
      const testId = 'test-456';

      // Mock student exists
      (prisma.student.findUnique as jest.Mock).mockResolvedValue({
        id: studentId,
        userId: 'user-123',
      });

      // Mock test exists and is active
      (prisma.test.findUnique as jest.Mock).mockResolvedValue({
        id: testId,
        title: 'Math Test',
        timeLimit: 3600,
        isActive: true,
        questions: [
          { id: 'q1' },
          { id: 'q2' },
          { id: 'q3' },
        ],
      });

      // Mock no existing session
      (prisma.testSession.findFirst as jest.Mock).mockResolvedValue(null);

      // Mock session creation
      (prisma.testSession.create as jest.Mock).mockResolvedValue({
        id: 'session-789',
        studentId,
        testId,
        status: 'pending',
        timeRemaining: 3600,
        totalQuestions: 3,
        currentQuestionIndex: 0,
        createdAt: new Date(),
      });

      const session = await sessionManager.createSession(studentId, testId);

      expect(session.id).toBe('session-789');
      expect(session.status).toBe('pending');
      expect(session.totalQuestions).toBe(3);
      expect(prisma.testSession.create).toHaveBeenCalledWith({
        data: {
          studentId,
          testId,
          status: 'pending',
          timeRemaining: 3600,
          totalQuestions: 3,
          currentQuestionIndex: 0,
        },
      });
    });

    it('should throw NotFoundError if student does not exist', async () => {
      (prisma.student.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        sessionManager.createSession('invalid-student', 'test-456')
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError if test does not exist', async () => {
      (prisma.student.findUnique as jest.Mock).mockResolvedValue({
        id: 'student-123',
      });
      (prisma.test.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        sessionManager.createSession('student-123', 'invalid-test')
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw SessionAlreadyStartedError if active session exists', async () => {
      (prisma.student.findUnique as jest.Mock).mockResolvedValue({
        id: 'student-123',
      });
      (prisma.test.findUnique as jest.Mock).mockResolvedValue({
        id: 'test-456',
        isActive: true,
        questions: [],
      });
      (prisma.testSession.findFirst as jest.Mock).mockResolvedValue({
        id: 'existing-session',
        status: 'in_progress',
      });

      await expect(
        sessionManager.createSession('student-123', 'test-456')
      ).rejects.toThrow(SessionAlreadyStartedError);
    });
  });

  describe('startSession', () => {
    it('should start a pending session', async () => {
      const sessionId = 'session-123';

      (prisma.testSession.findUnique as jest.Mock).mockResolvedValue({
        id: sessionId,
        status: 'pending',
      });

      (prisma.testSession.update as jest.Mock).mockResolvedValue({
        id: sessionId,
        status: 'in_progress',
        startedAt: new Date(),
      });

      const session = await sessionManager.startSession(sessionId);

      expect(session.status).toBe('in_progress');
      expect(session.startedAt).toBeDefined();
    });
  });

  describe('submitAnswer', () => {
    it('should submit answer and evaluate correctness', async () => {
      const sessionId = 'session-123';
      const questionId = 'question-456';
      const studentAnswer = 'option-a';

      // Mock session
      (prisma.testSession.findUnique as jest.Mock).mockResolvedValue({
        id: sessionId,
        status: 'in_progress',
        currentQuestionIndex: 0,
      });

      // Mock question
      (prisma.question.findUnique as jest.Mock).mockResolvedValue({
        id: questionId,
        type: 'multiple_choice',
        options: [
          { id: 'option-a', text: 'Answer A', isCorrect: true },
          { id: 'option-b', text: 'Answer B', isCorrect: false },
        ],
      });

      // Mock no existing response
      (prisma.sessionResponse.findUnique as jest.Mock).mockResolvedValue(null);

      // Mock response creation
      (prisma.sessionResponse.create as jest.Mock).mockResolvedValue({
        id: 'response-789',
        sessionId,
        questionId,
        studentAnswer,
        isCorrect: true,
        timeSpent: 60,
      });

      const result = await sessionManager.submitAnswer(
        sessionId,
        questionId,
        studentAnswer,
        60
      );

      expect(result.isCorrect).toBe(true);
      expect(prisma.sessionResponse.create).toHaveBeenCalled();
    });
  });

  describe('completeSession', () => {
    it('should complete session and calculate score', async () => {
      const sessionId = 'session-123';

      (prisma.testSession.findUnique as jest.Mock).mockResolvedValue({
        id: sessionId,
        status: 'in_progress',
      });

      (prisma.sessionResponse.findMany as jest.Mock).mockResolvedValue([
        { id: 'r1', isCorrect: true },
        { id: 'r2', isCorrect: true },
        { id: 'r3', isCorrect: false },
      ]);

      (prisma.testSession.update as jest.Mock).mockResolvedValue({
        id: sessionId,
        status: 'completed',
        score: 67, // 2/3 = 67%
        completedAt: new Date(),
      });

      const result = await sessionManager.completeSession(sessionId);

      expect(result.score).toBe(67);
      expect(result.session.status).toBe('completed');
    });
  });
});
