/**
 * If/Else Node Executor Tests
 *
 * Minimal tests focusing on:
 * - Expression conditions: Custom logic (string operators, isEmpty, nested paths)
 * - Intent conditions: Message resolution and empty message handling
 *
 * Note: Basic operators (===, !==, >, <) test obvious JavaScript behavior.
 * Real integration tests for intent classification are in intent-classifier.integration.test.ts
 *
 * @module workflow/executors/__tests__/if-else.test
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { IfElseNodeConfig } from "@journey/schemas";
import type { NodeInput, WorkflowContext } from "../../types";
import { IfElseNodeExecutor } from "../logic/if-else";

// Mock the intent classifier
vi.mock("../../intent-classifier", () => ({
  classifyIntent: vi.fn(),
}));

import { classifyIntent } from "../../intent-classifier";
const mockClassifyIntent = vi.mocked(classifyIntent);

// =============================================================================
// TEST UTILITIES
// =============================================================================

function createMockLogger(): WorkflowContext["log"] {
  return {
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn().mockReturnThis(),
  };
}

function createMockContext(): WorkflowContext {
  return {
    orgId: "org-test",
    sessionId: "session-test",
    user: { id: "user-test" },
    log: createMockLogger(),
    settings: {
      maxExecutionTimeMs: 60000,
      nodeTimeoutMs: 30000,
    },
  };
}

function createMockInput(variables: Record<string, unknown> = {}, message?: string): NodeInput {
  return {
    message: message ?? "Test message",
    conversationHistory: [],
    variables,
    previousNodeOutputs: new Map(),
  };
}

// =============================================================================
// TESTS
// =============================================================================

describe("IfElseNodeExecutor", () => {
  const executor = new IfElseNodeExecutor();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===========================================================================
  // Expression Conditions - String Operators (custom logic worth testing)
  // ===========================================================================

  describe("expression conditions - string operators", () => {
    it("evaluates contains/startsWith/endsWith correctly", async () => {
      const context = createMockContext();

      // contains
      const containsConfig: IfElseNodeConfig = {
        conditionType: "expression",
        condition: { left: "text", operator: "contains", right: "hello" },
      };
      expect((await executor.execute(createMockInput({ text: "say hello world" }), containsConfig, context)).outHandle).toBe("yes");
      expect((await executor.execute(createMockInput({ text: "goodbye" }), containsConfig, context)).outHandle).toBe("no");

      // startsWith
      const startsWithConfig: IfElseNodeConfig = {
        conditionType: "expression",
        condition: { left: "name", operator: "startsWith", right: "John" },
      };
      expect((await executor.execute(createMockInput({ name: "John Doe" }), startsWithConfig, context)).outHandle).toBe("yes");
      expect((await executor.execute(createMockInput({ name: "Jane Doe" }), startsWithConfig, context)).outHandle).toBe("no");

      // endsWith
      const endsWithConfig: IfElseNodeConfig = {
        conditionType: "expression",
        condition: { left: "email", operator: "endsWith", right: "@example.com" },
      };
      expect((await executor.execute(createMockInput({ email: "user@example.com" }), endsWithConfig, context)).outHandle).toBe("yes");
      expect((await executor.execute(createMockInput({ email: "user@other.com" }), endsWithConfig, context)).outHandle).toBe("no");
    });

    it("evaluates regex matches correctly", async () => {
      const config: IfElseNodeConfig = {
        conditionType: "expression",
        condition: { left: "phone", operator: "matches", right: "^\\d{3}-\\d{3}-\\d{4}$" },
      };
      const context = createMockContext();

      expect((await executor.execute(createMockInput({ phone: "123-456-7890" }), config, context)).outHandle).toBe("yes");
      expect((await executor.execute(createMockInput({ phone: "1234567890" }), config, context)).outHandle).toBe("no");
    });

    it("handles invalid regex gracefully", async () => {
      const config: IfElseNodeConfig = {
        conditionType: "expression",
        condition: { left: "text", operator: "matches", right: "[invalid(" },
      };

      // Invalid regex should return false, not throw
      const result = await executor.execute(createMockInput({ text: "anything" }), config, createMockContext());
      expect(result.outHandle).toBe("no");
    });
  });

  // ===========================================================================
  // Expression Conditions - isEmpty/isNotEmpty (custom logic)
  // ===========================================================================

  describe("expression conditions - existence operators", () => {
    it("evaluates isEmpty for various types", async () => {
      const config: IfElseNodeConfig = {
        conditionType: "expression",
        condition: { left: "value", operator: "isEmpty" },
      };
      const context = createMockContext();

      expect((await executor.execute(createMockInput({ value: "" }), config, context)).outHandle).toBe("yes");
      expect((await executor.execute(createMockInput({ value: null }), config, context)).outHandle).toBe("yes");
      expect((await executor.execute(createMockInput({ value: undefined }), config, context)).outHandle).toBe("yes");
      expect((await executor.execute(createMockInput({ value: [] }), config, context)).outHandle).toBe("yes");
      expect((await executor.execute(createMockInput({ value: "text" }), config, context)).outHandle).toBe("no");
    });

    it("evaluates isNotEmpty for various types", async () => {
      const config: IfElseNodeConfig = {
        conditionType: "expression",
        condition: { left: "value", operator: "isNotEmpty" },
      };
      const context = createMockContext();

      expect((await executor.execute(createMockInput({ value: "text" }), config, context)).outHandle).toBe("yes");
      expect((await executor.execute(createMockInput({ value: [1, 2] }), config, context)).outHandle).toBe("yes");
      expect((await executor.execute(createMockInput({ value: "" }), config, context)).outHandle).toBe("no");
    });
  });

  // ===========================================================================
  // Expression Conditions - Nested Paths (custom logic)
  // ===========================================================================

  describe("expression conditions - nested paths", () => {
    it("evaluates nested and deeply nested variable paths", async () => {
      const context = createMockContext();

      // Nested path
      const nestedConfig: IfElseNodeConfig = {
        conditionType: "expression",
        condition: { left: "router_result.intent", operator: "===", right: "support" },
      };
      expect(
        (await executor.execute(createMockInput({ router_result: { intent: "support" } }), nestedConfig, context)).outHandle
      ).toBe("yes");

      // Deeply nested path
      const deepConfig: IfElseNodeConfig = {
        conditionType: "expression",
        condition: { left: "user.profile.settings.enabled", operator: "===", right: true },
      };
      expect(
        (await executor.execute(createMockInput({ user: { profile: { settings: { enabled: true } } } }), deepConfig, context)).outHandle
      ).toBe("yes");
    });

    it("handles missing nested paths gracefully", async () => {
      const config: IfElseNodeConfig = {
        conditionType: "expression",
        condition: { left: "user.profile.missing", operator: "===", right: "value" },
      };

      const result = await executor.execute(createMockInput({ user: { profile: {} } }), config, createMockContext());
      expect(result.outHandle).toBe("no");
    });
  });

  // ===========================================================================
  // Intent Conditions - Message Resolution (important edge case)
  // ===========================================================================

  describe("intent conditions - message resolution", () => {
    it("returns 'no' when message is empty", async () => {
      const config: IfElseNodeConfig = {
        conditionType: "intent",
        intent: { intents: ["support", "sales"], minConfidence: 0.7 },
      };

      const result = await executor.execute(createMockInput({}, ""), config, createMockContext());

      expect(result.outHandle).toBe("no");
      expect(result.metadata?.error).toContain("No message found");
      expect(mockClassifyIntent).not.toHaveBeenCalled();
    });

    it("gets message from variables.message when input.message is empty", async () => {
      mockClassifyIntent.mockResolvedValue({
        matched: true,
        intent: "sales",
        confidence: 0.9,
        reasoning: "User asking about pricing",
      });

      const config: IfElseNodeConfig = {
        conditionType: "intent",
        intent: { intents: ["support", "sales"], minConfidence: 0.7 },
      };

      const input: NodeInput = {
        message: "", // Empty - should fallback to variables.message
        conversationHistory: [],
        variables: { message: "What are your pricing plans?" },
        previousNodeOutputs: new Map(),
      };

      const result = await executor.execute(input, config, createMockContext());

      expect(result.outHandle).toBe("yes");
      expect(mockClassifyIntent).toHaveBeenCalledWith("What are your pricing plans?", ["support", "sales"], 0.7);
    });

    it("passes classification result to output correctly", async () => {
      mockClassifyIntent.mockResolvedValue({
        matched: true,
        intent: "support",
        confidence: 0.85,
        reasoning: "User is asking for help",
      });

      const config: IfElseNodeConfig = {
        conditionType: "intent",
        intent: { intents: ["support", "sales"], minConfidence: 0.7 },
      };

      const result = await executor.execute(createMockInput({}, "Help me"), config, createMockContext());

      expect(result.outHandle).toBe("yes");
      expect(result.metadata).toMatchObject({
        type: "intent",
        matchedIntent: "support",
        confidence: 0.85,
        result: true,
      });
    });
  });
});
