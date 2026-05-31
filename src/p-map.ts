import { pLimit } from "./p-limit.js";
import { AbortError } from "./abort-error.js";

export interface PMapOptions {
  /** Maximum number of mappers running at once. Default: `Infinity`. */
  concurrency?: number;
  /**
   * When `false`, all mappers settle before the returned promise rejects,
   * aggregating into an {@link AggregateError}. When `true` (default), it
   * rejects as soon as any mapper rejects and no further queued mappers start.
   */
  stopOnError?: boolean;
  /**
   * Abort the map early. Aborting rejects with {@link AbortError} and stops
   * queued mappers from starting; already-running mappers cannot be cancelled.
   */
  signal?: AbortSignal;
}

/**
 * Maps over `items` with an async `mapper`, running at most `concurrency`
 * mappers concurrently. Results are returned in input order regardless of
 * which mapper settles first.
 *
 * @example
 * ```ts
 * const bodies = await pMap(urls, (url) => fetch(url).then((r) => r.text()), {
 *   concurrency: 4,
 * });
 * ```
 */
export async function pMap<Item, Result>(
  items: Iterable<Item>,
  mapper: (item: Item, index: number) => Promise<Result> | Result,
  options: PMapOptions = {},
): Promise<Result[]> {
  const { concurrency = Infinity, stopOnError = true, signal } = options;

  if (signal?.aborted) {
    throw new AbortError();
  }

  const list = [...items];
  const limit = pLimit(
    Number.isFinite(concurrency) ? concurrency : Math.max(list.length, 1),
  );

  const results = new Array<Result>(list.length);
  const errors: unknown[] = [];

  const all = Promise.all(
    list.map((item, index) =>
      limit(async () => {
        if (signal?.aborted) {
          throw new AbortError();
        }
        try {
          results[index] = await mapper(item, index);
        } catch (error) {
          if (stopOnError) {
            // Drop queued mappers that haven't started — no point doing work
            // whose result is about to be discarded by the rejection below.
            limit.clearQueue();
            throw error;
          }
          errors.push(error);
        }
      }),
    ),
  );

  if (signal) {
    let onAbort!: () => void;
    const aborted = new Promise<never>((_, reject) => {
      onAbort = () => {
        limit.clearQueue();
        reject(new AbortError());
      };
      signal.addEventListener("abort", onAbort, { once: true });
    });
    try {
      await Promise.race([all, aborted]);
    } finally {
      signal.removeEventListener("abort", onAbort);
    }
  } else {
    await all;
  }

  if (errors.length > 0) {
    throw new AggregateError(errors, `${errors.length} mapper(s) failed`);
  }

  return results;
}
