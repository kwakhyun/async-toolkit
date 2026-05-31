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
});
