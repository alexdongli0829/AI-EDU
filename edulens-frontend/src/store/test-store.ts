/**
 * Test Store - Zustand store for test state management
 */

import { create } from 'zustand';
import { Test, TestSession, Question, TestResults, SubmitAnswerResponse, testApiClient } from '@/lib/test-api/client';

interface TestState {
  // Available tests
  tests: Test[];
  loading: boolean;

  // Current test session
  currentSession: TestSession | null;
  currentQuestion: Question | null;
  questionStartTime: number | null;
  answers: Array<{
    questionId: string;
    answer: string;
    timeSpent: number;
    isCorrect: boolean;
  }>;

  // Test completion
  testCompleted: boolean;
  finalResults: TestResults | null;

  // Actions
  loadTests: (filters?: { subject?: string; gradeLevel?: number }) => Promise<void>;
  startTest: (testId: string, studentId: string) => Promise<void>;
  submitAnswer: (answer: string) => Promise<SubmitAnswerResponse>;
  resetTest: () => void;
}

export const useTestStore = create<TestState>((set, get) => ({
  tests: [],
  loading: false,
  currentSession: null,
  currentQuestion: null,
  questionStartTime: null,
  answers: [],
  testCompleted: false,
  finalResults: null,

  loadTests: async (filters) => {
    set({ loading: true });
    try {
      const { tests } = await testApiClient.getTests(filters);
      set({ tests, loading: false });
    } catch (error) {
      console.error('Failed to load tests:', error);
      set({ loading: false });
    }
  },

  startTest: async (testId: string, studentId: string) => {
    set({ loading: true });
    try {
      const session = await testApiClient.startTestSession(testId, studentId);
      set({
        currentSession: session,
        currentQuestion: session.currentQuestion,
        questionStartTime: Date.now(),
        answers: [],
        testCompleted: false,
        finalResults: null,
        loading: false,
      });
    } catch (error) {
      console.error('Failed to start test:', error);
      set({ loading: false });
      throw error;
    }
  },

  submitAnswer: async (answer: string) => {
    const { currentSession, currentQuestion, questionStartTime } = get();

    if (!currentSession || !currentQuestion || !questionStartTime) {
      throw new Error('No active test session');
    }

    const timeSpent = Math.round((Date.now() - questionStartTime) / 1000);

    try {
      const response = await testApiClient.submitAnswer(
        currentSession.sessionId,
        currentQuestion.id,
        answer,
        timeSpent,
      );

      const newAnswer = {
        questionId: currentQuestion.id,
        answer,
        timeSpent,
        isCorrect: response.isCorrect,
      };

      const updatedAnswers = [...get().answers, newAnswer];

      if (response.testCompleted && response.finalResults) {
        set({
          answers: updatedAnswers,
          testCompleted: true,
          finalResults: response.finalResults,
          currentQuestion: null,
          questionStartTime: null,
        });
      } else if (response.nextQuestion) {
        set({
          answers: updatedAnswers,
          currentQuestion: response.nextQuestion,
          questionStartTime: Date.now(),
        });
      }

      return response;
    } catch (error) {
      console.error('Failed to submit answer:', error);
      throw error;
    }
  },

  resetTest: () => {
    set({
      currentSession: null,
      currentQuestion: null,
      questionStartTime: null,
      answers: [],
      testCompleted: false,
      finalResults: null,
    });
  },
}));
