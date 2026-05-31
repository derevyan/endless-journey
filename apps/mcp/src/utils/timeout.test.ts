import { describe, it, expect, vi, afterEach } from "vitest";
import { withTimeout } from "./timeout";

describe("withTimeout", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns result when promise resolves before timeout", async () => {
    const result = await withTimeout(Promise.resolve("success"), 1000, "test operation");
    expect(result).toBe("success");
  });

  it("throws error when timeout exceeded", async () => {
    const slowPromise = new Promise((resolve) => {
      setTimeout(resolve, 100);
    });

    await expect(withTimeout(slowPromise, 10, "slow operation")).rejects.toThrow(
      "slow operation timed out after 10ms"
    );
  });

  it("clears timeout when promise resolves successfully", async () => {
    const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");

    await withTimeout(Promise.resolve("success"), 1000, "test");

    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it("clears timeout when promise rejects", async () => {
    const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");

    await expect(withTimeout(Promise.reject(new Error("failed")), 1000, "test")).rejects.toThrow(
      "failed"
    );

    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it("preserves original error when promise rejects before timeout", async () => {
    const originalError = new Error("original error");
    await expect(withTimeout(Promise.reject(originalError), 1000, "test")).rejects.toThrow(
      "original error"
    );
  });
});
