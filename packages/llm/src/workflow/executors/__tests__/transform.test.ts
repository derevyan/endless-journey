/**
 * Transform Node Executor Tests
 *
 * Tests for data transformation operations.
 *
 * @module workflow/executors/__tests__/transform.test
 */

import { describe, it, expect, vi } from "vitest";
import type { TransformNodeConfig } from "@journey/schemas";
import type { NodeInput, WorkflowContext } from "../../types";
import { TransformNodeExecutor } from "../data/transform";

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

function createMockInput(variables: Record<string, unknown> = {}): NodeInput {
  return {
    message: "Test message",
    conversationHistory: [],
    variables,
    previousNodeOutputs: new Map(),
  };
}

// =============================================================================
// TESTS
// =============================================================================

describe("TransformNodeExecutor", () => {
  const executor = new TransformNodeExecutor();

  describe("extractJson operation", () => {
    it("extracts JSON from a string", async () => {
      const config: TransformNodeConfig = {
        operation: {
          type: "extractJson",
          sourceVariable: "rawJson",
        },
        outputVariable: "parsed",
      };

      const input = createMockInput({
        rawJson: '{"intent": "support", "confidence": 0.95}',
      });
      const context = createMockContext();

      const result = await executor.execute(input, config, context);

      expect(result.data?.parsed).toEqual({
        intent: "support",
        confidence: 0.95,
      });
    });

    it("extracts JSON from markdown code block", async () => {
      const config: TransformNodeConfig = {
        operation: {
          type: "extractJson",
          sourceVariable: "response",
        },
        outputVariable: "data",
      };

      const input = createMockInput({
        response: 'Here is the result:\n```json\n{"status": "ok"}\n```\nDone.',
      });
      const context = createMockContext();

      const result = await executor.execute(input, config, context);

      expect(result.data?.data).toEqual({ status: "ok" });
    });

    it("extracts raw JSON object from text", async () => {
      const config: TransformNodeConfig = {
        operation: {
          type: "extractJson",
          sourceVariable: "text",
        },
        outputVariable: "obj",
      };

      const input = createMockInput({
        text: 'The result is {"value": 42} as expected',
      });
      const context = createMockContext();

      const result = await executor.execute(input, config, context);

      expect(result.data?.obj).toEqual({ value: 42 });
    });

    it("returns original value if already an object", async () => {
      const config: TransformNodeConfig = {
        operation: {
          type: "extractJson",
          sourceVariable: "data",
        },
        outputVariable: "result",
      };

      const originalObject = { foo: "bar" };
      const input = createMockInput({ data: originalObject });
      const context = createMockContext();

      const result = await executor.execute(input, config, context);

      expect(result.data?.result).toEqual(originalObject);
    });
  });

  describe("pick operation", () => {
    it("picks specified fields from an object", async () => {
      const config: TransformNodeConfig = {
        operation: {
          type: "pick",
          sourceVariable: "user",
          fields: ["name", "email"],
        },
        outputVariable: "contact",
      };

      const input = createMockInput({
        user: {
          id: "123",
          name: "John",
          email: "john@example.com",
          password: "secret",
        },
      });
      const context = createMockContext();

      const result = await executor.execute(input, config, context);

      expect(result.data?.contact).toEqual({
        name: "John",
        email: "john@example.com",
      });
    });

    it("ignores missing fields", async () => {
      const config: TransformNodeConfig = {
        operation: {
          type: "pick",
          sourceVariable: "data",
          fields: ["a", "b", "c"],
        },
        outputVariable: "picked",
      };

      const input = createMockInput({
        data: { a: 1, c: 3 },
      });
      const context = createMockContext();

      const result = await executor.execute(input, config, context);

      expect(result.data?.picked).toEqual({ a: 1, c: 3 });
    });

    it("returns empty object for non-object source", async () => {
      const config: TransformNodeConfig = {
        operation: {
          type: "pick",
          sourceVariable: "data",
          fields: ["a"],
        },
        outputVariable: "picked",
      };

      const input = createMockInput({ data: "not an object" });
      const context = createMockContext();

      const result = await executor.execute(input, config, context);

      expect(result.data?.picked).toEqual({});
    });
  });

  describe("template operation", () => {
    it("resolves template with variables", async () => {
      const config: TransformNodeConfig = {
        operation: {
          type: "template",
          template: "Hello {{name}}, your order #{{orderId}} is ready.",
        },
        outputVariable: "message",
      };

      const input = createMockInput({
        name: "Alice",
        orderId: "12345",
      });
      const context = createMockContext();

      const result = await executor.execute(input, config, context);

      expect(result.data?.message).toBe("Hello Alice, your order #12345 is ready.");
    });

    it("handles nested variables in templates", async () => {
      const config: TransformNodeConfig = {
        operation: {
          type: "template",
          template: "User: {{user.name}} ({{user.email}})",
        },
        outputVariable: "formatted",
      };

      const input = createMockInput({
        user: { name: "Bob", email: "bob@example.com" },
      });
      const context = createMockContext();

      const result = await executor.execute(input, config, context);

      expect(result.data?.formatted).toBe("User: Bob (bob@example.com)");
    });
  });

  describe("merge operation", () => {
    it("merges multiple objects into one", async () => {
      const config: TransformNodeConfig = {
        operation: {
          type: "merge",
          sources: ["base", "override"],
        },
        outputVariable: "merged",
      };

      const input = createMockInput({
        base: { a: 1, b: 2 },
        override: { b: 3, c: 4 },
      });
      const context = createMockContext();

      const result = await executor.execute(input, config, context);

      expect(result.data?.merged).toEqual({ a: 1, b: 3, c: 4 });
    });

    it("handles non-object sources gracefully", async () => {
      const config: TransformNodeConfig = {
        operation: {
          type: "merge",
          sources: ["valid", "invalid"],
        },
        outputVariable: "merged",
      };

      const input = createMockInput({
        valid: { x: 1 },
        invalid: "not an object",
      });
      const context = createMockContext();

      const result = await executor.execute(input, config, context);

      expect(result.data?.merged).toEqual({ x: 1 });
    });
  });

  describe("output metadata", () => {
    it("includes operation type in metadata", async () => {
      const config: TransformNodeConfig = {
        operation: {
          type: "extractJson",
          sourceVariable: "data",
        },
        outputVariable: "result",
      };

      const input = createMockInput({ data: '{"x": 1}' });
      const result = await executor.execute(input, config, createMockContext());

      expect(result.metadata?.operationType).toBe("extractJson");
    });

    it("sets default outHandle", async () => {
      const config: TransformNodeConfig = {
        operation: {
          type: "template",
          template: "test",
        },
        outputVariable: "result",
      };

      const result = await executor.execute(createMockInput(), config, createMockContext());

      expect(result.outHandle).toBe("default");
    });
  });
});
