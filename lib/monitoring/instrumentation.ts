/**
 * Request instrumentation middleware
 *
 * Tracks performance metrics and errors for all API requests.
 */

import { NextRequest, NextResponse } from 'next/server';
import { metrics, trackMetrics } from './metrics';
import { logger } from './logger';
import { handleError, formatErrorResponse, AppError } from './error-handler';

/**
 * Instrument an API handler with metrics and error tracking
 */
export function withInstrumentation<T extends NextRequest>(
  handler: (request: T) => Promise<Response>,
  options?: {
    name?: string;
  }
) {
  return async (request: T): Promise<Response> => {
    const start = Date.now();
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    const handlerName = options?.name || path;

    // Create logger with request context
    const requestLogger = logger.child({
      requestId: crypto.randomUUID(),
      method,
      path,
      userAgent: request.headers.get('user-agent') || 'unknown',
    });

    try {
      requestLogger.info('Request started');

      // Execute handler
      const response = await handler(request);
      const duration = Date.now() - start;

      // Track metrics
      trackMetrics.apiRequest(method, path, response.status, duration);

      requestLogger.info('Request completed', {
        statusCode: response.status,
        duration,
      });

      return response;
    } catch (error) {
      const duration = Date.now() - start;
      const err = error as Error;

      // Handle error
      handleError(err, { method, path });

      // Format error response
      const { error: errorBody, statusCode } = formatErrorResponse(err);

      // Track error metrics
      trackMetrics.apiRequest(method, path, statusCode, duration);

      requestLogger.error('Request failed', err, {
        statusCode,
        duration,
      });

      return NextResponse.json(errorBody, { status: statusCode });
    }
  };
}

/**
 * Instrument a function with metrics
 */
export async function instrument<T>(
  name: string,
  fn: () => Promise<T>,
  options?: {
    tags?: Record<string, string>;
  }
): Promise<T> {
  const timer = metrics.timer(name, options?.tags);
  try {
    const result = await fn();
    timer.end();
    return result;
  } catch (error) {
    timer.end();
    throw error;
  }
}
