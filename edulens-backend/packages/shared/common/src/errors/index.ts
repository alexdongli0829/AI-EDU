/**
 * Custom error classes for EduLens Backend
 */

import { ERROR_CODES, HTTP_STATUS } from '../constants';

export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: any;

  constructor(
    message: string,
    code: string,
    statusCode: number,
    isOperational = true,
    details?: any
  ) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;

    // Maintains proper stack trace for where error was thrown
    Error.captureStackTrace(this, this.constructor);
    Object.setPrototypeOf(this, AppError.prototype);
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      details: this.details,
    };
  }
}

// ==================== Authentication Errors ====================

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized', details?: any) {
    super(
      message,
      ERROR_CODES.AUTH_UNAUTHORIZED,
      HTTP_STATUS.UNAUTHORIZED,
      true,
      details
    );
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden', details?: any) {
    super(
      message,
      ERROR_CODES.AUTH_FORBIDDEN,
      HTTP_STATUS.FORBIDDEN,
      true,
      details
    );
  }
}

export class TokenExpiredError extends AppError {
  constructor(message = 'Token expired', details?: any) {
    super(
      message,
      ERROR_CODES.AUTH_TOKEN_EXPIRED,
      HTTP_STATUS.UNAUTHORIZED,
      true,
      details
    );
  }
}

export class InvalidCredentialsError extends AppError {
  constructor(message = 'Invalid credentials', details?: any) {
    super(
      message,
      ERROR_CODES.AUTH_INVALID_CREDENTIALS,
      HTTP_STATUS.UNAUTHORIZED,
      true,
      details
    );
  }
}

// ==================== Validation Errors ====================

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details?: any) {
    super(
      message,
      ERROR_CODES.VALIDATION_FAILED,
      HTTP_STATUS.BAD_REQUEST,
      true,
      details
    );
  }
}

export class InvalidInputError extends AppError {
  constructor(message = 'Invalid input', details?: any) {
    super(
      message,
      ERROR_CODES.INVALID_INPUT,
      HTTP_STATUS.BAD_REQUEST,
      true,
      details
    );
  }
}

// ==================== Resource Errors ====================

export class NotFoundError extends AppError {
  constructor(resource: string, identifier?: string, details?: any) {
    const message = identifier
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;

    super(
      message,
      ERROR_CODES.RESOURCE_NOT_FOUND,
      HTTP_STATUS.NOT_FOUND,
      true,
      details
    );
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource conflict', details?: any) {
    super(
      message,
      ERROR_CODES.RESOURCE_CONFLICT,
      HTTP_STATUS.CONFLICT,
      true,
      details
    );
  }
}

export class ResourceAlreadyExistsError extends AppError {
  constructor(resource: string, identifier?: string, details?: any) {
    const message = identifier
      ? `${resource} with identifier '${identifier}' already exists`
      : `${resource} already exists`;

    super(
      message,
      ERROR_CODES.RESOURCE_ALREADY_EXISTS,
      HTTP_STATUS.CONFLICT,
      true,
      details
    );
  }
}

// ==================== Test Session Errors ====================

export class SessionNotFoundError extends NotFoundError {
  constructor(sessionId: string) {
    super('Test session', sessionId);
    this.code = ERROR_CODES.SESSION_NOT_FOUND;
  }
}

export class SessionAlreadyStartedError extends ConflictError {
  constructor(sessionId: string) {
    super(`Session ${sessionId} has already been started`);
    this.code = ERROR_CODES.SESSION_ALREADY_STARTED;
  }
}

export class SessionAlreadyCompletedError extends ConflictError {
  constructor(sessionId: string) {
    super(`Session ${sessionId} has already been completed`);
    this.code = ERROR_CODES.SESSION_ALREADY_COMPLETED;
  }
}

export class SessionExpiredError extends AppError {
  constructor(sessionId: string) {
    super(
      `Session ${sessionId} has expired`,
      ERROR_CODES.SESSION_EXPIRED,
      HTTP_STATUS.GONE,
      true
    );
  }
}

export class InvalidSessionStateError extends AppError {
  constructor(message: string, details?: any) {
    super(
      message,
      ERROR_CODES.INVALID_SESSION_STATE,
      HTTP_STATUS.CONFLICT,
      true,
      details
    );
  }
}

// ==================== Chat Errors ====================

export class ChatSessionNotFoundError extends NotFoundError {
  constructor(sessionId: string) {
    super('Chat session', sessionId);
    this.code = ERROR_CODES.CHAT_SESSION_NOT_FOUND;
  }
}

export class ChatRateLimitError extends AppError {
  constructor(message = 'Rate limit exceeded', details?: any) {
    super(
      message,
      ERROR_CODES.CHAT_RATE_LIMIT_EXCEEDED,
      HTTP_STATUS.TOO_MANY_REQUESTS,
      true,
      details
    );
  }
}

export class AIServiceError extends AppError {
  constructor(message = 'AI service error', details?: any) {
    super(
      message,
      ERROR_CODES.AI_SERVICE_ERROR,
      HTTP_STATUS.BAD_GATEWAY,
      true,
      details
    );
  }
}

export class AITimeoutError extends AppError {
  constructor(message = 'AI request timeout', details?: any) {
    super(
      message,
      ERROR_CODES.AI_TIMEOUT,
      HTTP_STATUS.GATEWAY_TIMEOUT,
      true,
      details
    );
  }
}

// ==================== System Errors ====================

export class DatabaseError extends AppError {
  constructor(message = 'Database error', details?: any) {
    super(
      message,
      ERROR_CODES.DATABASE_ERROR,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      false,
      details
    );
  }
}

export class CacheError extends AppError {
  constructor(message = 'Cache error', details?: any) {
    super(
      message,
      ERROR_CODES.CACHE_ERROR,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      true,
      details
    );
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, message?: string, details?: any) {
    super(
      message || `External service error: ${service}`,
      ERROR_CODES.EXTERNAL_SERVICE_ERROR,
      HTTP_STATUS.BAD_GATEWAY,
      true,
      details
    );
  }
}

// ==================== Error Handler Utility ====================

export function isOperationalError(error: Error): boolean {
  if (error instanceof AppError) {
    return error.isOperational;
  }
  return false;
}

export function formatErrorResponse(error: Error) {
  if (error instanceof AppError) {
    return {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    };
  }

  // Unknown error - don't expose internal details
  return {
    success: false,
    error: {
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
      message: 'An unexpected error occurred',
    },
  };
}
