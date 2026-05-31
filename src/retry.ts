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
  /**
   * Randomize each delay within `[0, current backoff]` (full jitter) to avoid
   * thundering herds, where the backoff is `delay * factor ** (attempt - 1)`
   * capped at `maxDelay`. Default: `false`.
   */
  jitter?: boolean;
  /**
   * Abort the retry sequence. Aborting rejects with {@link AbortError}, cancels
   * a pending backoff wait, and interrupts an in-flight attempt — the same
   * signal is passed to `fn` so it can cancel its own work.
   */
  signal?: AbortSignal;
  /** Called after each failed attempt, before the next one is scheduled. */
  onRetry?: (error: unknown, attempt: number) => void;
  /**
   * Return (or resolve to) `false` to stop retrying and rethrow immediately.
   * Default: always retry.
   */
  shouldRetry?: (error: unknown, attempt: number) => boolean | Promise<boolean>;
}

/**
 * Calls `fn` and retries it with exponential backoff if it throws or rejects.
 *
 * `fn` receives the 1-based attempt number and the {@link RetryOptions.signal}
 * (if any), so it can cancel its own work when the retry is aborted. After the
 * final attempt fails, the last error is rethrown.
 *
 * @example
 * ```ts
 * const data = await retry(
 *   (attempt, signal) => fetch(url, { signal }),
 *   {
 *     attempts: 5,
 *     delay: 200,
 *     shouldRetry: (err) => err instanceof NetworkError,
 *   },
 * );
 * ```
 */
export async function retry<T>(
  fn: (attempt: number, signal?: AbortSignal) => Promise<T> | T,
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
      return await attemptWithAbort(fn, attempt, signal);
    } catch (error) {
      lastError = error;

      // An abort wins outright — never retry past a cancellation.
      if (signal?.aborted) {
        throw error instanceof AbortError ? error : new AbortError();
      }

      const isLastAttempt = attempt === attempts;
      if (isLastAttempt || (await shouldRetry?.(error, attempt)) === false) {
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

/**
 * Runs one attempt, rejecting with {@link AbortError} the moment `signal`
 * aborts — even if `fn` ignores the signal and never settles on its own.
 */
function attemptWithAbort<T>(
  fn: (attempt: number, signal?: AbortSignal) => Promise<T> | T,
  attempt: number,
  signal: AbortSignal | undefined,
): Promise<T> {
  let result: Promise<T>;
  try {
    result = Promise.resolve(fn(attempt, signal));
  } catch (error) {
    return Promise.reject(error);
  }

  if (!signal) {
    return result;
  }

  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new AbortError());
    signal.addEventListener("abort", onAbort, { once: true });
    result.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
}
