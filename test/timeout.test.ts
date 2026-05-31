import { describe, it, expect, vi, afterEach } from "vitest";
import { timeout, TimeoutError } from "../src/timeout.js";
import { AbortError } from "../src/abort-error.js";

afterEach(() => {
  vi.useRealTimers();
});

describe("timeout", () => {
  it("resolves when the promise settles in time", async () => {
    await expect(timeout(Promise.resolve("ok"), 1000)).resolves.toBe("ok");
  });

  it("rejects with TimeoutError when the deadline passes", async () => {
    vi.useFakeTimers();
    const pending = new Promise<never>(() => {});
    const guarded = timeout(pending, 100);
    const assertion = expect(guarded).rejects.toBeInstanceOf(TimeoutError);
    await vi.advanceTimersByTimeAsync(100);
    await assertion;
  });

  it("propagates the original rejection", async () => {
    const boom = new Error("boom");
    await expect(timeout(Promise.reject(boom), 1000)).rejects.toBe(boom);
  });

  it("exposes the configured ms on the error", async () => {
    vi.useFakeTimers();
    const guarded = timeout(new Promise<never>(() => {}), 250).catch(
      (e) => e as TimeoutError,
    );
    await vi.advanceTimersByTimeAsync(250);
    const error = await guarded;
    expect(error.ms).toBe(250);
  });

  it("rejects with AbortError when the signal aborts mid-wait", async () => {
    const ac = new AbortController();
    const guarded = timeout(new Promise<never>(() => {}), 1000, ac.signal);
    ac.abort();
    await expect(guarded).rejects.toBeInstanceOf(AbortError);
  });

  it("rejects immediately when the signal is already aborted", async () => {
    const ac = new AbortController();
    ac.abort();
    await expect(
      timeout(Promise.resolve("x"), 1000, ac.signal),
    ).rejects.toBeInstanceOf(AbortError);
  });

  it("throws RangeError for a negative or NaN timeout", () => {
    expect(() => timeout(Promise.resolve(1), -1)).toThrow(RangeError);
    expect(() => timeout(Promise.resolve(1), Number.NaN)).toThrow(RangeError);
  });

  it("resolves with the factory result when it settles in time", async () => {
    await expect(timeout(() => Promise.resolve("ok"), 1000)).resolves.toBe(
      "ok",
    );
  });

  it("cancels the underlying work when the deadline passes (factory form)", async () => {
    vi.useFakeTimers();
    let aborted = false;
    const guarded = timeout((signal) => {
      signal.addEventListener("abort", () => {
        aborted = true;
      });
      return new Promise<never>(() => {});
    }, 100).catch((e) => e as Error);
    await vi.advanceTimersByTimeAsync(100);
    const error = await guarded;
    expect(error).toBeInstanceOf(TimeoutError);
    expect(aborted).toBe(true);
  });

  it("cancels the underlying work when the external signal aborts (factory form)", async () => {
    const ac = new AbortController();
    let aborted = false;
    const guarded = timeout(
      (signal) => {
        signal.addEventListener("abort", () => {
          aborted = true;
        });
        return new Promise<never>(() => {});
      },
      1000,
      ac.signal,
    ).catch((e) => e as Error);
    ac.abort();
    const error = await guarded;
    expect(error).toBeInstanceOf(AbortError);
    expect(aborted).toBe(true);
  });
});
