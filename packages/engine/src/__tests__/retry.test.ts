import { describe, expect, it, vi } from "vitest";
import { withRetry } from "../utils";

describe("withRetry", () => {
  it("retries when the function throws and eventually succeeds", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("boom-1"))
      .mockRejectedValueOnce(new Error("boom-2"))
      .mockResolvedValue({ success: true, value: "ok" });

    const result = await withRetry(
      fn,
      (res) => res.success,
      {
        maxAttempts: 3,
        baseDelayMs: 0,
        maxDelayMs: 0,
        onError: () => ({ success: false, value: "error" }),
      }
    );

    expect(result.success).toBe(true);
    expect(result.value).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("returns the onError result when all attempts throw", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("boom"));

    const result = await withRetry(
      fn,
      (res) => res.success,
      {
        maxAttempts: 2,
        baseDelayMs: 0,
        maxDelayMs: 0,
        onError: () => ({ success: false, value: "fallback" }),
      }
    );

    expect(result.success).toBe(false);
    expect(result.value).toBe("fallback");
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
