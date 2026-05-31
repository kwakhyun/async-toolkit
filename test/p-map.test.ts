import { describe, it, expect } from "vitest";
import { pMap } from "../src/p-map.js";
import { AbortError } from "../src/abort-error.js";

const defer = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("pMap", () => {
  it("maps in input order", async () => {
    const result = await pMap([1, 2, 3], async (n) => n * 2);
    expect(result).toEqual([2, 4, 6]);
  });

  it("passes the index to the mapper", async () => {
    const result = await pMap(["a", "b"], (item, i) => `${i}:${item}`);
    expect(result).toEqual(["0:a", "1:b"]);
  });

  it("respects the concurrency limit", async () => {
    let running = 0;
    let peak = 0;
    await pMap(
      [1, 2, 3, 4, 5],
      async () => {
        running++;
        peak = Math.max(peak, running);
        await defer(10);
        running--;
      },
      { concurrency: 2 },
    );
    expect(peak).toBe(2);
  });

  it("rejects on the first error when stopOnError is true (default)", async () => {
    await expect(
      pMap([1, 2, 3], async (n) => {
        if (n === 2) throw new Error("boom");
        return n;
      }),
    ).rejects.toThrow("boom");
  });

  it("aggregates errors when stopOnError is false", async () => {
    let caught: AggregateError | undefined;
    try {
      await pMap(
        [1, 2, 3],
        async (n) => {
          if (n !== 2) throw new Error(`fail-${n}`);
          return n;
        },
        { stopOnError: false },
      );
    } catch (e) {
      caught = e as AggregateError;
    }

    expect(caught).toBeInstanceOf(AggregateError);
    expect(caught?.errors).toHaveLength(2);
  });

  it("handles an empty iterable", async () => {
    expect(await pMap([], async (n) => n)).toEqual([]);
  });

  it("stops starting queued mappers after the first error (stopOnError)", async () => {
    const started: number[] = [];
    await expect(
      pMap(
        [1, 2, 3, 4],
        async (n) => {
          started.push(n);
          if (n === 1) throw new Error("boom");
          await defer(20);
          return n;
        },
        { concurrency: 1 },
      ),
    ).rejects.toThrow("boom");
    // Item 1 runs first and throws; the queue is cleared, so 2–4 never start.
    expect(started).toEqual([1]);
  });

  it("rejects with AbortError when the signal aborts mid-map", async () => {
    const ac = new AbortController();
    const promise = pMap(
      [1, 2, 3],
      async () => {
        await new Promise<void>(() => {}); // never settles
        return 1;
      },
      { signal: ac.signal },
    );
    ac.abort();
    await expect(promise).rejects.toBeInstanceOf(AbortError);
  });

  it("rejects immediately when the signal is already aborted", async () => {
    const ac = new AbortController();
    ac.abort();
    await expect(
      pMap([1], async (n) => n, { signal: ac.signal }),
    ).rejects.toBeInstanceOf(AbortError);
  });
});
