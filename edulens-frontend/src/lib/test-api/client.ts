/**
 * Test Engine API Client
 */

const TEST_API_URL = process.env.NEXT_PUBLIC_TEST_API || 'http://localhost:3002';

export interface Test {
  id: string;
  title: string;
  description: string;
  subject: string;
  gradeLevel: number;
  timeLimit: number;
  questionCount: number;
  createdAt: string;
}

export interface Question {
  id: string;
  type: string;
  text: string;
  options: string[];
  skillTags: string[];
}

export interface TestSession {
  sessionId: string;
  testId: string;
  testTitle: string;
  subject: string;
  timeRemaining: number;
  currentQuestion: Question;
  questionNumber: number;
  totalQuestions: number;
}

export interface TestResults {
  scaledScore: number;
  rawScore: number;
  totalItems: number;
  correctCount: number;
}

export interface SubmitAnswerResponse {
  success: boolean;
  isCorrect: boolean;
  testCompleted: boolean;
  sessionId: string;
  nextQuestion?: Question;
  questionNumber?: number;
  progress?: {
    answeredQuestions: number;
    totalQuestions: number;
  };
  finalResults?: TestResults;
}

export class TestApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = TEST_API_URL;
  }

  async getTests(filters?: { subject?: string; gradeLevel?: number }): Promise<{ tests: Test[] }> {
    const params = new URLSearchParams();
    if (filters?.subject) params.append('subject', filters.subject);
    if (filters?.gradeLevel) params.append('gradeLevel', filters.gradeLevel.toString());

    const response = await fetch(`${this.baseUrl}/tests?${params}`);
    if (!response.ok) throw new Error('Failed to fetch tests');
    return response.json();
  }

  async startTestSession(testId: string, studentId: string): Promise<TestSession> {
    const response = await fetch(`${this.baseUrl}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ testId, studentId }),
    });

    if (!response.ok) throw new Error('Failed to start test session');
    return response.json();
  }

  async submitAnswer(
    sessionId: string,
    questionId: string,
    answer: string,
    timeSpent: number,
  ): Promise<SubmitAnswerResponse> {
    const response = await fetch(`${this.baseUrl}/sessions/${sessionId}/answers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId, answer, timeSpent }),
    });

    if (!response.ok) throw new Error('Failed to submit answer');
    return response.json();
  }
}

export const testApiClient = new TestApiClient();
