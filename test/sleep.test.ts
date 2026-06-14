import { describe, it, expect, vi, afterEach } from "vitest";
import { sleep } from "../src/sleep.js";
import { AbortError } from "../src/abort-error.js";

afterEach(() => {
  vi.useRealTimers();
});

describe("sleep", () => {
  it("resolves after the given delay", async () => {
    vi.useFakeTimers();
    const done = vi.fn();
    const promise = sleep(100).then(done);
    expect(done).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(100);
    await promise;
    expect(done).toHaveBeenCalled();
  });

  it("rejects with AbortError when the signal aborts mid-wait", async () => {
    const ac = new AbortController();
    const promise = sleep(1000, ac.signal);
    ac.abort();
    await expect(promise).rejects.toBeInstanceOf(AbortError);
  });

  it("rejects immediately when the signal is already aborted", async () => {
    const ac = new AbortController();
    ac.abort();
    await expect(sleep(1000, ac.signal)).rejects.toBeInstanceOf(AbortError);
  });

  it("throws RangeError for a negative or NaN delay", () => {
    expect(() => sleep(-1)).toThrow(RangeError);
    expect(() => sleep(Number.NaN)).toThrow(RangeError);
  });

  it("honors delays beyond the 32-bit setTimeout limit instead of firing early", async () => {
    vi.useFakeTimers();
    const done = vi.fn();
    const ms = 2 ** 31 + 1000; // overflows a raw setTimeout (clamps to 1ms)
    const promise = sleep(ms).then(done);

    // A raw setTimeout would already have fired; the safe timer must not.
    await vi.advanceTimersByTimeAsync(2 ** 31 - 1);
    expect(done).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1001);
    await promise;
    expect(done).toHaveBeenCalled();
  });

  it("never resolves for an Infinity delay, but can still be aborted", async () => {
    vi.useFakeTimers();
    const ac = new AbortController();
    const done = vi.fn();
    const promise = sleep(Infinity, ac.signal).then(done, () => "aborted");

    await vi.advanceTimersByTimeAsync(2 ** 31);
    expect(done).not.toHaveBeenCalled();

    ac.abort();
    await expect(promise).resolves.toBe("aborted");
  });
});
