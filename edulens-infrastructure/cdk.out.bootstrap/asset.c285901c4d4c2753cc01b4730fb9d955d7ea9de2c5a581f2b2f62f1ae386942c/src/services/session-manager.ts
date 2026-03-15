/**
 * Session Manager
 * Core business logic for test session lifecycle management.
 */

import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { cacheGet, cacheSet, cacheDel, prisma } from '@edulens/database';
import {
  InvalidSessionStateError,
  NotFoundError,
  SessionAlreadyCompletedError,
  SessionAlreadyStartedError,
  SessionNotFoundError,
} from '@edulens/common';

const eventBridge = new EventBridgeClient({
  region: process.env.AWS_REGION || 'ap-southeast-2',
});

const SESSION_CACHE_TTL = 30; // seconds

export class SessionManager {
  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  async createSession(studentId: string, testId: string) {
    const student = await prisma.student.findUnique({ where: { id: studentId } });
    if (!student) throw new NotFoundError('Student', studentId);

    const test = await prisma.test.findUnique({
      where: { id: testId },
      include: { questions: { select: { id: true } } },
    });
    if (!test || !test.isActive) throw new NotFoundError('Test', testId);

    const existing = await prisma.testSession.findFirst({
      where: { studentId, status: { in: ['pending', 'in_progress'] } },
    });
    if (existing) throw new SessionAlreadyStartedError(existing.id);

    const session = await prisma.testSession.create({
      data: {
        studentId,
        testId,
        status: 'pending',
        timeRemaining: test.timeLimit,
        totalQuestions: test.questions.length,
        currentQuestionIndex: 0,
      },
    });

    return session;
  }

  async getSession(sessionId: string) {
    const cached = await cacheGet<any>(`session:${sessionId}`);
    if (cached) return cached;

    const session = await prisma.testSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new SessionNotFoundError(sessionId);

    await cacheSet(`session:${sessionId}`, session, SESSION_CACHE_TTL);
    return session;
  }

  async startSession(sessionId: string) {
    const session = await prisma.testSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new SessionNotFoundError(sessionId);

    if (session.status !== 'pending') {
      throw new InvalidSessionStateError(
        `Cannot start session ${sessionId}: current status is '${session.status}'`
      );
    }

    const updated = await prisma.testSession.update({
      where: { id: sessionId },
      data: { status: 'in_progress', startedAt: new Date() },
    });

    await cacheDel(`session:${sessionId}`);
    return updated;
  }

  async submitAnswer(
    sessionId: string,
    questionId: string,
    studentAnswer: string,
    timeSpent: number
  ) {
    const session = await prisma.testSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new SessionNotFoundError(sessionId);

    if (session.status !== 'in_progress') {
      throw new InvalidSessionStateError(
        `Cannot submit answer: session ${sessionId} is not in progress`
      );
    }

    const question = await prisma.question.findUnique({ where: { id: questionId } });
    if (!question) throw new NotFoundError('Question', questionId);

    // Idempotent: return existing response if already submitted
    const existing = await prisma.sessionResponse.findUnique({
      where: { sessionId_questionId: { sessionId, questionId } },
    });
    if (existing) {
      return { isCorrect: existing.isCorrect, responseId: existing.id };
    }

    const isCorrect = this._evaluateAnswer(question, studentAnswer);

    const response = await prisma.sessionResponse.create({
      data: { sessionId, questionId, studentAnswer, isCorrect, timeSpent },
    });

    // Advance question pointer
    await prisma.testSession.update({
      where: { id: sessionId },
      data: { currentQuestionIndex: { increment: 1 } },
    });

    await cacheDel(`session:${sessionId}`);
    return { isCorrect, responseId: response.id };
  }

  async completeSession(sessionId: string) {
    const session = await prisma.testSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new SessionNotFoundError(sessionId);

    if (session.status === 'completed') throw new SessionAlreadyCompletedError(sessionId);
    if (session.status !== 'in_progress') {
      throw new InvalidSessionStateError(
        `Cannot complete session ${sessionId} from status '${session.status}'`
      );
    }

    const responses = await prisma.sessionResponse.findMany({ where: { sessionId } });
    const correctCount = responses.filter((r) => r.isCorrect).length;
    const score =
      session.totalQuestions > 0
        ? Math.round((correctCount / session.totalQuestions) * 100)
        : 0;

    const updated = await prisma.testSession.update({
      where: { id: sessionId },
      data: { status: 'completed', score, completedAt: new Date() },
    });

    await cacheDel(`session:${sessionId}`);
    await this._publishTestCompleted(updated);

    return { session: updated, score };
  }

  async getResults(sessionId: string) {
    const session = await prisma.testSession.findUnique({
      where: { id: sessionId },
      include: {
        test: true,
        responses: { include: { question: true } },
      },
    });
    if (!session) throw new SessionNotFoundError(sessionId);

    const skillBreakdown: Record<string, { correct: number; total: number }> = {};
    const responses = session.responses.map((r) => {
      for (const tag of r.question.skillTags) {
        if (!skillBreakdown[tag]) skillBreakdown[tag] = { correct: 0, total: 0 };
        skillBreakdown[tag].total++;
        if (r.isCorrect) skillBreakdown[tag].correct++;
      }
      return {
        questionId: r.questionId,
        questionText: r.question.text,
        skillTags: r.question.skillTags,
        subject: r.question.subject,
        difficulty: r.question.difficulty,
        studentAnswer: r.studentAnswer,
        isCorrect: r.isCorrect,
        timeSpent: r.timeSpent,
        estimatedTime: r.question.estimatedTime,
      };
    });

    return {
      sessionId,
      testTitle: session.test.title,
      subject: session.test.subject,
      score: session.score,
      completedAt: session.completedAt,
      totalQuestions: session.totalQuestions,
      correctAnswers: responses.filter((r) => r.isCorrect).length,
      responses,
      skillBreakdown,
    };
  }

  async abandonSession(sessionId: string) {
    const session = await prisma.testSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new SessionNotFoundError(sessionId);

    const updated = await prisma.testSession.update({
      where: { id: sessionId },
      data: { status: 'abandoned' },
    });

    await cacheDel(`session:${sessionId}`);
    return updated;
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private _evaluateAnswer(question: any, studentAnswer: string): boolean {
    if (question.type === 'multiple_choice' && question.options) {
      const options: any[] = Array.isArray(question.options) ? question.options : [];
      const selected = options.find((o) => o.id === studentAnswer);
      return selected?.isCorrect === true;
    }
    if (question.correctAnswer) {
      return (
        studentAnswer.trim().toLowerCase() ===
        question.correctAnswer.trim().toLowerCase()
      );
    }
    return false;
  }

  private async _publishTestCompleted(session: any): Promise<void> {
    try {
      await eventBridge.send(
        new PutEventsCommand({
          Entries: [
            {
              EventBusName: process.env.EVENT_BUS_NAME || 'edulens-event-bus',
              Source: 'test-engine',
              DetailType: 'test_completed',
              Detail: JSON.stringify({
                sessionId: session.id,
                studentId: session.studentId,
                testId: session.testId,
                score: session.score,
                completedAt: session.completedAt,
              }),
            },
          ],
        })
      );
    } catch (error) {
      // Non-fatal — profile calculation can be triggered manually if needed
      console.error('Failed to publish test_completed event:', error);
    }
  }
}
