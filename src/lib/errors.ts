import type { ErrorResponse } from '@/types';

export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
  }

  toJSON(): ErrorResponse {
    return {
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
      },
    };
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('VALIDATION_ERROR', message, 400, details);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super('AUTHENTICATION_ERROR', message, 401);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Access denied') {
    super('AUTHORIZATION_ERROR', message, 403);
    this.name = 'AuthorizationError';
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Rate limit exceeded. Try again in a few seconds.') {
    super('RATE_LIMIT_EXCEEDED', message, 429);
    this.name = 'RateLimitError';
  }
}

export class ServerError extends AppError {
  constructor(message = 'Internal server error', details?: Record<string, unknown>) {
    super('SERVER_ERROR', message, 500, details);
    this.name = 'ServerError';
  }
}

export function errorResponse(error: unknown): { body: ErrorResponse; status: number } {
  if (error instanceof AppError) {
    return { body: error.toJSON(), status: error.statusCode };
  }

  console.error('Unhandled error:', error);
  const serverError = new ServerError();
  return { body: serverError.toJSON(), status: 500 };
}
