/**
 * A Go-style result tuple: either an error or a value, never both.
 *
 * - On success: `[null, value]`
 * - On failure: `[error, null]`
 */
export type Result<T, E = unknown> = [E, null] | [null, T];

/**
 * Wraps a promise and resolves to a `[error, data]` tuple instead of throwing,
 * letting you handle errors without `try`/`catch`.
 *
 * @example
 * ```ts
 * const [err, user] = await to(fetchUser(id));
 * if (err) return handle(err);
 * console.log(user.name); // narrowed to non-null
 * ```
 */
export function to<T, E = unknown>(promise: Promise<T>): Promise<Result<T, E>>;
/**
 * Wraps a function and resolves to a `[error, data]` tuple instead of throwing.
 * Unlike the promise form, this also captures synchronous throws from `fn`, so
 * it works for non-async code too.
 *
 * @example
 * ```ts
 * const [err, config] = await to(() => JSON.parse(raw));
 * if (err) return useDefaults();
 * ```
 */
export function to<T, E = unknown>(
  fn: () => Promise<T> | T,
): Promise<Result<T, E>>;
export async function to<T, E = unknown>(
  input: Promise<T> | (() => Promise<T> | T),
): Promise<Result<T, E>> {
  try {
    const data = await (typeof input === "function" ? input() : input);
    return [null, data];
  } catch (error) {
    return [error as E, null];
  }
}
