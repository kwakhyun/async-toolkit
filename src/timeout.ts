import { AbortError } from "./abort-error.js";

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
 * Pass an {@link AbortSignal} to reject early with {@link AbortError}; combine
 * it with a cancellable source (e.g. `fetch(url, { signal })`) to also stop the
 * underlying work.
 *
 * @example
 * ```ts
 * const data = await timeout(fetch(url), 5000);
 *
 * // cancel the wait (and the fetch) from outside
 * const ac = new AbortController();
 * const data = await timeout(fetch(url, { signal: ac.signal }), 5000, ac.signal);
 * ```
 */
export function timeout<T>(
  promise: Promise<T>,
  ms: number,
  signal?: AbortSignal,
): Promise<T> {
  if (Number.isNaN(ms) || ms < 0) {
    throw new RangeError("`ms` must be a non-negative number");
  }

  return new Promise<T>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new AbortError());
      return;
    }

    const onAbort = () => {
      clearTimeout(timer);
      reject(new AbortError());
    };

    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      reject(new TimeoutError(ms));
    }, ms);

    signal?.addEventListener("abort", onAbort, { once: true });

    promise.then(
      (value) => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
}
