import { AbortError } from "./abort-error.js";

/**
 * Resolves after `ms` milliseconds. Pass an {@link AbortSignal} to cancel the
 * wait early — a cancelled sleep rejects with {@link AbortError} rather than
 * resolving, so it composes cleanly inside `try`/`catch`.
 *
 * @example
 * ```ts
 * await sleep(1000);
 *
 * // cancellable
 * const ac = new AbortController();
 * sleep(5000, ac.signal).catch(() => console.log("cancelled"));
 * ac.abort();
 * ```
 */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (Number.isNaN(ms) || ms < 0) {
    throw new RangeError("`ms` must be a non-negative number");
  }

  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new AbortError());
      return;
    }

    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    const onAbort = () => {
      clearTimeout(timer);
      reject(new AbortError());
    };

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
