/**
 * Agent Types Tests
 *
 * Tests for critical helper functions:
 * - ensureToolCallId: Generates stable IDs when missing (P0-3 fix verification)
 * - defaultToolRetryConfig: Correct retry behavior
 */

import { describe, it, expect, vi } from "vitest";
import { ensureToolCallId, defaultToolRetryConfig } from "../agent-types";

describe("ensureToolCallId()", () => {
  it("should return existing ID when provided", () => {
    const toolCall = { id: "existing-id-123", name: "test_tool" };
    const result = ensureToolCallId(toolCall);
    expect(result).toBe("existing-id-123");
  });

  it("should generate ID when id is undefined", () => {
    const toolCall = { name: "test_tool" } as { id?: string; name: string };
    const result = ensureToolCallId(toolCall);

    expect(result).toMatch(/^tool_test_tool_\d+_[a-z0-9]+$/);
  });

  it("should generate ID when id is empty string", () => {
    const toolCall = { id: "", name: "my_tool" };
    const result = ensureToolCallId(toolCall);

    expect(result).toMatch(/^tool_my_tool_\d+_[a-z0-9]+$/);
  });

  it("should generate ID when id is whitespace only", () => {
    const toolCall = { id: "   ", name: "search_tool" };
    const result = ensureToolCallId(toolCall);

    expect(result).toMatch(/^tool_search_tool_\d+_[a-z0-9]+$/);
  });

  it("should generate unique IDs for different calls", () => {
    const toolCall = { name: "test_tool" } as { id?: string; name: string };

    const id1 = ensureToolCallId(toolCall);
    // Small delay to ensure different timestamps
    const id2 = ensureToolCallId(toolCall);

    // IDs should be different (random component)
    // Note: There's a tiny chance they could match if called in same ms with same random
    // In practice this is extremely unlikely
    expect(id1).not.toBe(id2);
  });

  it("should include tool name in generated ID", () => {
    const toolCall1 = { name: "save_memory" } as { id?: string; name: string };
    const toolCall2 = { name: "send_message" } as { id?: string; name: string };

    const id1 = ensureToolCallId(toolCall1);
    const id2 = ensureToolCallId(toolCall2);

    expect(id1).toContain("save_memory");
    expect(id2).toContain("send_message");
  });
});

describe("defaultToolRetryConfig", () => {
  it("should have expected default values", () => {
    expect(defaultToolRetryConfig.maxRetries).toBe(2);
    expect(defaultToolRetryConfig.initialDelayMs).toBe(500);
    expect(defaultToolRetryConfig.backoffFactor).toBe(2.0);
  });

  it("should have retryOn function defined", () => {
    expect(typeof defaultToolRetryConfig.retryOn).toBe("function");
  });

  it("should retry on network errors", () => {
    const retryOn = defaultToolRetryConfig.retryOn!;

    expect(retryOn(new Error("ECONNRESET"))).toBe(true);
    expect(retryOn(new Error("ECONNREFUSED"))).toBe(true);
    expect(retryOn(new Error("ETIMEDOUT"))).toBe(true);
    expect(retryOn(new Error("Connection timeout"))).toBe(true);
    expect(retryOn(new Error("Network error occurred"))).toBe(true);
    expect(retryOn(new Error("Socket closed"))).toBe(true);
  });

  it("should not retry on non-network errors", () => {
    const retryOn = defaultToolRetryConfig.retryOn!;

    expect(retryOn(new Error("Invalid argument"))).toBe(false);
    expect(retryOn(new Error("Permission denied"))).toBe(false);
    expect(retryOn(new Error("Not found"))).toBe(false);
    expect(retryOn(new Error("Validation failed"))).toBe(false);
  });
});
