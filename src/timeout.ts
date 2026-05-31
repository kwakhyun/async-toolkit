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
 * milliseconds. This form receives an already-started promise, so the work
 * keeps running after the timeout — use it to bound latency, not to free
 * resources. Pass an {@link AbortSignal} to reject early with {@link AbortError}.
 *
 * @example
 * ```ts
 * const data = await timeout(fetch(url), 5000);
 * ```
 */
export function timeout<T>(
  promise: Promise<T>,
  ms: number,
  signal?: AbortSignal,
): Promise<T>;
/**
 * Runs `fn(signal)` and **actually cancels it** if `ms` elapses (or `signal`
 * aborts) by aborting the {@link AbortSignal} handed to `fn`. Wire that signal
 * into a cancellable source (e.g. `fetch(url, { signal })`) to stop the
 * underlying work and free resources, not just stop waiting for it.
 *
 * Rejects with {@link TimeoutError} on timeout, or {@link AbortError} if the
 * external `signal` aborts first.
 *
 * @example
 * ```ts
 * // the fetch is aborted when the 5s deadline passes
 * const data = await timeout((signal) => fetch(url, { signal }), 5000);
 * ```
 */
export function timeout<T>(
  fn: (signal: AbortSignal) => Promise<T> | T,
  ms: number,
  signal?: AbortSignal,
): Promise<T>;
export function timeout<T>(
  input: Promise<T> | ((signal: AbortSignal) => Promise<T> | T),
  ms: number,
  signal?: AbortSignal,
): Promise<T> {
  if (Number.isNaN(ms) || ms < 0) {
    throw new RangeError("`ms` must be a non-negative number");
  }

  const isFactory = typeof input === "function";

  return new Promise<T>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new AbortError());
      return;
    }

    let settled = false;
    // Only the factory form can cancel the underlying work.
    const controller = isFactory ? new AbortController() : undefined;

    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    };

    const onAbort = () => {
      if (settled) return;
      settled = true;
      controller?.abort();
      cleanup();
      reject(new AbortError());
    };

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      controller?.abort();
      cleanup();
      reject(new TimeoutError(ms));
    }, ms);

    signal?.addEventListener("abort", onAbort, { once: true });

    let work: Promise<T>;
    if (isFactory) {
      try {
        work = Promise.resolve(input(controller!.signal));
      } catch (error) {
        settled = true;
        cleanup();
        reject(error);
        return;
      }
    } else {
      work = input;
    }

    work.then(
      (value) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(value);
      },
      (error) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(error);
      },
    );
  });
}
