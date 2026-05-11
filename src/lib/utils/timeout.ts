/**
 * Timeout utility for async operations
 */

import { mapBatchesSequentially } from './async';

/**
 * Wraps an async function with a timeout
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage = 'Operation timed out',
): Promise<T> {
  const timeout = new Promise<never>((_, reject) => {
    const id = setTimeout(() => {
      clearTimeout(id);
      reject(new Error(errorMessage));
    }, timeoutMs);
  });

  return Promise.race([promise, timeout]);
}

/**
 * Retry an async function with exponential backoff
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    backoffMultiplier?: number;
    shouldRetry?: (error: Error) => boolean;
  } = {},
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelayMs = 1000,
    maxDelayMs = 10000,
    backoffMultiplier = 2,
    shouldRetry = () => true,
  } = options;

  const runAttempt = async (attempt: number, delayMs: number): Promise<T> => {
    try {
      return await fn();
    } catch (error) {
      const lastError = error as Error;

      // Check if we should retry
      if (!shouldRetry(lastError)) {
        throw lastError;
      }

      // Don't delay on the last attempt
      if (attempt === maxAttempts) {
        throw lastError;
      }

      console.log(
        `Attempt ${attempt}/${maxAttempts} failed, retrying in ${delayMs}ms...`,
        lastError.message,
      );

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delayMs));

      // Increase delay for next attempt
      const nextDelayMs = Math.min(delayMs * backoffMultiplier, maxDelayMs);
      return runAttempt(attempt + 1, nextDelayMs);
    }
  };

  return runAttempt(1, initialDelayMs);
}

/**
 * Run multiple promises in parallel with individual timeouts
 */
async function parallelWithTimeouts<T>(
  tasks: Array<() => Promise<T>>,
  timeoutMs: number,
  maxConcurrency = Infinity,
): Promise<Array<{ success: boolean; result?: T; error?: Error }>> {
  const normalizeResults = (batchResults: PromiseSettledResult<T>[]) =>
    batchResults.map((result) => {
      if (result.status === 'fulfilled') {
        return { success: true, result: result.value };
      }
      return { success: false, error: result.reason };
    });

  if (!Number.isFinite(maxConcurrency)) {
    return Promise.allSettled(
      tasks.map((task) =>
        withTimeout(task(), timeoutMs, `Task timed out after ${timeoutMs}ms`),
      ),
    ).then(normalizeResults);
  }

  return mapBatchesSequentially(tasks, maxConcurrency, (batch) =>
    Promise.allSettled(
      batch.map((task) =>
        withTimeout(task(), timeoutMs, `Task timed out after ${timeoutMs}ms`),
      ),
    ).then(normalizeResults),
  );
}
