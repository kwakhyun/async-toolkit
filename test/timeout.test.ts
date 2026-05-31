import { describe, it, expect, vi, afterEach } from "vitest";
import { timeout, TimeoutError } from "../src/timeout.js";

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
});
