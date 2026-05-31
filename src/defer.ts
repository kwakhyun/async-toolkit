/**
 * A promise whose `resolve` and `reject` are exposed for settling it from the
 * outside — useful for bridging event-based or callback APIs into `await`.
 */
export interface Deferred<T> {
  readonly promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
}

/**
 * Creates a {@link Deferred}: a promise plus its `resolve`/`reject` controls.
 *
 * @example
 * ```ts
 * const d = defer<string>();
 * emitter.once("ready", () => d.resolve("ok"));
 * emitter.once("error", (e) => d.reject(e));
 * const result = await d.promise;
 * ```
 */
export function defer<T = void>(): Deferred<T> {
  let resolve!: Deferred<T>["resolve"];
  let reject!: Deferred<T>["reject"];

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}
