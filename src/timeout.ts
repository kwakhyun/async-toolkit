/**
 * Error thrown when a {@link timeout} elapses before the wrapped promise settles.
 */
export class TimeoutError extends Error {
  readonly ms: number;

  constructor(ms: number) {
    super(`Operation timed out after ${ms}ms`);
    this.name = "TimeoutError";
    this.ms = ms;
  }
}

/**
 * Rejects with a {@link TimeoutError} if `promise` does not settle within `ms`
 * milliseconds. The original promise keeps running — there is no way to cancel
 * an already-started promise — so use this for bounding latency, not for
 * freeing resources.
 *
 * @example
 * ```ts
 * const data = await timeout(fetch(url), 5000);
 * ```
 */
export function timeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(ms)), ms);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
