import { describe, it, expect } from "vitest";
import { pLimit } from "../src/p-limit.js";

const defer = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("pLimit", () => {
  it("never exceeds the concurrency limit", async () => {
    const limit = pLimit(2);
    let running = 0;
    let peak = 0;

    const task = () =>
      limit(async () => {
        running++;
        peak = Math.max(peak, running);
        await defer(10);
        running--;
      });

    await Promise.all(Array.from({ length: 6 }, task));
    expect(peak).toBe(2);
  });

  it("resolves with each task's value", async () => {
    const limit = pLimit(1);
    const results = await Promise.all([
      limit(async () => 1),
      limit(async () => 2),
      limit(async () => 3),
    ]);
    expect(results).toEqual([1, 2, 3]);
  });

  it("propagates rejections without blocking the queue", async () => {
    const limit = pLimit(1);
    const failing = limit(async () => {
      throw new Error("boom");
    });
    const after = limit(async () => "ok");

    await expect(failing).rejects.toThrow("boom");
    await expect(after).resolves.toBe("ok");
  });

  it("tracks activeCount and pendingCount", async () => {
    const limit = pLimit(1);
    limit(() => defer(20));
    const queued = limit(() => defer(20));

    expect(limit.activeCount).toBe(1);
    expect(limit.pendingCount).toBe(1);
    await queued;
    expect(limit.activeCount).toBe(0);
    expect(limit.pendingCount).toBe(0);
  });

  it("clearQueue drops not-yet-started tasks", async () => {
    const limit = pLimit(1);
    limit(() => defer(20));
    limit(() => defer(20));
    expect(limit.pendingCount).toBe(1);
    limit.clearQueue();
    expect(limit.pendingCount).toBe(0);
  });

  it("throws for an invalid concurrency", () => {
    expect(() => pLimit(0)).toThrow(RangeError);
    expect(() => pLimit(1.5)).toThrow(RangeError);
  });
});
