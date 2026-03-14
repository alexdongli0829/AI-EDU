export interface User {
  id: string;
  email: string;
  name: string;
  role: 'parent' | 'student' | 'admin';
  createdAt: string;
}

export interface Student {
  id: string;
  userId: string;
  name: string;
  username: string;
  gradeLevel: number;
  dateOfBirth: string;
  parentId: string;
  createdAt: string;
  testsCompleted?: number;
}

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
  difficultyLevel: number;
  skillTags: string[];
}

export interface TestSession {
  sessionId: string;
  testId: string;
  testTitle: string;
  timeRemaining: number;
  currentQuestion: Question;
  questionNumber: number;
  totalQuestions: number;
  estimatedAbility: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}