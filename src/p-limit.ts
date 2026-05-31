export interface LimitFunction {
  /** Runs `fn` as soon as a concurrency slot is free and resolves with its result. */
  <T>(fn: () => Promise<T> | T): Promise<T>;
  /** Number of tasks currently running. */
  readonly activeCount: number;
  /** Number of tasks waiting for a free slot. */
  readonly pendingCount: number;
  /** Discards queued tasks that have not started yet. Running tasks are unaffected. */
  clearQueue(): void;
}

/**
 * Creates a function that runs at most `concurrency` async tasks at a time.
 * Extra tasks queue and start in order as slots free up.
 *
 * @example
 * ```ts
 * const limit = pLimit(2);
 * const results = await Promise.all(
 *   urls.map((url) => limit(() => fetch(url))),
 * );
 * ```
 */
export function pLimit(concurrency: number): LimitFunction {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new RangeError("`concurrency` must be a positive integer");
  }

  const queue: Array<() => void> = [];
  let activeCount = 0;

  const next = () => {
    activeCount--;
    if (queue.length > 0) {
      queue.shift()!();
    }
  };

  const run = async <T>(
    fn: () => Promise<T> | T,
    resolve: (value: T | Promise<T>) => void,
    reject: (reason?: unknown) => void,
  ) => {
    activeCount++;
    try {
      resolve(await fn());
    } catch (error) {
      reject(error);
    } finally {
      next();
    }
  };

  const limit = <T>(fn: () => Promise<T> | T): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const task = () => void run(fn, resolve, reject);
      if (activeCount < concurrency) {
        task();
      } else {
        queue.push(task);
      }
    });

  Object.defineProperties(limit, {
    activeCount: { get: () => activeCount },
    pendingCount: { get: () => queue.length },
    clearQueue: { value: () => void (queue.length = 0) },
  });

  return limit as LimitFunction;
}
