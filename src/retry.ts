import { AbortError } from "./abort-error.js";
import { sleep } from "./sleep.js";

export interface RetryOptions {
  /** Total number of attempts, including the first. Default: `3`. */
  attempts?: number;
  /** Base delay before the first retry, in milliseconds. Default: `100`. */
  delay?: number;
  /** Multiplier applied to the delay after each failed attempt. Default: `2`. */
  factor?: number;
  /** Upper bound for the computed delay, in milliseconds. Default: `Infinity`. */
  maxDelay?: number;
  /** Randomize each delay within `[0, delay]` to avoid thundering herds. Default: `false`. */
  jitter?: boolean;
  /** Abort the retry sequence early. A pending wait rejects with {@link AbortError}. */
  signal?: AbortSignal;
  /** Called after each failed attempt, before the next one is scheduled. */
  onRetry?: (error: unknown, attempt: number) => void;
  /** Return `false` to stop retrying and rethrow immediately. Default: always retry. */
  shouldRetry?: (error: unknown, attempt: number) => boolean;
}

/**
 * Calls `fn` and retries it with exponential backoff if it throws or rejects.
 *
 * The callback receives the 1-based attempt number. After the final attempt
 * fails, the last error is rethrown.
 *
 * @example
 * ```ts
 * const data = await retry(() => fetchFlaky(), {
 *   attempts: 5,
 *   delay: 200,
 *   shouldRetry: (err) => err instanceof NetworkError,
 * });
 * ```
 */
export async function retry<T>(
  fn: (attempt: number) => Promise<T> | T,
  options: RetryOptions = {},
): Promise<T> {
  const {
    attempts = 3,
    delay = 100,
    factor = 2,
    maxDelay = Infinity,
    jitter = false,
    signal,
    onRetry,
    shouldRetry,
  } = options;

  if (attempts < 1) {
    throw new RangeError("`attempts` must be at least 1");
  }

  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    if (signal?.aborted) {
      throw new AbortError();
    }

    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;

      const isLastAttempt = attempt === attempts;
      if (isLastAttempt || shouldRetry?.(error, attempt) === false) {
        throw error;
      }

      onRetry?.(error, attempt);

      const backoff = Math.min(delay * factor ** (attempt - 1), maxDelay);
      const waitMs = jitter ? Math.random() * backoff : backoff;
      await sleep(waitMs, signal);
    }
  }

  // Unreachable: the loop either returns or throws, but satisfies the compiler.
  throw lastError;
}
