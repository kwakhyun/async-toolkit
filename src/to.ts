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
export async function to<T, E = unknown>(
  promise: Promise<T>,
): Promise<Result<T, E>> {
  try {
    const data = await promise;
    return [null, data];
  } catch (error) {
    return [error as E, null];
  }
}
