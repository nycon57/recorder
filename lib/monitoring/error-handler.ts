import { logger } from './logger';

/**
 * Custom application errors with additional context
 */
export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly context?: Record<string, any>;

  constructor(
    message: string,
    code: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    context?: Record<string, any>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.context = context;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Pre-defined application errors
 */
export class ValidationError extends AppError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'VALIDATION_ERROR', 400, true, context);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required', context?: Record<string, any>) {
    super(message, 'AUTHENTICATION_ERROR', 401, true, context);
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions', context?: Record<string, any>) {
    super(message, 'AUTHORIZATION_ERROR', 403, true, context);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, context?: Record<string, any>) {
    super(`${resource} not found`, 'NOT_FOUND', 404, true, context);
  }
}

export class RateLimitError extends AppError {
  constructor(retryAfter: number, context?: Record<string, any>) {
    super('Too many requests', 'RATE_LIMIT_EXCEEDED', 429, true, {
      ...context,
      retryAfter,
    });
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, message: string, context?: Record<string, any>) {
    super(`External service error: ${service} - ${message}`, 'EXTERNAL_SERVICE_ERROR', 502, true, {
      ...context,
      service,
    });
  }
}

/**
 * Global error handler
 */
export function handleError(error: Error, context?: Record<string, any>): void {
  if (error instanceof AppError) {
    // Log operational errors at appropriate level
    if (error.statusCode >= 500) {
      logger.error(error.message, error, { ...error.context, ...context });
    } else {
      logger.warn(error.message, { ...error.context, ...context });
    }
  } else {
    // Log unexpected errors
    logger.error('Unexpected error', error, context);

    // In production, send to error tracking service
    if (process.env.NODE_ENV === 'production') {
      // TODO: Send to Sentry/DataDog/etc
      // Sentry.captureException(error, { extra: context });
    }
  }
}

/**
 * Async error handler wrapper
 */
export function asyncHandler<T extends (...args: any[]) => Promise<any>>(
  fn: T
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  return async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      handleError(error as Error);
      throw error;
    }
  };
}

/**
 * Format error for API response
 */
export function formatErrorResponse(error: Error): {
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
  statusCode: number;
} {
  if (error instanceof AppError) {
    return {
      error: {
        code: error.code,
        message: error.message,
        details: error.context,
      },
      statusCode: error.statusCode,
    };
  }

  // Don't expose internal error details in production
  if (process.env.NODE_ENV === 'production') {
    return {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
      statusCode: 500,
    };
  }

  return {
    error: {
      code: 'INTERNAL_ERROR',
      message: error.message,
    },
    statusCode: 500,
  };
}
