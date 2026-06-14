import { describe, it, expect, vi } from "vitest";
import { retry } from "../src/retry.js";
import { AbortError } from "../src/abort-error.js";

describe("retry", () => {
  it("returns immediately when the first attempt succeeds", async () => {
    const fn = vi.fn(async () => "ok");
    await expect(retry(fn)).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries until it succeeds", async () => {
    let calls = 0;
    const fn = vi.fn(async () => {
      calls++;
      if (calls < 3) throw new Error("fail");
      return "ok";
    });

    await expect(retry(fn, { delay: 0 })).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("rethrows the last error after exhausting attempts", async () => {
    const fn = vi.fn(async () => {
      throw new Error("always");
    });

    await expect(retry(fn, { attempts: 2, delay: 0 })).rejects.toThrow(
      "always",
    );
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("passes the 1-based attempt number to the callback", async () => {
    const seen: number[] = [];
    await retry(
      async (attempt) => {
        seen.push(attempt);
        if (attempt < 3) throw new Error("retry");
        return attempt;
      },
      { delay: 0 },
    );
    expect(seen).toEqual([1, 2, 3]);
  });

  it("stops early when shouldRetry returns false", async () => {
    const fn = vi.fn(async () => {
      throw new Error("fatal");
    });

    await expect(
      retry(fn, { attempts: 5, delay: 0, shouldRetry: () => false }),
    ).rejects.toThrow("fatal");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("invokes onRetry between attempts", async () => {
    const onRetry = vi.fn();
    let calls = 0;
    await retry(
      async () => {
        calls++;
        if (calls < 2) throw new Error("x");
        return "done";
      },
      { delay: 0, onRetry },
    );
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(expect.any(Error), 1, undefined);
  });

  it("passes the signal to shouldRetry and onRetry", async () => {
    const controller = new AbortController();
    const onRetry = vi.fn();
    const shouldRetry = vi.fn(() => true);
    let calls = 0;
    await retry(
      async () => {
        calls++;
        if (calls < 2) throw new Error("x");
        return "done";
      },
      { delay: 0, signal: controller.signal, onRetry, shouldRetry },
    );
    expect(shouldRetry).toHaveBeenCalledWith(
      expect.any(Error),
      1,
      controller.signal,
    );
    expect(onRetry).toHaveBeenCalledWith(
      expect.any(Error),
      1,
      controller.signal,
    );
  });

  it("stops without retrying when aborted during an async shouldRetry", async () => {
    const controller = new AbortController();
    const onRetry = vi.fn();
    const fn = vi.fn(async () => {
      throw new Error("fail");
    });
    const promise = retry(fn, {
      attempts: 5,
      delay: 1000,
      signal: controller.signal,
      onRetry,
      shouldRetry: () =>
        new Promise<boolean>((resolve) => {
          controller.abort();
          resolve(true);
        }),
    });
    await expect(promise).rejects.toBeInstanceOf(AbortError);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(onRetry).not.toHaveBeenCalled();
  });

  it("aborts a pending wait via signal", async () => {
    const controller = new AbortController();
    const promise = retry(
      async () => {
        throw new Error("fail");
      },
      { attempts: 5, delay: 1000, signal: controller.signal },
    );
    controller.abort();
    await expect(promise).rejects.toBeInstanceOf(AbortError);
  });

  it("rejects with RangeError when attempts < 1", async () => {
    await expect(retry(async () => 1, { attempts: 0 })).rejects.toBeInstanceOf(
      RangeError,
    );
  });

  it("interrupts an in-flight attempt that ignores the signal", async () => {
    const controller = new AbortController();
    // fn never settles on its own; only the abort can end the attempt.
    const promise = retry(() => new Promise<never>(() => {}), {
      delay: 0,
      signal: controller.signal,
    });
    controller.abort();
    await expect(promise).rejects.toBeInstanceOf(AbortError);
  });

  it("passes the abort signal to fn so it can cancel its own work", async () => {
    const controller = new AbortController();
    let sawAbort = false;
    const promise = retry(
      (_attempt, signal) =>
        new Promise<never>((_resolve, reject) => {
          signal?.addEventListener("abort", () => {
            sawAbort = true;
            reject(new AbortError());
          });
        }),
      { delay: 0, signal: controller.signal },
    );
    controller.abort();
    await expect(promise).rejects.toBeInstanceOf(AbortError);
    expect(sawAbort).toBe(true);
  });

  it("supports an async shouldRetry", async () => {
    const fn = vi.fn(async () => {
      throw new Error("nope");
    });
    await expect(
      retry(fn, {
        attempts: 5,
        delay: 0,
        shouldRetry: async (error) => (error as Error).message === "retryable",
      }),
    ).rejects.toThrow("nope");
    // async shouldRetry resolved false → stop after the first attempt.
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
