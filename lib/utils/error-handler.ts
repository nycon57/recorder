/**
 * Centralized Error Handling Utility
 *
 * Provides consistent error handling, retry logic, and user-friendly error messages
 * across the application.
 */

import { toast } from 'sonner';

/**
 * Standard error response from API
 */
export interface ApiErrorResponse {
  code: string;
  message: string;
  details?: any;
  requestId?: string;
}

/**
 * Enhanced error class with additional context
 */
export class AppError extends Error {
  code: string;
  details?: any;
  requestId?: string;
  statusCode?: number;

  constructor(
    message: string,
    code: string = 'UNKNOWN_ERROR',
    statusCode?: number,
    details?: any,
    requestId?: string
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.requestId = requestId;
  }
}

/**
 * Parse API error response
 */
export function parseApiError(error: any): AppError {
  // Already an AppError
  if (error instanceof AppError) {
    return error;
  }

  // API error response
  if (error.response) {
    const statusCode = error.response.status;
    const data = error.response.data;

    return new AppError(
      data?.message || 'An error occurred',
      data?.code || `HTTP_${statusCode}`,
      statusCode,
      data?.details,
      data?.requestId
    );
  }

  // Network error
  if (error.request) {
    return new AppError(
      'Network error. Please check your connection and try again.',
      'NETWORK_ERROR',
      0
    );
  }

  // Generic error
  return new AppError(
    error.message || 'An unexpected error occurred',
    'UNKNOWN_ERROR'
  );
}

/**
 * Get user-friendly error message
 */
export function getUserFriendlyMessage(error: AppError): string {
  const errorMessages: Record<string, string> = {
    // Auth errors
    UNAUTHORIZED: 'You need to be logged in to perform this action.',
    FORBIDDEN: 'You do not have permission to perform this action.',

    // Validation errors
    VALIDATION_ERROR: 'Please check your input and try again.',
    BAD_REQUEST: 'Invalid request. Please check your input.',

    // Resource errors
    NOT_FOUND: 'The requested resource was not found.',
    CONFLICT: 'This resource already exists.',

    // Rate limiting
    RATE_LIMIT_EXCEEDED: 'Too many requests. Please wait a moment and try again.',
    QUOTA_EXCEEDED: 'You have reached your quota limit. Please upgrade your plan.',

    // File upload errors
    FILE_TOO_LARGE: 'The file is too large. Please choose a smaller file.',
    INVALID_FILE_TYPE: 'This file type is not supported.',
    UPLOAD_FAILED: 'Failed to upload file. Please try again.',

    // Processing errors
    TRANSCRIPTION_FAILED: 'Failed to transcribe audio. Please try again.',
    PROCESSING_FAILED: 'Failed to process file. Please try again.',

    // Network errors
    NETWORK_ERROR: 'Network error. Please check your connection.',
    TIMEOUT: 'Request timed out. Please try again.',

    // Server errors
    INTERNAL_ERROR: 'An internal error occurred. Please try again later.',
    SERVICE_UNAVAILABLE: 'Service is temporarily unavailable. Please try again later.',
  };

  return errorMessages[error.code] || error.message || 'An unexpected error occurred';
}

/**
 * Get accepted file types list for error messages
 */
export function getAcceptedFileTypesMessage(): string {
  return 'Accepted formats: MP4, MOV, WEBM, AVI (video), MP3, WAV, M4A, OGG (audio), PDF, DOCX (documents), TXT, MD (text)';
}

/**
 * Get file size limit message for a content type
 */
export function getFileSizeLimitMessage(contentType: string): string {
  const limits: Record<string, string> = {
    video: '500 MB',
    recording: '500 MB',
    audio: '100 MB',
    document: '50 MB',
    text: '1 MB',
  };

  return `Maximum file size: ${limits[contentType] || '500 MB'}`;
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  shouldRetry?: (error: AppError) => boolean;
}

const defaultRetryConfig: Required<RetryConfig> = {
  maxAttempts: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffMultiplier: 2,
  shouldRetry: (error: AppError) => {
    // Retry on network errors and 5xx server errors
    return (
      error.code === 'NETWORK_ERROR' ||
      error.code === 'TIMEOUT' ||
      (error.statusCode !== undefined && error.statusCode >= 500)
    );
  },
};

/**
 * Exponential backoff with jitter
 */
function calculateDelay(attempt: number, config: Required<RetryConfig>): number {
  const exponentialDelay = config.initialDelay * Math.pow(config.backoffMultiplier, attempt - 1);
  const cappedDelay = Math.min(exponentialDelay, config.maxDelay);
  // Add jitter (±25%)
  const jitter = cappedDelay * (0.75 + Math.random() * 0.5);
  return Math.floor(jitter);
}

/**
 * Retry function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: RetryConfig = {}
): Promise<T> {
  const finalConfig = { ...defaultRetryConfig, ...config };
  let lastError: AppError | null = null;

  for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = parseApiError(error);

      // Don't retry if we shouldn't
      if (!finalConfig.shouldRetry(lastError)) {
        throw lastError;
      }

      // Don't retry on last attempt
      if (attempt === finalConfig.maxAttempts) {
        throw lastError;
      }

      // Wait before retrying
      const delay = calculateDelay(attempt, finalConfig);
      console.log(`[Retry] Attempt ${attempt} failed. Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Show error toast notification
 */
export function showErrorToast(error: AppError | Error | string, title?: string) {
  const appError = typeof error === 'string'
    ? new AppError(error)
    : error instanceof AppError
      ? error
      : parseApiError(error);

  const message = getUserFriendlyMessage(appError);

  toast.error(title || 'Error', {
    description: message,
    action: appError.requestId ? {
      label: 'Copy Request ID',
      onClick: () => {
        navigator.clipboard.writeText(appError.requestId!);
        toast.success('Request ID copied to clipboard');
      },
    } : undefined,
  });
}

/**
 * Log error with context (for debugging/monitoring)
 */
export function logError(error: AppError | Error, context?: Record<string, any>) {
  const appError = error instanceof AppError ? error : parseApiError(error);

  console.error('[Error]', {
    message: appError.message,
    code: appError.code,
    statusCode: appError.statusCode,
    requestId: appError.requestId,
    details: appError.details,
    context,
    stack: appError.stack,
  });

  // TODO: Send to error tracking service (e.g., Sentry)
  // Example:
  // if (window.Sentry) {
  //   window.Sentry.captureException(appError, {
  //     extra: { ...context, requestId: appError.requestId },
  //   });
  // }
}

/**
 * Handle API fetch with automatic error handling and retry
 */
export async function fetchWithRetry<T = any>(
  url: string,
  options?: RequestInit,
  retryConfig?: RetryConfig
): Promise<T> {
  return retryWithBackoff(async () => {
    try {
      const response = await fetch(url, options);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new AppError(
          errorData.message || `Request failed with status ${response.status}`,
          errorData.code || `HTTP_${response.status}`,
          response.status,
          errorData.details,
          errorData.requestId
        );
      }

      return await response.json();
    } catch (error: any) {
      // Network or parsing error
      if (error instanceof AppError) {
        throw error;
      }

      if (error.name === 'AbortError') {
        throw new AppError('Request was cancelled', 'ABORTED');
      }

      throw new AppError(
        error.message || 'Network error',
        'NETWORK_ERROR'
      );
    }
  }, retryConfig);
}

/**
 * Wrap async function with error handling
 */
export function withErrorHandling<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  options?: {
    onError?: (error: AppError) => void;
    showToast?: boolean;
    logError?: boolean;
  }
) {
  return async (...args: T): Promise<R | undefined> => {
    try {
      return await fn(...args);
    } catch (error) {
      const appError = error instanceof AppError ? error : parseApiError(error);

      // Log error
      if (options?.logError !== false) {
        logError(appError, { function: fn.name, args });
      }

      // Show toast
      if (options?.showToast !== false) {
        showErrorToast(appError);
      }

      // Custom error handler
      if (options?.onError) {
        options.onError(appError);
      }

      return undefined;
    }
  };
}
