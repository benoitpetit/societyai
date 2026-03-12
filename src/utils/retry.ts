import { RetryOptions } from '../core/config';
import { getLogger } from '../observability/logger';
import { isAbortError, wrapError } from '../core/errors';

/**
 * Default retry options
 */
export function defaultRetryOptions(): RetryOptions {
  return {
    maxRetries: 3,
    initialBackoff: 500,
    maxBackoff: 10000,
    backoffFactor: 1.5,
    jitter: true,
  };
}

/**
 * Executes a function with retry logic and exponential backoff.
 * @param fn - The function to execute
 * @param options - Retry options
 * @param signal - Optional cancellation signal
 * @returns The result of the function
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: Partial<RetryOptions>,
  signal?: AbortSignal
): Promise<T> {
  const opts = { ...defaultRetryOptions(), ...options };
  const logger = getLogger();

  let retryCount = 0;
  let backoff = opts.initialBackoff;
  let lastError: Error | null = null;

  while (retryCount <= opts.maxRetries) {
    // Check if the operation has been cancelled
    if (signal?.aborted) {
      throw new Error('Operation cancelled');
    }

    try {
      // Log the retry attempt if this is not the first try
      if (retryCount > 0) {
        logger.info(`Retry ${retryCount}/${opts.maxRetries} after error: ${lastError?.message}`);
      }

      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Do not retry on cancellation errors
      if (isAbortError(lastError)) {
        throw lastError;
      }

      // Last attempt reached
      if (retryCount >= opts.maxRetries) {
        logger.error(`Max retries reached (${opts.maxRetries}). Last error: ${lastError.message}`);
        throw wrapError(lastError, 'Maximum number of retries reached');
      }

      // Calculate backoff for the next attempt
      let nextBackoff = backoff;
      if (opts.jitter) {
        // Add ±20% random variation
        const jitterFactor = 0.8 + Math.random() * 0.4; // between 0.8 and 1.2
        nextBackoff = Math.floor(backoff * jitterFactor);
      }

      // Wait before retrying
      await sleep(nextBackoff, signal);

      // Increment counter and increase backoff
      retryCount++;
      backoff = Math.min(opts.maxBackoff, Math.floor(backoff * opts.backoffFactor));
    }
  }

  // Should never reach this point
  throw lastError || new Error('Unknown retry error');
}

/**
 * Utility function to wait for a given duration.
 * @param ms - Wait time in milliseconds
 * @param signal - Optional cancellation signal
 */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Operation cancelled'));
      return;
    }

    const timeout = setTimeout(resolve, ms);

    if (signal) {
      const abortHandler = (): void => {
        clearTimeout(timeout);
        reject(new Error('Operation cancelled'));
      };
      signal.addEventListener('abort', abortHandler, { once: true });
    }
  });
}
