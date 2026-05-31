/**
 * Raised when an {@link AbortSignal} aborts an operation
 * (e.g. a pending {@link sleep} or {@link retry} wait).
 */
export class AbortError extends Error {
  constructor(message = "The operation was aborted") {
    super(message);
    this.name = "AbortError";
  }
}
