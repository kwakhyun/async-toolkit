/** Largest delay `setTimeout` accepts before its 32-bit overflow. */
const MAX_DELAY = 2_147_483_647; // 2 ** 31 - 1

/**
 * Like `setTimeout`, but correct for delays beyond ~24.8 days (and `Infinity`).
 *
 * A raw `setTimeout` silently clamps any delay over {@link MAX_DELAY} — or
 * `Infinity` — down to `1`, firing almost immediately. This chains timers so the
 * callback runs after the full requested delay instead; an `Infinity` delay
 * simply never fires (the wait can still be ended by cancelling it).
 *
 * @returns A function that cancels the pending timer.
 */
export function setSafeTimeout(callback: () => void, ms: number): () => void {
  let timer: ReturnType<typeof setTimeout>;
  let remaining = ms;

  const schedule = () => {
    const step = Math.min(remaining, MAX_DELAY);
    remaining -= step;
    timer = setTimeout(() => {
      if (remaining > 0) {
        schedule();
      } else {
        callback();
      }
    }, step);
  };

  schedule();

  return () => clearTimeout(timer);
}
