import { pLimit } from "./p-limit.js";
import { AbortError } from "./abort-error.js";

export interface PMapOptions {
  /** Maximum number of mappers running at once. Default: `Infinity`. */
  concurrency?: number;
  /**
   * When `false`, all mappers settle before the returned promise rejects,
   * aggregating into an {@link AggregateError}. When `true` (default), it
   * rejects as soon as any mapper rejects, stops starting queued mappers, and
   * aborts the signal passed to in-flight mappers.
   */
  stopOnError?: boolean;
  /**
   * Abort the map early. Aborting rejects with {@link AbortError}, stops queued
   * mappers from starting, and aborts the signal handed to in-flight mappers so
   * they can cancel their own work.
   */
  signal?: AbortSignal;
}

/**
 * Maps over `items` with an async `mapper`, running at most `concurrency`
 * mappers concurrently. Results are returned in input order regardless of
 * which mapper settles first.
 *
 * Each mapper receives an {@link AbortSignal} as its third argument. That
 * signal aborts when the map is cancelled — via `options.signal`, or (with
 * `stopOnError`) when another mapper fails — so a mapper can stop its own work
 * (e.g. `fetch(url, { signal })`) instead of running to completion in vain.
 *
 * @example
 * ```ts
 * const bodies = await pMap(
 *   urls,
 *   (url, _i, signal) => fetch(url, { signal }).then((r) => r.text()),
 *   { concurrency: 4 },
 * );
 * ```
 */
export async function pMap<Item, Result>(
  items: Iterable<Item>,
  mapper: (
    item: Item,
    index: number,
    signal: AbortSignal,
  ) => Promise<Result> | Result,
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

  // Internal controller fans cancellation out to every running mapper. It fires
  // when the external signal aborts or, under stopOnError, on the first error.
  const controller = new AbortController();

  const results = new Array<Result>(list.length);
  // Sparse array indexed by input position so aggregated errors preserve input
  // order, matching the order-preserving guarantee of the results.
  const errors = new Array<unknown>(list.length);
  let errorCount = 0;

  const all = Promise.all(
    list.map((item, index) =>
      limit(async () => {
        if (controller.signal.aborted) {
          throw new AbortError();
        }
        try {
          results[index] = await mapper(item, index, controller.signal);
        } catch (error) {
          if (stopOnError) {
            controller.abort(); // cancel other in-flight mappers
            limit.clearQueue(); // and drop the ones not started yet
            throw error;
          }
          errors[index] = error;
          errorCount++;
        }
      }),
    ),
  );

  let onAbort: (() => void) | undefined;
  try {
    if (signal) {
      const aborted = new Promise<never>((_, reject) => {
        onAbort = () => {
          controller.abort();
          limit.clearQueue();
          reject(new AbortError());
        };
        signal.addEventListener("abort", onAbort, { once: true });
      });
      await Promise.race([all, aborted]);
    } else {
      await all;
    }
  } finally {
    if (onAbort) signal?.removeEventListener("abort", onAbort);
  }

  if (errorCount > 0) {
    // Drop the empty slots, keeping only the errors in input order.
    const collected = [...errors.keys()]
      .filter((i) => i in errors)
      .map((i) => errors[i]);
    throw new AggregateError(collected, `${errorCount} mapper(s) failed`);
  }

  return results;
}
