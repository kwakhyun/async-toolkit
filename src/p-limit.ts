export interface LimitFunction {
  /** Runs `fn` as soon as a concurrency slot is free and resolves with its result. */
  <T>(fn: () => Promise<T> | T): Promise<T>;
  /** Number of tasks currently running. */
  readonly activeCount: number;
  /** Number of tasks waiting for a free slot. */
  readonly pendingCount: number;
  /**
   * Maximum number of tasks allowed to run at once. Assign to raise or lower
   * the limit on the fly — raising it immediately starts as many queued tasks
   * as now fit. Must be a positive integer.
   */
  concurrency: number;
  /**
   * Discards queued tasks that have not started yet. Running tasks are
   * unaffected.
   *
   * Pass a `reason` to reject the promises already returned for the discarded
   * tasks with it. With no argument they instead stay pending forever — settle
   * them yourself (e.g. race against an `AbortSignal`) if a caller might be
   * awaiting them.
   */
  clearQueue(reason?: unknown): void;
}

interface QueueEntry {
  start: () => void;
  reject: (reason?: unknown) => void;
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
  assertConcurrency(concurrency);

  const queue: QueueEntry[] = [];
  let concurrencyLimit = concurrency;
  let activeCount = 0;

  // Start queued tasks while there is spare capacity. Called whenever a slot
  // frees up (a task settles) or the limit is raised.
  const drain = () => {
    while (activeCount < concurrencyLimit && queue.length > 0) {
      queue.shift()!.start();
    }
  };

  const next = () => {
    activeCount--;
    drain();
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
      const start = () => void run(fn, resolve, reject);
      if (activeCount < concurrencyLimit) {
        start();
      } else {
        queue.push({ start, reject });
      }
    });

  Object.defineProperties(limit, {
    activeCount: { get: () => activeCount },
    pendingCount: { get: () => queue.length },
    concurrency: {
      get: () => concurrencyLimit,
      set: (value: number) => {
        assertConcurrency(value);
        concurrencyLimit = value;
        drain();
      },
    },
    clearQueue: {
      value: function (reason?: unknown) {
        if (arguments.length > 0) {
          for (const entry of queue) entry.reject(reason);
        }
        queue.length = 0;
      },
    },
  });

  return limit as LimitFunction;
}

function assertConcurrency(value: number): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError("`concurrency` must be a positive integer");
  }
}
