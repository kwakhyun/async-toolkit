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
  const errors: unknown[] = [];

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
          errors.push(error);
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

  if (errors.length > 0) {
    throw new AggregateError(errors, `${errors.length} mapper(s) failed`);
  }

  return results;
}
