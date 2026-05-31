/**
 * Human-in-the-Loop Middleware Tests
 *
 * Tests for the createHumanInTheLoopMiddleware function that enables
 * human approval, editing, or rejection of specific tool calls.
 */

import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import {
  createHumanInTheLoopMiddleware,
  type HITLResponse,
  type HITLRequest,
  type HITLEvent,
} from "../../builtin/human-in-the-loop";
import { AgentMiddlewarePipeline } from "../../middleware-pipeline";
import type { AgentState, AgentRuntime, ToolCallRequest, AgentTool } from "../../types";

// ============================================================================
// Test Helpers
// ============================================================================

function createTestState(): AgentState {
  return {
    messages: [],
    systemPrompt: "Test prompt",
    model: "gpt-4o",
  };
}

function createTestRuntime(): AgentRuntime {
  return {
    context: {},
    nodeId: "test-node",
    sessionId: "test-session",
  };
}

function createTestTool(name: string = "test_tool"): AgentTool {
  return {
    name,
    description: `Test tool: ${name}`,
    schema: z.object({ input: z.string() }),
    execute: async (args) => ({ result: "executed", args }),
  };
}

function createTestToolRequest(
  toolName: string = "test_tool",
  toolArgs: unknown = { input: "test" }
): ToolCallRequest {
  return {
    state: createTestState(),
    runtime: createTestRuntime(),
    toolName,
    toolArgs,
    toolCallId: `call-${Date.now()}`,
    tool: createTestTool(toolName),
  };
}

// ============================================================================
// Configuration Tests
// ============================================================================

describe("createHumanInTheLoopMiddleware", () => {
  describe("configuration", () => {
    it("should throw if no tools in interruptOn", () => {
      expect(() =>
        createHumanInTheLoopMiddleware({
          interruptOn: {},
        })
      ).toThrow("requires at least one tool in interruptOn");
    });

    it("should create middleware with single tool", () => {
      const mw = createHumanInTheLoopMiddleware({
        interruptOn: { send_email: true },
      });
      expect(mw.name).toBe("HumanInTheLoopMiddleware");
      expect(mw.priority).toBe(30);
    });

    it("should create middleware with multiple tools", () => {
      const mw = createHumanInTheLoopMiddleware({
        interruptOn: {
          send_email: true,
          delete_record: true,
        },
      });
      expect(mw.name).toBe("HumanInTheLoopMiddleware");
    });

    it("should apply default config when interruptOn[tool] = true", async () => {
      const requestDecision = vi.fn().mockResolvedValue({ decision: "approve" });

      const mw = createHumanInTheLoopMiddleware({
        interruptOn: { my_tool: true },
        requestDecision,
      });
      const pipeline = new AgentMiddlewarePipeline([mw]);

      const coreHandler = vi.fn().mockResolvedValue({ result: "ok" });

      await pipeline.executeWrapToolCall(
        createTestToolRequest("my_tool"),
        coreHandler
      );

      expect(requestDecision).toHaveBeenCalled();
      const request = requestDecision.mock.calls[0][0] as HITLRequest;
      expect(request.allowedDecisions).toEqual(["approve", "reject"]);
    });
  });

  // ==========================================================================
  // wrapToolCall Tests
  // ==========================================================================

  describe("wrapToolCall", () => {
    it("should pass through for non-interrupt tools", async () => {
      const mw = createHumanInTheLoopMiddleware({
        interruptOn: { sensitive_tool: true },
      });
      const pipeline = new AgentMiddlewarePipeline([mw]);

      const coreHandler = vi.fn().mockResolvedValue({ result: "success" });

      const result = await pipeline.executeWrapToolCall(
        createTestToolRequest("regular_tool"),
        coreHandler
      );

      expect(coreHandler).toHaveBeenCalled();
      expect(result.result).toBe("success");
    });

    it("should interrupt for configured tools", async () => {
      const requestDecision = vi.fn().mockResolvedValue({ decision: "approve" });

      const mw = createHumanInTheLoopMiddleware({
        interruptOn: { send_email: true },
        requestDecision,
      });
      const pipeline = new AgentMiddlewarePipeline([mw]);

      const coreHandler = vi.fn().mockResolvedValue({ result: "sent" });

      await pipeline.executeWrapToolCall(
        createTestToolRequest("send_email"),
        coreHandler
      );

      expect(requestDecision).toHaveBeenCalled();
    });

    it("should check condition function when provided", async () => {
      const requestDecision = vi.fn().mockResolvedValue({ decision: "approve" });

      const mw = createHumanInTheLoopMiddleware({
        interruptOn: {
          transfer_funds: {
            condition: (args: unknown) => (args as { amount: number }).amount > 1000,
          },
        },
        requestDecision,
      });
      const pipeline = new AgentMiddlewarePipeline([mw]);

      const coreHandler = vi.fn().mockResolvedValue({ result: "transferred" });

      // Low amount - should NOT interrupt
      await pipeline.executeWrapToolCall(
        createTestToolRequest("transfer_funds", { amount: 500 }),
        coreHandler
      );

      expect(requestDecision).not.toHaveBeenCalled();
      expect(coreHandler).toHaveBeenCalledTimes(1);

      // High amount - SHOULD interrupt
      await pipeline.executeWrapToolCall(
        createTestToolRequest("transfer_funds", { amount: 5000 }),
        coreHandler
      );

      expect(requestDecision).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Decision Tests
  // ==========================================================================

  describe("decisions", () => {
    it("should proceed on 'approve' decision", async () => {
      const requestDecision = vi.fn().mockResolvedValue({ decision: "approve" });

      const mw = createHumanInTheLoopMiddleware({
        interruptOn: { my_tool: true },
        requestDecision,
      });
      const pipeline = new AgentMiddlewarePipeline([mw]);

      const coreHandler = vi.fn().mockResolvedValue({ result: "success" });

      const result = await pipeline.executeWrapToolCall(
        createTestToolRequest("my_tool"),
        coreHandler
      );

      expect(coreHandler).toHaveBeenCalled();
      expect(result.result).toBe("success");
    });

    it("should modify args on 'edit' decision", async () => {
      const requestDecision = vi.fn().mockResolvedValue({
        decision: "edit",
        editedArgs: { input: "modified input" },
      });

      const mw = createHumanInTheLoopMiddleware({
        interruptOn: { my_tool: true },
        requestDecision,
      });
      const pipeline = new AgentMiddlewarePipeline([mw]);

      let receivedArgs: unknown = null;
      const coreHandler = vi.fn().mockImplementation(async (req: ToolCallRequest) => {
        receivedArgs = req.toolArgs;
        return { result: "ok" };
      });

      await pipeline.executeWrapToolCall(
        createTestToolRequest("my_tool", { input: "original" }),
        coreHandler
      );

      expect(receivedArgs).toEqual({ input: "modified input" });
    });

    it("should return error on 'reject' decision", async () => {
      const requestDecision = vi.fn().mockResolvedValue({
        decision: "reject",
        message: "Action rejected by manager",
      });

      const mw = createHumanInTheLoopMiddleware({
        interruptOn: { my_tool: true },
        requestDecision,
      });
      const pipeline = new AgentMiddlewarePipeline([mw]);

      const coreHandler = vi.fn().mockResolvedValue({ result: "should not be called" });

      const result = await pipeline.executeWrapToolCall(
        createTestToolRequest("my_tool"),
        coreHandler
      );

      expect(coreHandler).not.toHaveBeenCalled();
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain("Action rejected by manager");
    });

    it("should skip silently on 'skip' decision", async () => {
      const requestDecision = vi.fn().mockResolvedValue({
        decision: "skip",
        message: "Not needed right now",
      });

      const mw = createHumanInTheLoopMiddleware({
        interruptOn: { my_tool: true },
        requestDecision,
      });
      const pipeline = new AgentMiddlewarePipeline([mw]);

      const coreHandler = vi.fn().mockResolvedValue({ result: "should not be called" });

      const result = await pipeline.executeWrapToolCall(
        createTestToolRequest("my_tool"),
        coreHandler
      );

      expect(coreHandler).not.toHaveBeenCalled();
      expect(result.result).toEqual({ skipped: true, reason: "Not needed right now" });
      expect(result.skipMessage).toBe(true);
    });
  });

  // ==========================================================================
  // Timeout Tests
  // ==========================================================================

  describe("timeout", () => {
    it("should apply timeoutBehavior on timeout", async () => {
      const requestDecision = vi.fn().mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error("HITL timeout")), 100);
        });
      });

      const mw = createHumanInTheLoopMiddleware({
        interruptOn: {
          my_tool: {
            timeout: 50, // Very short timeout
            timeoutBehavior: "reject",
          },
        },
        requestDecision,
        defaultTimeout: 50,
      });
      const pipeline = new AgentMiddlewarePipeline([mw]);

      const coreHandler = vi.fn().mockResolvedValue({ result: "success" });

      const result = await pipeline.executeWrapToolCall(
        createTestToolRequest("my_tool"),
        coreHandler
      );

      // Should have rejected due to timeout
      expect(result.error).toBeDefined();
    });

    it("should approve on timeout when timeoutBehavior='approve'", async () => {
      const requestDecision = vi.fn().mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error("HITL timeout")), 100);
        });
      });

      const mw = createHumanInTheLoopMiddleware({
        interruptOn: {
          my_tool: {
            timeout: 50,
            timeoutBehavior: "approve",
          },
        },
        requestDecision,
        defaultTimeout: 50,
      });
      const pipeline = new AgentMiddlewarePipeline([mw]);

      const coreHandler = vi.fn().mockResolvedValue({ result: "auto-approved" });

      const result = await pipeline.executeWrapToolCall(
        createTestToolRequest("my_tool"),
        coreHandler
      );

      expect(coreHandler).toHaveBeenCalled();
      expect(result.result).toBe("auto-approved");
    });
  });

  // ==========================================================================
  // Event Handler Tests
  // ==========================================================================

  describe("events", () => {
    it("should emit 'interrupt' event when tool is intercepted", async () => {
      const events: HITLEvent[] = [];
      const eventHandler = vi.fn((event: HITLEvent) => events.push(event));
      const requestDecision = vi.fn().mockResolvedValue({ decision: "approve" });

      const mw = createHumanInTheLoopMiddleware({
        interruptOn: { my_tool: true },
        requestDecision,
        eventHandler,
      });
      const pipeline = new AgentMiddlewarePipeline([mw]);

      const coreHandler = vi.fn().mockResolvedValue({ result: "ok" });

      await pipeline.executeWrapToolCall(
        createTestToolRequest("my_tool"),
        coreHandler
      );

      expect(eventHandler).toHaveBeenCalled();
      const interruptEvent = events.find((e) => e.type === "interrupt");
      expect(interruptEvent).toBeDefined();
      expect(interruptEvent?.toolName).toBe("my_tool");
    });

    it("should emit 'decision' event when decision is made", async () => {
      const events: HITLEvent[] = [];
      const eventHandler = vi.fn((event: HITLEvent) => events.push(event));
      const requestDecision = vi.fn().mockResolvedValue({ decision: "approve" });

      const mw = createHumanInTheLoopMiddleware({
        interruptOn: { my_tool: true },
        requestDecision,
        eventHandler,
      });
      const pipeline = new AgentMiddlewarePipeline([mw]);

      const coreHandler = vi.fn().mockResolvedValue({ result: "ok" });

      await pipeline.executeWrapToolCall(
        createTestToolRequest("my_tool"),
        coreHandler
      );

      const decisionEvent = events.find((e) => e.type === "decision");
      expect(decisionEvent).toBeDefined();
      expect(decisionEvent?.decision).toBe("approve");
    });
  });

  // ==========================================================================
  // Request Details Tests
  // ==========================================================================

  describe("request details", () => {
    it("should include tool information in request", async () => {
      let capturedRequest: HITLRequest | null = null;
      const requestDecision = vi.fn().mockImplementation((req: HITLRequest) => {
        capturedRequest = req;
        return { decision: "approve" };
      });

      const mw = createHumanInTheLoopMiddleware({
        interruptOn: {
          send_email: {
            description: "Review email before sending",
          },
        },
        requestDecision,
      });
      const pipeline = new AgentMiddlewarePipeline([mw]);

      const coreHandler = vi.fn().mockResolvedValue({ result: "ok" });

      await pipeline.executeWrapToolCall(
        createTestToolRequest("send_email", { to: "user@test.com", body: "Hello" }),
        coreHandler
      );

      expect(capturedRequest).not.toBeNull();
      expect(capturedRequest!.toolName).toBe("send_email");
      expect(capturedRequest!.toolArgs).toEqual({ to: "user@test.com", body: "Hello" });
      expect(capturedRequest!.description).toBe("Review email before sending");
      expect(capturedRequest!.requestId).toMatch(/^hitl_/);
    });

    it("should include allowed decisions from config", async () => {
      let capturedRequest: HITLRequest | null = null;
      const requestDecision = vi.fn().mockImplementation((req: HITLRequest) => {
        capturedRequest = req;
        return { decision: "approve" };
      });

      const mw = createHumanInTheLoopMiddleware({
        interruptOn: {
          my_tool: {
            allowedDecisions: ["approve", "edit", "reject"],
          },
        },
        requestDecision,
      });
      const pipeline = new AgentMiddlewarePipeline([mw]);

      const coreHandler = vi.fn().mockResolvedValue({ result: "ok" });

      await pipeline.executeWrapToolCall(
        createTestToolRequest("my_tool"),
        coreHandler
      );

      expect(capturedRequest!.allowedDecisions).toEqual(["approve", "edit", "reject"]);
    });
  });

  // ==========================================================================
  // No Callback Mode Tests
  // ==========================================================================

  describe("no callback mode", () => {
    it("should reject by default when no requestDecision provided", async () => {
      const mw = createHumanInTheLoopMiddleware({
        interruptOn: { my_tool: true },
        // No requestDecision callback
      });
      const pipeline = new AgentMiddlewarePipeline([mw]);

      const coreHandler = vi.fn().mockResolvedValue({ result: "ok" });

      const result = await pipeline.executeWrapToolCall(
        createTestToolRequest("my_tool"),
        coreHandler
      );

      expect(coreHandler).not.toHaveBeenCalled();
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain("No HITL handler configured");
    });
  });
});
