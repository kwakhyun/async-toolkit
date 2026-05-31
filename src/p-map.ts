import { pLimit } from "./p-limit.js";

export interface PMapOptions {
  /** Maximum number of mappers running at once. Default: `Infinity`. */
  concurrency?: number;
  /**
   * When `false`, all mappers settle before the returned promise rejects,
   * aggregating into an {@link AggregateError}. When `true` (default), it
   * rejects as soon as any mapper rejects.
   */
  stopOnError?: boolean;
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
  const { concurrency = Infinity, stopOnError = true } = options;
  const list = [...items];
  const limit = pLimit(
    Number.isFinite(concurrency) ? concurrency : Math.max(list.length, 1),
  );

  const results = new Array<Result>(list.length);
  const errors: unknown[] = [];

  await Promise.all(
    list.map((item, index) =>
      limit(async () => {
        try {
          results[index] = await mapper(item, index);
        } catch (error) {
          if (stopOnError) throw error;
          errors.push(error);
        }
      }),
    ),
  );

  if (errors.length > 0) {
    throw new AggregateError(errors, `${errors.length} mapper(s) failed`);
  }

  return results;
}
