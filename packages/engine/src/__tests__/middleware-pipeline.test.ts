import { describe, expect, it, vi, beforeEach } from "vitest";
import { MiddlewarePipeline } from "../middleware/middleware-pipeline";
import type { Middleware, MiddlewareDefinition } from "../middleware/types";
import type { EnhancedUserJourney, JourneyConfig, JourneyNodeData } from "@journey/schemas";
import { createSessionStateManager } from "../state/session-state-manager";
import type { EngineServices, ExecutionContext, HandlerResult } from "../types";
import { createStateMethods } from "../utils";

/**
 * Creates a mock JourneyNodeData for testing
 */
function createMockNode(id: string, type: string = "message"): JourneyNodeData {
  return {
    id,
    type: "custom",
    position: { x: 0, y: 0 },
    metadata: { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    data: { type, label: `Test ${type}` },
  } as JourneyNodeData;
}

/**
 * Creates mock services for testing
 */
function createMockServices(): EngineServices {
  return {
    messenger: { sendMessage: vi.fn().mockResolvedValue({ success: true, messageIds: [] }) },
    timer: {
      scheduleTimer: vi.fn(),
      cancelTimer: vi.fn(),
      cancelTimersForNode: vi.fn(),
      getEdgeForTimer: vi.fn(),
      markTimerFired: vi.fn(),
      clearAll: vi.fn(),
      // Plugin follow-up methods
      schedulePluginFollowUpTimer: vi.fn(),
      getPluginFollowUpContext: vi.fn(),
      hasPluginFollowUp: vi.fn(),
      markPluginFollowUpFired: vi.fn(),
      cancelPluginFollowUpsForNode: vi.fn(),
      cancelAllPluginFollowUps: vi.fn(),
      shouldCancelPluginFollowUpsOnResponse: vi.fn().mockReturnValue(true),
      getPluginFollowUpResponseBehavior: vi.fn().mockReturnValue(null),
    },
    eventLogger: { logEvent: vi.fn() },
    conditionEvaluator: { evaluate: vi.fn() },
    webhookExecutor: { execute: vi.fn(), executeRequest: vi.fn() },
    template: { substitute: vi.fn((t) => t) },
    tag: { executeTagAction: vi.fn(), getTags: vi.fn() },
    variable: { executeAction: vi.fn(), getAll: vi.fn() },
    conversationHistory: {
      buildFromEvents: vi.fn().mockReturnValue([]),
      getLastUserMessage: vi.fn().mockReturnValue(""),
      hasRecentUserMessage: vi.fn().mockReturnValue(false),
    },
    has: () => false,
  };
}

/**
 * Creates a mock ExecutionContext for testing
 */
function createMockContext(): ExecutionContext {
  const session: EnhancedUserJourney = {
    sessionId: "test-session",
    userId: "test-user",
    platformUserId: "test-user",
    journeyId: "test-journey",
    currentNodeId: "node-1",
    status: "active",
    context: {},
    tags: [],
    history: [],
    pendingTimers: [],
            pendingPluginFollowUps: [],
    nodeOutputs: {},
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null,
    hasStarted: false,
  };

  const node = createMockNode("node-1");
  const stateManager = createSessionStateManager(session);
  return {
    session,
    stateManager,
    node,
    journey: { nodes: [], edges: [] } as JourneyConfig,
    outgoingEdges: [],
    services: createMockServices(),
    log: {
      trace: vi.fn(),
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as unknown as ExecutionContext["log"],
    ...createStateMethods(session, node.id, node.data.type, stateManager),
  };
}

/**
 * Creates a mock HandlerResult for testing
 */
function createMockResult(action: "wait" | "transition" | "complete" = "wait"): HandlerResult {
  if (action === "transition") {
    return { action, targetNodeId: "target-node", trigger: "test" };
  }
  return { action };
}

describe("MiddlewarePipeline", () => {
  let mockLog: ReturnType<typeof import("@journey/logger").createLogger>;

  beforeEach(() => {
    mockLog = {
      trace: vi.fn(),
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as unknown as ReturnType<typeof import("@journey/logger").createLogger>;
  });

  describe("constructor", () => {
    it("should create an empty pipeline", () => {
      const pipeline = new MiddlewarePipeline();
      expect(pipeline.size).toBe(0);
      expect(pipeline.getMiddlewareNames()).toEqual([]);
    });

    it("should accept custom logger", () => {
      const pipeline = new MiddlewarePipeline({ logger: mockLog });
      expect(pipeline.size).toBe(0);
    });
  });

  describe("use", () => {
    it("should add middleware to pipeline", () => {
      const pipeline = new MiddlewarePipeline();
      const middleware: Middleware = async (_node, _ctx, _result, next) => {
        await next();
      };

      pipeline.use("test", middleware);

      expect(pipeline.size).toBe(1);
      expect(pipeline.getMiddlewareNames()).toEqual(["test"]);
      expect(pipeline.has("test")).toBe(true);
    });

    it("should support method chaining", () => {
      const pipeline = new MiddlewarePipeline();
      const middleware: Middleware = async (_node, _ctx, _result, next) => {
        await next();
      };

      const result = pipeline.use("a", middleware).use("b", middleware).use("c", middleware);

      expect(result).toBe(pipeline);
      expect(pipeline.size).toBe(3);
    });

    it("should sort middleware by priority (lower first)", () => {
      const pipeline = new MiddlewarePipeline();
      const middleware: Middleware = async (_node, _ctx, _result, next) => {
        await next();
      };

      pipeline.use("high", middleware, 100);
      pipeline.use("low", middleware, 10);
      pipeline.use("medium", middleware, 50);

      expect(pipeline.getMiddlewareNames()).toEqual(["low", "medium", "high"]);
    });

    it("should use default priority 100 when not specified", () => {
      const pipeline = new MiddlewarePipeline();
      const middleware: Middleware = async (_node, _ctx, _result, next) => {
        await next();
      };

      pipeline.use("first", middleware, 50);
      pipeline.use("default", middleware); // default: 100
      pipeline.use("last", middleware, 150);

      expect(pipeline.getMiddlewareNames()).toEqual(["first", "default", "last"]);
    });
  });

  describe("useDefinition", () => {
    it("should add middleware from definition object", () => {
      const pipeline = new MiddlewarePipeline();
      const definition: MiddlewareDefinition = {
        name: "test",
        middleware: async (_node, _ctx, _result, next) => {
          await next();
        },
        priority: 25,
      };

      pipeline.useDefinition(definition);

      expect(pipeline.size).toBe(1);
      expect(pipeline.has("test")).toBe(true);
    });
  });

  describe("execute", () => {
    it("should execute middleware in priority order", async () => {
      const pipeline = new MiddlewarePipeline();
      const executionOrder: string[] = [];

      pipeline.use(
        "third",
        async (_node, _ctx, _result, next) => {
          executionOrder.push("third:start");
          await next();
          executionOrder.push("third:end");
        },
        30
      );

      pipeline.use(
        "first",
        async (_node, _ctx, _result, next) => {
          executionOrder.push("first:start");
          await next();
          executionOrder.push("first:end");
        },
        10
      );

      pipeline.use(
        "second",
        async (_node, _ctx, _result, next) => {
          executionOrder.push("second:start");
          await next();
          executionOrder.push("second:end");
        },
        20
      );

      await pipeline.execute(createMockNode("node-1"), createMockContext(), createMockResult());

      // Express-style: outer middleware wrap inner middleware
      expect(executionOrder).toEqual([
        "first:start",
        "second:start",
        "third:start",
        "third:end",
        "second:end",
        "first:end",
      ]);
    });

    it("should pass node, context, and result to middleware", async () => {
      const pipeline = new MiddlewarePipeline();
      const node = createMockNode("test-node", "message");
      const context = createMockContext();
      const result = createMockResult("transition");

      let receivedNode: JourneyNodeData | undefined;
      let receivedContext: ExecutionContext | undefined;
      let receivedResult: HandlerResult | undefined;

      pipeline.use("capture", async (n, ctx, res, next) => {
        receivedNode = n;
        receivedContext = ctx;
        receivedResult = res;
        await next();
      });

      await pipeline.execute(node, context, result);

      expect(receivedNode).toBe(node);
      expect(receivedContext).toBe(context);
      expect(receivedResult).toBe(result);
    });

    it("should short-circuit pipeline if next() is not called", async () => {
      const pipeline = new MiddlewarePipeline();
      const executionOrder: string[] = [];

      pipeline.use(
        "first",
        async () => {
          executionOrder.push("first");
          // Not calling next() - short-circuits
        },
        10
      );

      pipeline.use(
        "second",
        async (_node, _ctx, _result, next) => {
          executionOrder.push("second");
          await next();
        },
        20
      );

      await pipeline.execute(createMockNode("node-1"), createMockContext(), createMockResult());

      expect(executionOrder).toEqual(["first"]);
    });

    it("should handle empty pipeline", async () => {
      const pipeline = new MiddlewarePipeline();

      // Should not throw
      await expect(
        pipeline.execute(createMockNode("node-1"), createMockContext(), createMockResult())
      ).resolves.toBeUndefined();
    });
  });

  describe("error handling", () => {
    it("should log error and continue by default", async () => {
      const pipeline = new MiddlewarePipeline({ logger: mockLog });
      const executionOrder: string[] = [];

      pipeline.use(
        "error",
        async () => {
          executionOrder.push("error:before");
          throw new Error("Test error");
        },
        10
      );

      pipeline.use(
        "after",
        async (_node, _ctx, _result, next) => {
          executionOrder.push("after");
          await next();
        },
        20
      );

      await pipeline.execute(createMockNode("node-1"), createMockContext(), createMockResult());

      // Error middleware ran, and "after" middleware still ran
      expect(executionOrder).toEqual(["error:before", "after"]);
      expect(mockLog.error).toHaveBeenCalled();
    });

    it("should stop and re-throw on error when stopOnError is true", async () => {
      const pipeline = new MiddlewarePipeline({ stopOnError: true, logger: mockLog });
      const executionOrder: string[] = [];

      pipeline.use(
        "error",
        async () => {
          executionOrder.push("error:before");
          throw new Error("Test error");
        },
        10
      );

      pipeline.use(
        "after",
        async (_node, _ctx, _result, next) => {
          executionOrder.push("after");
          await next();
        },
        20
      );

      await expect(
        pipeline.execute(createMockNode("node-1"), createMockContext(), createMockResult())
      ).rejects.toThrow("Test error");

      // Error middleware ran, but "after" middleware did NOT run
      expect(executionOrder).toEqual(["error:before"]);
    });
  });

  describe("has", () => {
    it("should return true for registered middleware", () => {
      const pipeline = new MiddlewarePipeline();
      pipeline.use("test", async (_n, _c, _r, next) => await next());

      expect(pipeline.has("test")).toBe(true);
    });

    it("should return false for unregistered middleware", () => {
      const pipeline = new MiddlewarePipeline();

      expect(pipeline.has("nonexistent")).toBe(false);
    });
  });

  describe("remove", () => {
    it("should remove middleware by name and return true", () => {
      const pipeline = new MiddlewarePipeline();
      pipeline.use("test", async (_n, _c, _r, next) => await next());

      const result = pipeline.remove("test");

      expect(result).toBe(true);
      expect(pipeline.has("test")).toBe(false);
      expect(pipeline.size).toBe(0);
    });

    it("should return false if middleware not found", () => {
      const pipeline = new MiddlewarePipeline();

      const result = pipeline.remove("nonexistent");

      expect(result).toBe(false);
    });
  });

  describe("clear", () => {
    it("should remove all middleware", () => {
      const pipeline = new MiddlewarePipeline();
      pipeline.use("a", async (_n, _c, _r, next) => await next());
      pipeline.use("b", async (_n, _c, _r, next) => await next());
      pipeline.use("c", async (_n, _c, _r, next) => await next());

      pipeline.clear();

      expect(pipeline.size).toBe(0);
      expect(pipeline.getMiddlewareNames()).toEqual([]);
    });
  });

  describe("logging", () => {
    it("should trace middleware execution when logger provided", async () => {
      const pipeline = new MiddlewarePipeline({ logger: mockLog });
      pipeline.use("test", async (_n, _c, _r, next) => await next());

      await pipeline.execute(createMockNode("node-1"), createMockContext(), createMockResult());

      expect(mockLog.trace).toHaveBeenCalledWith(
        expect.objectContaining({ middlewareName: "test", nodeId: "node-1" }),
        "middleware:executing"
      );
      expect(mockLog.trace).toHaveBeenCalledWith(
        expect.objectContaining({ middlewareName: "test", nodeId: "node-1" }),
        "middleware:completed"
      );
    });
  });

  describe("re-entrancy protection", () => {
    it("should ignore multiple calls to next() from same middleware", async () => {
      const pipeline = new MiddlewarePipeline({ logger: mockLog });
      const executionOrder: string[] = [];

      // First middleware calls next() multiple times
      pipeline.use(
        "double-caller",
        async (_node, _ctx, _result, next) => {
          executionOrder.push("double-caller:start");
          await next(); // First call - should work
          await next(); // Second call - should be ignored
          await next(); // Third call - should be ignored
          executionOrder.push("double-caller:end");
        },
        10
      );

      pipeline.use(
        "second",
        async (_node, _ctx, _result, next) => {
          executionOrder.push("second");
          await next();
        },
        20
      );

      pipeline.use(
        "third",
        async (_node, _ctx, _result, next) => {
          executionOrder.push("third");
          await next();
        },
        30
      );

      await pipeline.execute(createMockNode("node-1"), createMockContext(), createMockResult());

      // Second and third should only execute once despite multiple next() calls
      expect(executionOrder).toEqual([
        "double-caller:start",
        "second",
        "third",
        "double-caller:end",
      ]);

      // Should have logged a warning for duplicate calls
      expect(mockLog.warn).toHaveBeenCalledWith(
        expect.objectContaining({ middlewareName: "double-caller" }),
        "middleware:next:calledMultipleTimes"
      );
    });

    it("should handle concurrent next() calls safely", async () => {
      const pipeline = new MiddlewarePipeline({ logger: mockLog });
      const executionOrder: string[] = [];

      // First middleware calls next() concurrently
      pipeline.use(
        "concurrent-caller",
        async (_node, _ctx, _result, next) => {
          executionOrder.push("concurrent:start");
          // Fire off multiple concurrent next() calls
          await Promise.all([next(), next(), next()]);
          executionOrder.push("concurrent:end");
        },
        10
      );

      pipeline.use(
        "second",
        async (_node, _ctx, _result, next) => {
          executionOrder.push("second");
          await next();
        },
        20
      );

      await pipeline.execute(createMockNode("node-1"), createMockContext(), createMockResult());

      // Second middleware should only execute once
      expect(executionOrder.filter((e) => e === "second").length).toBe(1);
    });
  });

  describe("null safety", () => {
    it("should handle node with undefined data", async () => {
      const pipeline = new MiddlewarePipeline({ logger: mockLog });
      const executionOrder: string[] = [];

      pipeline.use(
        "test",
        async (node, _ctx, _result, next) => {
          executionOrder.push("test:start");
          // Access node.data - should not throw
          const data = node.data;
          executionOrder.push(`data:${data ? "exists" : "undefined"}`);
          await next();
        },
        10
      );

      // Create node with undefined data
      const nodeWithNoData = {
        id: "node-1",
        type: "custom",
        position: { x: 0, y: 0 },
        metadata: { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        data: undefined,
      } as unknown as JourneyNodeData;

      await pipeline.execute(nodeWithNoData, createMockContext(), createMockResult());

      expect(executionOrder).toEqual(["test:start", "data:undefined"]);
    });
  });

  describe("middleware error propagation", () => {
    it("should re-throw middleware errors when stopOnError is true", async () => {
      const pipeline = new MiddlewarePipeline({ stopOnError: true, logger: mockLog });
      const executionOrder: string[] = [];

      pipeline.use(
        "first",
        async (_node, _ctx, _result, next) => {
          executionOrder.push("first:start");
          await next();
          executionOrder.push("first:end");
        },
        10
      );

      // This middleware throws (simulates strict mode variable middleware)
      pipeline.use(
        "throws",
        async () => {
          executionOrder.push("throws:start");
          throw new Error("Strict mode error");
        },
        20
      );

      pipeline.use(
        "third",
        async (_node, _ctx, _result, next) => {
          executionOrder.push("third");
          await next();
        },
        30
      );

      await expect(
        pipeline.execute(createMockNode("node-1"), createMockContext(), createMockResult())
      ).rejects.toThrow("Strict mode error");

      // First started, throws ran, third never ran (error propagated)
      expect(executionOrder).toEqual(["first:start", "throws:start"]);
    });

    it("should log and continue when stopOnError is false", async () => {
      const pipeline = new MiddlewarePipeline({ stopOnError: false, logger: mockLog });
      const executionOrder: string[] = [];

      pipeline.use(
        "first",
        async (_node, _ctx, _result, next) => {
          executionOrder.push("first:start");
          await next();
          executionOrder.push("first:end");
        },
        10
      );

      // This middleware throws
      pipeline.use(
        "throws",
        async () => {
          executionOrder.push("throws:start");
          throw new Error("Non-strict error");
        },
        20
      );

      pipeline.use(
        "third",
        async (_node, _ctx, _result, next) => {
          executionOrder.push("third");
          await next();
        },
        30
      );

      // Should NOT throw - pipeline continues
      await expect(
        pipeline.execute(createMockNode("node-1"), createMockContext(), createMockResult())
      ).resolves.toBeUndefined();

      // Third middleware ran despite throws middleware erroring
      expect(executionOrder).toEqual(["first:start", "throws:start", "third", "first:end"]);

      // Error was logged
      expect(mockLog.error).toHaveBeenCalledWith(
        expect.objectContaining({ middlewareName: "throws" }),
        "middleware:error"
      );
    });
  });
});
