import { describe, it, expect } from "vitest";
import { to } from "../src/to.js";

describe("to", () => {
  it("returns [null, value] on success", async () => {
    const [err, data] = await to(Promise.resolve(42));
    expect(err).toBeNull();
    expect(data).toBe(42);
  });

  it("returns [error, null] on rejection", async () => {
    const boom = new Error("boom");
    const [err, data] = await to(Promise.reject(boom));
    expect(err).toBe(boom);
    expect(data).toBeNull();
  });

  it("supports a custom error type", async () => {
    const [err] = await to<number, string>(Promise.reject("nope"));
    expect(err).toBe("nope");
  });

  it("runs a thunk and returns [null, value] on success", async () => {
    const [err, data] = await to(() => 42);
    expect(err).toBeNull();
    expect(data).toBe(42);
  });

  it("runs an async thunk and returns [null, value] on success", async () => {
    const [err, data] = await to(async () => 42);
    expect(err).toBeNull();
    expect(data).toBe(42);
  });

  it("captures a synchronous throw from a thunk", async () => {
    const [err, data] = await to(() => {
      throw new Error("boom");
    });
    expect(err).toBeInstanceOf(Error);
    expect(data).toBeNull();
  });

  it("captures a rejected async thunk", async () => {
    const boom = new Error("boom");
    const [err, data] = await to(async () => {
      throw boom;
    });
    expect(err).toBe(boom);
    expect(data).toBeNull();
  });
});
