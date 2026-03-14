/**
 * Type definitions for Auth Service
 */

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: 'student' | 'parent' | 'admin';
    createdAt: string;
  };
  student?: {
    id: string;
    userId: string;
    gradeLevel: number;
    dateOfBirth: string;
    parentId?: string;
    createdAt: string;
  };
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  role: 'student' | 'parent';
  gradeLevel?: number;
  dateOfBirth?: string;
}

export interface RegisterResponse {
  success: boolean;
  message: string;
  userId: string;
}

export interface ErrorResponse {
  success: false;
  error: string;
  statusCode: number;
}
