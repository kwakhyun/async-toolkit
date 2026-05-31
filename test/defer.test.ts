import { describe, it, expect } from "vitest";
import { defer } from "../src/defer.js";

describe("defer", () => {
  it("resolves externally", async () => {
    const d = defer<number>();
    setTimeout(() => d.resolve(42), 0);
    await expect(d.promise).resolves.toBe(42);
  });

  it("rejects externally", async () => {
    const d = defer<number>();
    const boom = new Error("boom");
    setTimeout(() => d.reject(boom), 0);
    await expect(d.promise).rejects.toBe(boom);
  });

  it("defaults to a void deferred", async () => {
    const d = defer();
    d.resolve();
    await expect(d.promise).resolves.toBeUndefined();
  });
});
