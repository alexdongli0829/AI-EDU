/**
 * Local error utilities for test-engine.
 * Replaces the @edulens/common workspace package dependency so this service
 * is self-contained and deployable without a workspace package manager.
 */

import { APIGatewayProxyResult } from 'aws-lambda';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    public readonly code: string,
    statusCode: number,
    isOperational = true,
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(
      id ? `${resource} with id '${id}' not found` : `${resource} not found`,
      'NOT_FOUND',
      404,
    );
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 'CONFLICT', 409);
  }
}

export class SessionNotFoundError extends NotFoundError {
  constructor(sessionId: string) {
    super('Test session', sessionId);
  }
}

export class SessionAlreadyStartedError extends ConflictError {
  constructor(sessionId: string) {
    super(`Session ${sessionId} has already been started`);
  }
}

export class SessionAlreadyCompletedError extends ConflictError {
  constructor(sessionId: string) {
    super(`Session ${sessionId} has already been completed`);
  }
}

export class InvalidSessionStateError extends AppError {
  constructor(message: string) {
    super(message, 'INVALID_STATE', 422);
  }
}

export function formatErrorResponse(error: unknown): APIGatewayProxyResult {
  if (error instanceof AppError) {
    return {
      statusCode: error.statusCode,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: false, error: { code: error.code, message: error.message } }),
    };
  }
  console.error('Unexpected error:', error);
  return {
    statusCode: 500,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } }),
  };
}
