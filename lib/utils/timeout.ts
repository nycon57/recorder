/**
 * Timeout utility for async operations
 */

/**
 * Wraps an async function with a timeout
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage = 'Operation timed out'
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
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    backoffMultiplier?: number;
    shouldRetry?: (error: Error) => boolean;
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelayMs = 1000,
    maxDelayMs = 10000,
    backoffMultiplier = 2,
    shouldRetry = () => true,
  } = options;

  let lastError: Error | undefined;
  let delayMs = initialDelayMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Check if we should retry
      if (!shouldRetry(lastError)) {
        throw lastError;
      }

      // Don't delay on the last attempt
      if (attempt === maxAttempts) {
        break;
      }

      console.log(
        `Attempt ${attempt}/${maxAttempts} failed, retrying in ${delayMs}ms...`,
        lastError.message
      );

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delayMs));

      // Increase delay for next attempt
      delayMs = Math.min(delayMs * backoffMultiplier, maxDelayMs);
    }
  }

  throw lastError || new Error('All retry attempts failed');
}

/**
 * Run multiple promises in parallel with individual timeouts
 */
export async function parallelWithTimeouts<T>(
  tasks: Array<() => Promise<T>>,
  timeoutMs: number,
  maxConcurrency = Infinity
): Promise<Array<{ success: boolean; result?: T; error?: Error }>> {
  const results: Array<{ success: boolean; result?: T; error?: Error }> = [];

  // Process in batches if maxConcurrency is set
  for (let i = 0; i < tasks.length; i += maxConcurrency) {
    const batch = tasks.slice(i, i + maxConcurrency);

    const batchResults = await Promise.allSettled(
      batch.map((task) =>
        withTimeout(task(), timeoutMs, `Task timed out after ${timeoutMs}ms`)
      )
    );

    results.push(
      ...batchResults.map((result) => {
        if (result.status === 'fulfilled') {
          return { success: true, result: result.value };
        } else {
          return { success: false, error: result.reason };
        }
      })
    );
  }

  return results;
}