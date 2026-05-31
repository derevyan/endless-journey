import type { EnhancedUserJourney, JourneyConfig, JourneyEdgeData, JourneyNodeData } from "@journey/schemas";
import { describe, expect, it, vi } from "vitest";
import { conditionHandler, endHandler, messageHandler, questionnaireHandler, handleQuestionnaireResponse, startHandler, waitHandler, webhookHandler } from "../handlers";
import { createSessionStateManager } from "../state/session-state-manager";
import type { EngineServices, ExecutionContext } from "../types";
import { createStateMethods } from "../utils";

// Helper to verify sendMessage was called with expected content, buttons, and media
// (ignores the 4th parameter - cached evaluation context - as it's an implementation detail)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function expectSendMessage(
  sendMessageMock: any,
  content: string | ReturnType<typeof expect.stringContaining>,
  buttons?: unknown,
  media?: unknown,
  callIndex = 0
) {
  expect(sendMessageMock).toHaveBeenCalled();
  const call = sendMessageMock.mock.calls[callIndex];
  if (typeof content === "string") {
    expect(call[0]).toBe(content);
  } else {
    expect(call[0]).toEqual(content);
  }
  expect(call[1]).toEqual(buttons);
  expect(call[2]).toEqual(media);
}

// Helper to create mock services
function createMockServices(): EngineServices {
  return {
    messenger: {
      sendMessage: vi.fn().mockResolvedValue({ success: true, messageIds: [] }),
    },
    timer: {
      scheduleTimer: vi.fn().mockReturnValue("timer-1"),
      cancelTimer: vi.fn(),
      cancelTimersForNode: vi.fn(),
      getEdgeForTimer: vi.fn(),
      markTimerFired: vi.fn(),
      clearAll: vi.fn(),
      // Plugin follow-up methods
      schedulePluginFollowUpTimer: vi.fn().mockResolvedValue("plugin-followup-timer-1"),
      getPluginFollowUpContext: vi.fn(),
      hasPluginFollowUp: vi.fn().mockReturnValue(false),
      markPluginFollowUpFired: vi.fn(),
      cancelPluginFollowUpsForNode: vi.fn(),
      cancelAllPluginFollowUps: vi.fn(),
      shouldCancelPluginFollowUpsOnResponse: vi.fn().mockReturnValue(true),
      getPluginFollowUpResponseBehavior: vi.fn().mockReturnValue(null),
    },
    eventLogger: {
      logEvent: vi.fn(),
    },
    conditionEvaluator: {
      evaluate: vi.fn().mockReturnValue("yes"),
    },
    webhookExecutor: {
      execute: vi.fn().mockResolvedValue({ success: true }),
      executeRequest: vi.fn().mockResolvedValue({ statusCode: 200, body: { success: true }, headers: {} }),
    },
    template: {
      substitute: vi.fn((t) => t),
    },
    tag: {
      executeTagAction: vi.fn().mockResolvedValue(undefined),
      getTags: vi.fn().mockResolvedValue([]),
    },
    variable: {
      executeAction: vi.fn().mockResolvedValue(undefined),
      getAll: vi.fn().mockResolvedValue({}),
    },
    conversationHistory: {
      buildFromEvents: vi.fn().mockReturnValue([]),
      getLastUserMessage: vi.fn().mockReturnValue(""),
      hasRecentUserMessage: vi.fn().mockReturnValue(false),
    },
    has: () => false,
  };
}

// Helper to create mock context
function createMockContext(node: Partial<JourneyNodeData>, edges: Partial<JourneyEdgeData>[] = [], services = createMockServices()): ExecutionContext {
  const session: EnhancedUserJourney = {
    sessionId: "test-session",
    userId: "test-user",
    platformUserId: "test-user",
    journeyId: "test-journey",
    currentNodeId: node.id || "test-node",
    status: "active",
    context: {},
    tags: [],
    pendingTimers: [],
            pendingPluginFollowUps: [],
    nodeOutputs: {},
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null,
    hasStarted: false,
    history: [],
  };

  const nodeData = {
    id: "test-node",
    type: "custom",
    position: { x: 0, y: 0 },
    metadata: { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    ...node,
  } as JourneyNodeData;

  const stateManager = createSessionStateManager(session);

  return {
    session,
    stateManager,
    node: nodeData,
    journey: { nodes: [], edges: [] } as JourneyConfig,
    outgoingEdges: edges as JourneyEdgeData[],
    services,
    log: {
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as unknown as ReturnType<typeof import("@journey/logger").createLogger>,
    ...createStateMethods(session, nodeData.id, nodeData.data.type, stateManager),
  };
}

describe("Node Handlers", () => {
  describe("StartHandler", () => {
    it("should send welcome message", async () => {
      const services = createMockServices();
      const context = createMockContext(
        {
          id: "start",
          data: { type: "start", schemaVersion: 1, label: "Start", content: "Welcome!" },
        },
        [],
        services
      );

      await startHandler.execute(context);

      expectSendMessage(services.messenger.sendMessage, "Welcome!", undefined, undefined);
    });

    it("should return wait when no auto-transition", async () => {
      const context = createMockContext({
        id: "start",
        data: { type: "start", schemaVersion: 1, label: "Start", content: "Welcome!" },
      });

      const result = await startHandler.execute(context);

      expect(result).toEqual({ action: "wait" });
    });

    it("should return transition for auto-transition edge", async () => {
      const context = createMockContext(
        {
          id: "start",
          data: { type: "start", schemaVersion: 1, label: "Start", content: "Welcome!" },
        },
        [{ id: "edge-1", source: "start", target: "next", label: "Auto transition" }]
      );

      const result = await startHandler.execute(context);

      expect(result).toEqual({
        action: "transition",
        targetNodeId: "next",
        trigger: "automatic",
      });
    });
  });

  describe("MessageHandler", () => {
    it("should send message with buttons", async () => {
      const services = createMockServices();
      const buttons = [
        { id: "btn-a", text: "Option A", targetNodeId: "node-a" },
        { id: "btn-b", text: "Option B", targetNodeId: "node-b" },
      ];
      const context = createMockContext(
        {
          id: "msg",
          data: {
            type: "message",
            schemaVersion: 2,
            contentFormat: "text",
            label: "Message",
            content: "Choose an option",
            responseType: "buttons",
            buttons,
          },
        },
        [],
        services
      );

      await messageHandler.execute(context);

      expectSendMessage(services.messenger.sendMessage, "Choose an option", buttons, undefined);
    });

    it("should filter guarded buttons before sending", async () => {
      const services = createMockServices();
      const buttons = [
        { id: "btn-a", text: "Option A", targetNodeId: "node-a" },
        { id: "btn-b", text: "Option B", targetNodeId: "node-b" },
      ];
      const context = createMockContext(
        {
          id: "msg",
          data: {
            type: "message",
            schemaVersion: 2,
            contentFormat: "text",
            label: "Message",
            content: "Choose an option",
            responseType: "buttons",
            buttons,
          },
        },
        [
          {
            id: "edge-a",
            source: "msg",
            target: "node-a",
            guard: { type: "expression", expression: 'user.platform == "telegram"' },
          },
          {
            id: "edge-b",
            source: "msg",
            target: "node-b",
            guard: { type: "expression", expression: 'user.platform == "whatsapp"' },
          },
        ],
        services
      );
      context.clientData = { id: "test-user", platform: "telegram" };

      await messageHandler.execute(context);

      const [, sentButtons] = (services.messenger.sendMessage as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(sentButtons).toHaveLength(1);
      expect(sentButtons?.[0]?.id).toBe("btn-a");
      expect(context.session.activeButtons).toEqual([
        { id: "btn-a", text: "Option A", targetNodeId: "node-a", source: "node" },
      ]);
    });

    it("should schedule timer when timer config exists", async () => {
      const services = createMockServices();
      const context = createMockContext(
        {
          id: "msg",
          data: {
            type: "message",
            schemaVersion: 2,
            contentFormat: "text",
            label: "Message",
            content: "Wait...",
            timer: { seconds: 30 },
          },
        },
        [{ id: "timer-edge", source: "msg", target: "timeout", edgeType: "timer" }],
        services
      );

      await messageHandler.execute(context);

      expect(services.timer.scheduleTimer).toHaveBeenCalledWith(30000, "timer-edge");
    });

    it("should return wait result", async () => {
      const context = createMockContext({
        id: "msg",
        data: { type: "message", schemaVersion: 2, contentFormat: "text", label: "Message", content: "Hello" },
      });

      const result = await messageHandler.execute(context);

      expect(result).toEqual({ action: "wait" });
    });

    it("should filter buttons using vars.journey.* guard expression (full async context)", async () => {
      const services = createMockServices();
      // Mock variable service to return isPremium = false for journey scope
      services.variable.getAll = vi.fn().mockImplementation(async (scope: string) => {
        if (scope === "journey") return { isPremium: false };
        return {};
      });

      const buttons = [
        { id: "btn-free", text: "Free Feature", targetNodeId: "free-node" },
        { id: "btn-premium", text: "Premium Feature", targetNodeId: "premium-node" },
      ];

      const context = createMockContext(
        {
          id: "msg",
          data: {
            type: "message",
            schemaVersion: 2,
            contentFormat: "text",
            label: "Message",
            content: "Choose a feature",
            responseType: "buttons",
            buttons,
          },
        },
        [
          // Free button has no guard - always passes
          {
            id: "edge-free",
            source: "msg",
            target: "free-node",
          },
          // Premium button guarded by vars.journey.isPremium == true
          {
            id: "edge-premium",
            source: "msg",
            target: "premium-node",
            guard: { type: "expression", expression: "vars.journey.isPremium == true" },
          },
        ],
        services
      );

      await messageHandler.execute(context);

      // Verify async variable fetch was called (proves withFullContext() was used)
      expect(services.variable.getAll).toHaveBeenCalledWith("journey");

      // Only free button should be sent (premium guard fails)
      const [, sentButtons] = (services.messenger.sendMessage as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(sentButtons).toHaveLength(1);
      expect(sentButtons?.[0]?.id).toBe("btn-free");
    });
  });

  describe("ConditionHandler", () => {
    it("should evaluate condition and return transition", async () => {
      const services = createMockServices();
      services.conditionEvaluator.evaluate = vi.fn().mockReturnValue("yes");

      const context = createMockContext(
        {
          id: "condition",
          data: {
            type: "condition",
            schemaVersion: 1,
            label: "Check Score",
            expression: "score > 50",
            rulesOperator: "and",
            branches: [
              { id: "yes", label: "Yes", isDefault: false },
              { id: "no", label: "No", isDefault: true },
            ],
          },
        },
        [
          { id: "edge-yes", source: "condition", target: "high", sourceHandle: "yes" },
          { id: "edge-no", source: "condition", target: "low", sourceHandle: "no" },
        ],
        services
      );

      const result = await conditionHandler.execute(context);

      expect(services.conditionEvaluator.evaluate).toHaveBeenCalled();
      expect(result).toEqual({
        action: "transition",
        targetNodeId: "high",
        trigger: "condition_yes",
      });
    });

    it("should fallback to first edge when no match", async () => {
      const services = createMockServices();
      services.conditionEvaluator.evaluate = vi.fn().mockReturnValue("unknown");

      const context = createMockContext(
        {
          id: "condition",
          data: {
            type: "condition",
            schemaVersion: 1,
            label: "Check",
            rulesOperator: "and",
            branches: [{ id: "default", label: "Default", isDefault: true }],
          },
        },
        [{ id: "edge-1", source: "condition", target: "fallback" }],
        services
      );

      const result = await conditionHandler.execute(context);

      expect(result).toEqual({
        action: "transition",
        targetNodeId: "fallback",
        trigger: "condition_unknown",
      });
    });
  });

  describe("WaitHandler", () => {
    it("should schedule timer for wait duration", async () => {
      const services = createMockServices();
      const context = createMockContext(
        {
          id: "wait",
          data: {
            type: "wait",
            schemaVersion: 1,
            label: "Wait",
            duration: { seconds: 60 },
          },
        },
        [{ id: "wait-edge", source: "wait", target: "next" }],
        services
      );

      const result = await waitHandler.execute(context);

      expect(services.timer.scheduleTimer).toHaveBeenCalledWith(60000, "wait-edge");
      expect(result).toEqual({ action: "wait" });
    });
  });

  describe("EndHandler", () => {
    it("should mark session as completed", async () => {
      const services = createMockServices();
      const context = createMockContext(
        {
          id: "end",
          data: {
            type: "end",
            schemaVersion: 1,
            label: "End",
            content: "Goodbye!",
          },
        },
        [],
        services
      );

      const result = await endHandler.execute(context);

      expect(context.session.status).toBe("completed");
      expect(context.session.completedAt).toBeDefined();
      expectSendMessage(services.messenger.sendMessage, "Goodbye!", undefined, undefined);
      expect(result).toEqual({ action: "complete" });
    });

    it("should NOT send message when content is empty string (clean terminal state)", async () => {
      const services = createMockServices();
      const context = createMockContext(
        {
          id: "end",
          data: {
            type: "end",
            schemaVersion: 1,
            label: "End",
            content: "",
          },
        },
        [],
        services
      );

      const result = await endHandler.execute(context);

      expect(context.session.status).toBe("completed");
      expect(context.session.completedAt).toBeDefined();
      // sendMessage should NOT be called with empty/falsy content
      expect(services.messenger.sendMessage).not.toHaveBeenCalled();
      expect(result).toEqual({ action: "complete" });
    });

    it("should NOT send message when content is undefined (clean terminal state)", async () => {
      const services = createMockServices();
      const context = createMockContext(
        {
          id: "end",
          data: {
            type: "end",
            schemaVersion: 1,
            label: "End",
            // no content - clean end node
          },
        },
        [],
        services
      );

      const result = await endHandler.execute(context);

      expect(context.session.status).toBe("completed");
      expect(context.session.completedAt).toBeDefined();
      // sendMessage should NOT be called without content
      expect(services.messenger.sendMessage).not.toHaveBeenCalled();
      expect(result).toEqual({ action: "complete" });
    });
  });

  describe("WebhookHandler", () => {
    it("should execute webhook and store result in session.context", async () => {
      const services = createMockServices();
      services.webhookExecutor.execute = vi.fn().mockResolvedValue({ data: "result" });

      const context = createMockContext(
        {
          id: "webhook",
          data: {
            type: "webhook",
            schemaVersion: 1,
            label: "API Call",
            url: "https://api.example.com/data",
            method: "GET",
            storeAs: "apiResult",
            errorHandling: "continue",
            retryCount: 0,
            timeoutMs: 5000,
          },
        },
        [{ id: "success-edge", source: "webhook", target: "next", edgeType: "success" }],
        services
      );

      const result = await webhookHandler.execute(context);

      expect(services.webhookExecutor.execute).toHaveBeenCalled();
      expect(context.session.nodeOutputs["API_Call"]).toBeDefined();
      expect(context.session.nodeOutputs["API_Call"].data).toEqual({ data: "result" });
      expect(result).toEqual({
        action: "transition",
        targetNodeId: "next",
        trigger: "webhook_success",
      });
    });

    it("should transition to success edge on success", async () => {
      const services = createMockServices();
      services.webhookExecutor.execute = vi.fn().mockResolvedValue({ success: true });

      const context = createMockContext(
        {
          id: "webhook",
          data: {
            type: "webhook",
            schemaVersion: 1,
            label: "API Call",
            url: "https://api.example.com/data",
            method: "POST",
            errorHandling: "continue",
            retryCount: 0,
            timeoutMs: 5000,
          },
        },
        [
          { id: "success-edge", source: "webhook", target: "success-node", edgeType: "success" },
          { id: "error-edge", source: "webhook", target: "error-node", edgeType: "retry" },
        ],
        services
      );

      const result = await webhookHandler.execute(context);

      expect(result).toEqual({
        action: "transition",
        targetNodeId: "success-node",
        trigger: "webhook_success",
      });
    });

    it("should handle errorHandling: continue - proceeds on error", async () => {
      const services = createMockServices();
      services.webhookExecutor.execute = vi.fn().mockRejectedValue(new Error("API Error"));

      const context = createMockContext(
        {
          id: "webhook",
          data: {
            type: "webhook",
            schemaVersion: 1,
            label: "API Call",
            url: "https://api.example.com/data",
            method: "POST",
            errorHandling: "continue",
            retryCount: 0,
            timeoutMs: 5000,
          },
        },
        [
          { id: "success-edge", source: "webhook", target: "success-node", edgeType: "success" },
          { id: "error-edge", source: "webhook", target: "error-node", edgeType: "retry" },
        ],
        services
      );

      const result = await webhookHandler.execute(context);

      // Should proceed to error edge, not fail
      expect(context.session.status).toBe("active");
      expect(result).toEqual({
        action: "transition",
        targetNodeId: "error-node",
        trigger: "webhook_error",
      });
    });

    it("should handle errorHandling: fail - sets session.status to dropped", async () => {
      const services = createMockServices();
      services.webhookExecutor.execute = vi.fn().mockRejectedValue(new Error("API Error"));

      const context = createMockContext(
        {
          id: "webhook",
          data: {
            type: "webhook",
            schemaVersion: 1,
            label: "API Call",
            url: "https://api.example.com/data",
            method: "POST",
            errorHandling: "fail",
            retryCount: 0,
            timeoutMs: 5000,
          },
        },
        [{ id: "success-edge", source: "webhook", target: "next", edgeType: "success" }],
        services
      );

      const result = await webhookHandler.execute(context);

      expect(context.session.status).toBe("dropped");
      expect(result).toEqual({ action: "complete" });
    });

    it("should return wait when no outgoing edges", async () => {
      const services = createMockServices();
      services.webhookExecutor.execute = vi.fn().mockResolvedValue({ success: true });

      const context = createMockContext(
        {
          id: "webhook",
          data: {
            type: "webhook",
            schemaVersion: 1,
            label: "API Call",
            url: "https://api.example.com/data",
            method: "GET",
            errorHandling: "continue",
            retryCount: 0,
            timeoutMs: 5000,
          },
        },
        [], // No outgoing edges
        services
      );

      const result = await webhookHandler.execute(context);

      expect(result).toEqual({ action: "wait" });
    });

    it("should log webhook executed event on success", async () => {
      const services = createMockServices();
      services.webhookExecutor.execute = vi.fn().mockResolvedValue({ data: "result" });

      const context = createMockContext(
        {
          id: "webhook",
          data: {
            type: "webhook",
            schemaVersion: 1,
            label: "API Call",
            url: "https://api.example.com/data",
            method: "POST",
            storeAs: "result",
            errorHandling: "continue",
            retryCount: 0,
            timeoutMs: 5000,
          },
        },
        [{ id: "success-edge", source: "webhook", target: "next", edgeType: "success" }],
        services
      );

      await webhookHandler.execute(context);

      expect(services.eventLogger.logEvent).toHaveBeenCalledWith({
        type: "webhook.executed",
        nodeId: "webhook",
        payload: expect.objectContaining({
          method: "POST",
          label: "API Call",
          webhookUrl: "https://api.example.com/data",
        }),
      });
    });

    it("should log error event on failure", async () => {
      const services = createMockServices();
      services.webhookExecutor.execute = vi.fn().mockRejectedValue(new Error("Connection failed"));

      const context = createMockContext(
        {
          id: "webhook",
          data: {
            type: "webhook",
            schemaVersion: 1,
            label: "API Call",
            url: "https://api.example.com/data",
            method: "POST",
            errorHandling: "continue",
            retryCount: 0,
            timeoutMs: 5000,
          },
        },
        [{ id: "edge", source: "webhook", target: "next" }],
        services
      );

      await webhookHandler.execute(context);

      expect(services.eventLogger.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "engine.error",
          nodeId: "webhook",
          payload: expect.objectContaining({
            error: "Connection failed",
            errorHandling: "continue",
          }),
        })
      );
    });
  });

  describe("StartHandler - Additional Edge Cases", () => {
    it("should send message with media attachment", async () => {
      const services = createMockServices();
      const context = createMockContext(
        {
          id: "start",
          data: {
            type: "start",
            schemaVersion: 1,
            label: "Start",
            content: "Welcome!",
            media: { type: "image", url: "https://example.com/image.jpg" },
          },
        },
        [],
        services
      );

      await startHandler.execute(context);

      expectSendMessage(services.messenger.sendMessage, "Welcome!", undefined, { type: "image", url: "https://example.com/image.jpg" });
    });
  });

  describe("MessageHandler - Additional Edge Cases", () => {
    it("should send message with media attachment", async () => {
      const services = createMockServices();
      const context = createMockContext(
        {
          id: "msg",
          data: {
            type: "message",
            schemaVersion: 2,
            contentFormat: "text",
            label: "Message",
            content: "Check this out!",
            media: { type: "video", url: "https://example.com/video.mp4" },
          },
        },
        [],
        services
      );

      await messageHandler.execute(context);

      expectSendMessage(services.messenger.sendMessage, "Check this out!", undefined, { type: "video", url: "https://example.com/video.mp4" });
    });
  });

  describe("ConditionHandler - Additional Edge Cases", () => {
    it("should handle empty branches by falling back to first edge", async () => {
      const services = createMockServices();
      services.conditionEvaluator.evaluate = vi.fn().mockReturnValue("nonexistent");

      const context = createMockContext(
        {
          id: "condition",
          data: {
            type: "condition",
            schemaVersion: 1,
            label: "Check",
            rulesOperator: "and",
            branches: [], // Empty branches
          },
        },
        [{ id: "edge-1", source: "condition", target: "fallback" }],
        services
      );

      const result = await conditionHandler.execute(context);

      expect(result).toEqual({
        action: "transition",
        targetNodeId: "fallback",
        trigger: "condition_nonexistent",
      });
    });
  });

  describe("Send Message Failure Handling", () => {
    describe("StartHandler - Message Failure", () => {
      it("should return wait and log error when sendMessage fails", async () => {
        const services = createMockServices();
        services.messenger.sendMessage = vi.fn().mockResolvedValue({
          success: false,
          error: "Network error",
        });

        const context = createMockContext(
          {
            id: "start",
            data: { type: "start", schemaVersion: 1, label: "Start", content: "Welcome!" },
          },
          [{ id: "edge-1", source: "start", target: "next", label: "Auto transition" }],
          services
        );

        const result = await startHandler.execute(context);

        expectSendMessage(services.messenger.sendMessage, "Welcome!", undefined, undefined);
        expect(context.log.error).toHaveBeenCalledWith(expect.objectContaining({ nodeId: "start", error: "Network error" }), "start:sendFailed");
        // Should stay on current node, not auto-transition
        expect(result).toEqual({ action: "wait" });
      });

      it("should not auto-transition when message fails even with default edge", async () => {
        const services = createMockServices();
        services.messenger.sendMessage = vi.fn().mockResolvedValue({
          success: false,
          error: "Telegram API timeout",
        });

        const context = createMockContext(
          {
            id: "start",
            data: { type: "start", schemaVersion: 1, label: "Start", content: "Hello" },
          },
          [{ id: "edge-1", source: "start", target: "next", edgeType: "default" }],
          services
        );

        const result = await startHandler.execute(context);

        // Even with a default edge, should wait because message failed
        expect(result).toEqual({ action: "wait" });
      });
    });

    describe("MessageHandler - Message Failure", () => {
      it("should throw error when sendMessage fails with no error edge", async () => {
        const services = createMockServices();
        services.messenger.sendMessage = vi.fn().mockResolvedValue({
          success: false,
          error: "Rate limit exceeded",
        });

        const context = createMockContext(
          {
            id: "msg",
            data: {
              type: "message",
              schemaVersion: 2,
              contentFormat: "text",
              label: "Message",
              content: "Choose an option",
              responseType: "buttons",
              buttons: [
                { id: "btn-a", text: "A", targetNodeId: "node-a" },
                { id: "btn-b", text: "B", targetNodeId: "node-b" },
              ],
            },
          },
          [],
          services
        );

        // Should throw error because no error edge is configured
        await expect(messageHandler.execute(context)).rejects.toThrow(
          "Message send failed (buttons mode): Rate limit exceeded"
        );
      });

      it("should throw error when message fails with auto responseType and no error edge", async () => {
        const services = createMockServices();
        services.messenger.sendMessage = vi.fn().mockResolvedValue({
          success: false,
          error: "Message too long",
        });

        const context = createMockContext(
          {
            id: "msg",
            data: {
              type: "message",
              schemaVersion: 2,
              contentFormat: "text",
              label: "Message",
              content: "Information",
              responseType: "auto",
            },
          },
          [{ id: "edge-1", source: "msg", target: "next", label: "Auto transition" }],
          services
        );

        // Should throw error because auto node failed and no error edge exists
        await expect(messageHandler.execute(context)).rejects.toThrow(
          "Message send failed (auto mode): Message too long"
        );
      });

      it("should transition to error edge when message fails with auto responseType", async () => {
        const services = createMockServices();
        services.messenger.sendMessage = vi.fn().mockResolvedValue({
          success: false,
          error: "Message too long",
        });

        const context = createMockContext(
          {
            id: "msg",
            data: {
              type: "message",
              schemaVersion: 2,
              contentFormat: "text",
              label: "Message",
              content: "Information",
              responseType: "auto",
            },
          },
          [
            { id: "edge-1", source: "msg", target: "next", label: "Auto transition" },
            { id: "edge-error", source: "msg", target: "error-handler", label: "Error" },
          ],
          services
        );

        const result = await messageHandler.execute(context);

        expect(result).toEqual({
          action: "transition",
          targetNodeId: "error-handler",
          trigger: "send_error",
        });
      });

      it("should throw error when message fails (preventing timer schedule)", async () => {
        const services = createMockServices();
        services.messenger.sendMessage = vi.fn().mockResolvedValue({
          success: false,
          error: "Network error",
        });

        const context = createMockContext(
          {
            id: "msg",
            data: {
              type: "message",
              schemaVersion: 2,
              contentFormat: "text",
              label: "Message",
              content: "Wait...",
              timer: { seconds: 30 },
            },
          },
          [{ id: "timer-edge", source: "msg", target: "timeout", edgeType: "timer" }],
          services
        );

        // Should throw error because auto node failed (default responseType is auto)
        await expect(messageHandler.execute(context)).rejects.toThrow(
          "Message send failed (auto mode): Network error"
        );

        // Timer should NOT be scheduled
        expect(services.timer.scheduleTimer).not.toHaveBeenCalled();
      });
    });

    describe("EndHandler - Message Failure", () => {
      it("should wait and not complete when farewell message fails", async () => {
        const services = createMockServices();
        services.messenger.sendMessage = vi.fn().mockResolvedValue({
          success: false,
          error: "User blocked bot",
        });

        const context = createMockContext(
          {
            id: "end",
            data: {
              type: "end",
              schemaVersion: 1,
              label: "End",
              content: "Goodbye!",
            },
          },
          [],
          services
        );

        const result = await endHandler.execute(context);

        // End handler should NOT complete if message fails - allow retry
        expect(context.session.status).toBe("active");
        expect(context.session.completedAt).toBeNull();
        expect(context.log.error).toHaveBeenCalledWith(expect.objectContaining({ nodeId: "end", error: "User blocked bot" }), "end:sendFailed");
        expect(result).toEqual({ action: "wait" });
      });

      it("should complete successfully when message sends", async () => {
        const services = createMockServices();
        services.messenger.sendMessage = vi.fn().mockResolvedValue({
          success: true,
          messageIds: [{ platformMessageId: "msg_1", messageType: "text" }],
        });

        const context = createMockContext(
          {
            id: "end",
            data: {
              type: "end",
              schemaVersion: 1,
              label: "End",
              content: "Goodbye!",
            },
          },
          [],
          services
        );

        const result = await endHandler.execute(context);

        // Should complete when message succeeds
        expect(context.session.status).toBe("completed");
        expect(context.session.completedAt).toBeDefined();
        expect(result).toEqual({ action: "complete" });
      });
    });
  });

  describe("QuestionnaireHandler", () => {
    // Helper to create a minimal valid question
    const createQuestion = (id: string, content: string, overrides = {}) => ({
      id,
      content,
      responseType: "text" as const,
      required: true,
      ...overrides,
    });

    // Helper to create minimal valid questionnaire node data
    const createQuestionnaireData = (questions: ReturnType<typeof createQuestion>[], overrides = {}) => ({
      type: "questionnaire" as const,
      schemaVersion: 1,
      label: "Survey",
      questions,
      allowBack: false,
      shuffle: false,
      ...overrides,
    });

    describe("execute() - Initialization", () => {
      it("should initialize state and send first question on first entry", async () => {
        const services = createMockServices();
        const context = createMockContext(
          {
            id: "questionnaire-1",
            data: createQuestionnaireData([
              createQuestion("q1", "What is your name?"),
              createQuestion("q2", "What is your favorite color?", {
                responseType: "buttons",
                buttons: [{ id: "b1", text: "Red" }, { id: "b2", text: "Blue" }],
              }),
            ]),
          },
          [],
          services
        );

        const result = await questionnaireHandler.execute(context);

        // Should initialize state in nodeOutputs
        expect(context.session.nodeOutputs["__state_questionnaire-1"]).toBeDefined();
        expect(context.session.nodeOutputs["__state_questionnaire-1"].data).toMatchObject({
          currentIndex: 0,
          questionOrder: ["q1", "q2"],
          responses: [],
          skipped: [],
        });

        // Should send first question (with progress indicator)
        expectSendMessage(services.messenger.sendMessage, "Question 1 of 2\n\nWhat is your name?", undefined, undefined);

        // Should return wait
        expect(result).toEqual({ action: "wait" });
      });

      it("should send introduction message if configured", async () => {
        const services = createMockServices();
        const context = createMockContext(
          {
            id: "questionnaire-1",
            data: createQuestionnaireData(
              [createQuestion("q1", "Question 1?")],
              { introduction: { content: "Welcome to our survey!" } }
            ),
          },
          [],
          services
        );

        await questionnaireHandler.execute(context);

        // First call should be introduction
        expectSendMessage(services.messenger.sendMessage, "Welcome to our survey!", undefined, undefined, 0);
        // Second call should be the question
        expectSendMessage(services.messenger.sendMessage, expect.stringContaining("Question 1?"), undefined, undefined, 1);
      });

      it("should schedule timeout timer if configured", async () => {
        const services = createMockServices();
        const context = createMockContext(
          {
            id: "questionnaire-1",
            data: createQuestionnaireData(
              [createQuestion("q1", "Question?")],
              { timeout: { seconds: 300 } }
            ),
          },
          [{ id: "timeout-edge", source: "questionnaire-1", target: "timeout-node", edgeType: "timer" }],
          services
        );

        await questionnaireHandler.execute(context);

        // Should schedule timer with correct delay (300 seconds = 300000 ms)
        expect(services.timer.scheduleTimer).toHaveBeenCalledWith(300000, "timeout-edge");

        // State should have timerId stored
        const state = context.session.nodeOutputs["__state_questionnaire-1"].data as { timerId: string };
        expect(state.timerId).toBe("timer-1");
      });

      it("should shuffle questions when shuffle is enabled", async () => {
        const services = createMockServices();
        const questions = Array.from({ length: 10 }, (_, i) =>
          createQuestion(`q${i}`, `Question ${i}?`)
        );

        const context = createMockContext(
          {
            id: "questionnaire-1",
            data: createQuestionnaireData(questions, { shuffle: true }),
          },
          [],
          services
        );

        await questionnaireHandler.execute(context);

        const state = context.session.nodeOutputs["__state_questionnaire-1"].data as { questionOrder: string[] };

        // Should have same questions but potentially in different order
        expect(state.questionOrder).toHaveLength(10);
        expect(new Set(state.questionOrder)).toEqual(new Set(questions.map((q) => q.id)));
      });
    });

    describe("execute() - Question Sending", () => {
      it("should send question with buttons when responseType is buttons", async () => {
        const services = createMockServices();
        const context = createMockContext(
          {
            id: "questionnaire-1",
            data: createQuestionnaireData([
              createQuestion("q1", "Pick one?", {
                responseType: "buttons",
                buttons: [
                  { id: "opt-a", text: "Option A" },
                  { id: "opt-b", text: "Option B" },
                ],
              }),
            ]),
          },
          [],
          services
        );

        await questionnaireHandler.execute(context);

        expectSendMessage(
          services.messenger.sendMessage,
          "Question 1 of 1\n\nPick one?",
          [
            { id: "opt-a", text: "Option A" },
            { id: "opt-b", text: "Option B" },
          ],
          undefined
        );
      });

      it("should set activeButtons with source 'questionnaire' when sending buttons", async () => {
        const services = createMockServices();
        const context = createMockContext(
          {
            id: "questionnaire-1",
            data: createQuestionnaireData([
              createQuestion("q1", "What is your preference?", {
                responseType: "buttons",
                buttons: [
                  { id: "opt-a", text: "Option A" },
                  { id: "opt-b", text: "Option B" },
                  { id: "opt-c", text: "Option C" },
                ],
              }),
            ]),
          },
          [],
          services
        );

        await questionnaireHandler.execute(context);

        // activeButtons should be set with source 'questionnaire'
        expect(context.session.activeButtons).toBeDefined();
        expect(context.session.activeButtons).toHaveLength(3);
        expect(context.session.activeButtons).toEqual([
          { id: "opt-a", text: "Option A", targetNodeId: "questionnaire-1", source: "questionnaire" },
          { id: "opt-b", text: "Option B", targetNodeId: "questionnaire-1", source: "questionnaire" },
          { id: "opt-c", text: "Option C", targetNodeId: "questionnaire-1", source: "questionnaire" },
        ]);
      });

      it("should add back button when allowBack is true and not on first question", async () => {
        const services = createMockServices();
        const context = createMockContext(
          {
            id: "questionnaire-1",
            data: createQuestionnaireData([
              createQuestion("q1", "Q1?"),
              createQuestion("q2", "Q2?", {
                responseType: "buttons",
                buttons: [{ id: "yes", text: "Yes" }],
              }),
            ], {
              allowBack: true,
            }),
          },
          [],
          services
        );

        // Set up state as if we're on question 2 (uses __state_ prefix pattern)
        context.session.nodeOutputs = {
          "__state_questionnaire-1": {
            nodeId: "questionnaire-1",
            nodeLabel: "__state_questionnaire-1",
            nodeType: "questionnaire",
            executedAt: new Date().toISOString(),
            data: {
              currentIndex: 1,
              questionOrder: ["q1", "q2"],
              responses: [{ questionId: "q1", value: "John", timestamp: new Date().toISOString() }],
              skipped: [],
              startedAt: new Date().toISOString(),
            },
          },
        };

        await questionnaireHandler.execute(context);

        // Should include back button
        expectSendMessage(
          services.messenger.sendMessage,
          "Question 2 of 2\n\nQ2?",
          [
            { id: "__back__", text: "← Back" },
            { id: "yes", text: "Yes" },
          ],
          undefined
        );
      });

      it("should include hint in question text when present", async () => {
        const services = createMockServices();
        const context = createMockContext(
          {
            id: "questionnaire-1",
            data: createQuestionnaireData([
              createQuestion("q1", "What is your email?", {
                hint: "Enter a valid email address",
              }),
            ]),
          },
          [],
          services
        );

        await questionnaireHandler.execute(context);

        expectSendMessage(
          services.messenger.sendMessage,
          expect.stringContaining("_Enter a valid email address_"),
          undefined,
          undefined
        );
      });
    });

    describe("execute() - Skip Conditions", () => {
      it("should skip question when skipIf condition evaluates to true", async () => {
        const services = createMockServices();
        const context = createMockContext(
          {
            id: "questionnaire-1",
            data: createQuestionnaireData([
              createQuestion("q1", "Do you have a team?"),
              createQuestion("q2", "Team size?", { skipIf: "hasTeam == 'no'" }),
              createQuestion("q3", "Budget?"),
            ]),
          },
          [],
          services
        );

        // Set up state: answered q1 with "no", now on q2 (uses __state_ prefix pattern)
        context.session.nodeOutputs = {
          "__state_questionnaire-1": {
            nodeId: "questionnaire-1",
            nodeLabel: "__state_questionnaire-1",
            nodeType: "questionnaire",
            executedAt: new Date().toISOString(),
            data: {
              currentIndex: 1,
              questionOrder: ["q1", "q2", "q3"],
              responses: [{ questionId: "q1", value: "no", timestamp: new Date().toISOString() }],
              skipped: [],
              startedAt: new Date().toISOString(),
            },
          },
        };

        // hasTeam is stored in context
        context.session.context = { hasTeam: "no" };

        await questionnaireHandler.execute(context);

        // Should skip q2 and send q3
        expectSendMessage(
          services.messenger.sendMessage,
          expect.stringContaining("Budget?"),
          undefined,
          undefined
        );

        // State should have q2 in skipped
        const state = context.session.nodeOutputs["__state_questionnaire-1"].data as { skipped: string[]; currentIndex: number };
        expect(state.skipped).toContain("q2");
        expect(state.currentIndex).toBe(2);
      });

      it("should not skip question when variable is undefined", async () => {
        const services = createMockServices();
        const context = createMockContext(
          {
            id: "questionnaire-1",
            data: createQuestionnaireData([
              createQuestion("q1", "First question?", { skipIf: "someVar == 'skip'" }),
            ]),
          },
          [],
          services
        );

        // context has no someVar
        context.session.context = {};

        await questionnaireHandler.execute(context);

        // Should send the question (not skip)
        expectSendMessage(
          services.messenger.sendMessage,
          "Question 1 of 1\n\nFirst question?",
          undefined,
          undefined
        );
      });
    });

    describe("execute() - Completion", () => {
      it("should send completion message and transition when all questions answered", async () => {
        const services = createMockServices();
        const context = createMockContext(
          {
            id: "questionnaire-1",
            data: createQuestionnaireData([
              createQuestion("q1", "Q?"),
            ], { completion: { content: "Thank you!", delayBeforeTransition: 0 } }),
          },
          [{ id: "complete-edge", source: "questionnaire-1", target: "next-node", edgeType: "default" }],
          services
        );

        // Set up state: all questions answered (uses __state_ prefix pattern)
        context.session.nodeOutputs = {
          "__state_questionnaire-1": {
            nodeId: "questionnaire-1",
            nodeLabel: "__state_questionnaire-1",
            nodeType: "questionnaire",
            executedAt: new Date().toISOString(),
            data: {
              currentIndex: 1, // Past the last question
              questionOrder: ["q1"],
              responses: [{ questionId: "q1", value: "answer", timestamp: new Date().toISOString() }],
              skipped: [],
              startedAt: new Date().toISOString(),
            },
          },
        };

        const result = await questionnaireHandler.execute(context);

        // Should send completion message
        expectSendMessage(services.messenger.sendMessage, "Thank you!", undefined, undefined);

        // Should transition to next node
        expect(result).toEqual({
          action: "transition",
          targetNodeId: "next-node",
          trigger: "questionnaire_complete",
        });
      });

      it("should store consolidated responses when storeAllAs is configured", async () => {
        const services = createMockServices();
        const context = createMockContext(
          {
            id: "questionnaire-1",
            data: createQuestionnaireData([
              createQuestion("q1", "Name?"),
              createQuestion("q2", "Age?"),
            ], { storeAllAs: "surveyResponses" }),
          },
          [{ id: "edge", source: "questionnaire-1", target: "next", edgeType: "default" }],
          services
        );

        // Set up completed state (uses __state_ prefix pattern)
        context.session.nodeOutputs = {
          "__state_questionnaire-1": {
            nodeId: "questionnaire-1",
            nodeLabel: "__state_questionnaire-1",
            nodeType: "questionnaire",
            executedAt: new Date().toISOString(),
            data: {
              currentIndex: 2,
              questionOrder: ["q1", "q2"],
              responses: [
                { questionId: "q1", value: "Alice", timestamp: new Date().toISOString() },
                { questionId: "q2", value: "30", timestamp: new Date().toISOString() },
              ],
              skipped: [],
              startedAt: new Date().toISOString(),
            },
          },
        };

        await questionnaireHandler.execute(context);

        // Should store enriched responses in session context
        const responses = context.session.context?.surveyResponses as Record<string, { answer: string; questionText: string }> | undefined;
        expect(responses?.q1.answer).toBe("Alice");
        expect(responses?.q1.questionText).toBe("Name?");
        expect(responses?.q2.answer).toBe("30");
        expect(responses?.q2.questionText).toBe("Age?");
      });

      it("should cancel timeout timer on completion", async () => {
        const services = createMockServices();
        const context = createMockContext(
          {
            id: "questionnaire-1",
            data: createQuestionnaireData([
              createQuestion("q1", "Q?"),
            ], { timeout: { seconds: 300 } }),
          },
          [{ id: "edge", source: "questionnaire-1", target: "next", edgeType: "default" }],
          services
        );

        // Set up completed state with timer (uses __state_ prefix pattern)
        context.session.nodeOutputs = {
          "__state_questionnaire-1": {
            nodeId: "questionnaire-1",
            nodeLabel: "__state_questionnaire-1",
            nodeType: "questionnaire",
            executedAt: new Date().toISOString(),
            data: {
              currentIndex: 1,
              questionOrder: ["q1"],
              responses: [{ questionId: "q1", value: "done", timestamp: new Date().toISOString() }],
              skipped: [],
              startedAt: new Date().toISOString(),
              timerId: "timer-abc",
            },
          },
        };

        await questionnaireHandler.execute(context);

        // Timer should be cancelled
        expect(services.timer.cancelTimer).toHaveBeenCalledWith("timer-abc");
      });
    });

    describe("handleQuestionnaireResponse()", () => {
      it("should store response and advance to next question", () => {
        const state = {
          currentIndex: 0,
          questionOrder: ["q1", "q2"],
          responses: [] as { questionId: string; value: string; timestamp: string }[],
          skipped: [] as string[],
          startedAt: new Date().toISOString(),
        };

        const nodeData = {
          type: "questionnaire" as const,
          schemaVersion: 1,
          label: "Survey",
          questions: [
            { id: "q1", content: "Q1?", responseType: "text" as const, required: true },
            { id: "q2", content: "Q2?", responseType: "text" as const, required: true },
          ],
          allowBack: false,
          shuffle: false,
        };

        const result = handleQuestionnaireResponse(
          state,
          nodeData,
          { type: "text_message", text: "My answer" }
        );

        expect(result.action).toBe("continue");
        expect(result.response?.questionId).toBe("q1");
        expect(result.response?.value).toBe("My answer");
        expect(state.responses).toHaveLength(1);
        expect(state.currentIndex).toBe(1);
      });

      it("should store button click response with buttonId", () => {
        const state = {
          currentIndex: 0,
          questionOrder: ["q1"],
          responses: [] as { questionId: string; value: string; timestamp: string }[],
          skipped: [] as string[],
          startedAt: new Date().toISOString(),
        };

        const nodeData = {
          type: "questionnaire" as const,
          schemaVersion: 1,
          label: "Survey",
          questions: [
            {
              id: "q1",
              content: "Q1?",
              responseType: "buttons" as const,
              required: true,
              buttons: [{ id: "opt-a", text: "Option A" }],
            },
          ],
          allowBack: false,
          shuffle: false,
        };

        const result = handleQuestionnaireResponse(
          state,
          nodeData,
          { type: "button_click", buttonId: "opt-a" }
        );

        expect(result.response?.buttonId).toBe("opt-a");
        expect(result.response?.value).toBe("opt-a");
      });

      it("should store response in session context when storeResponseAs is configured", () => {
        const state = {
          currentIndex: 0,
          questionOrder: ["q1"],
          responses: [] as { questionId: string; value: string; timestamp: string }[],
          skipped: [] as string[],
          startedAt: new Date().toISOString(),
        };

        const nodeData = {
          type: "questionnaire" as const,
          schemaVersion: 1,
          label: "Survey",
          questions: [
            { id: "q1", content: "Your name?", responseType: "text" as const, required: true, storeResponseAs: "userName" },
          ],
          allowBack: false,
          shuffle: false,
        };

        const result = handleQuestionnaireResponse(
          state,
          nodeData,
          { type: "text_message", text: "Alice" }
        );

        // Context updates are now returned for caller to apply via stateManager
        expect(result.contextUpdate).toEqual({ key: "userName", value: "Alice" });
      });

      it("should go back when __back__ button is clicked", () => {
        const state = {
          currentIndex: 1,
          questionOrder: ["q1", "q2"],
          responses: [{ questionId: "q1", value: "answer1", timestamp: new Date().toISOString() }],
          skipped: [] as string[],
          startedAt: new Date().toISOString(),
        };

        const nodeData = {
          type: "questionnaire" as const,
          schemaVersion: 1,
          label: "Survey",
          questions: [
            { id: "q1", content: "Q1?", responseType: "text" as const, required: true },
            { id: "q2", content: "Q2?", responseType: "text" as const, required: true },
          ],
          allowBack: true,
          shuffle: false,
        };

        const result = handleQuestionnaireResponse(
          state,
          nodeData,
          { type: "button_click", buttonId: "__back__" }
        );

        expect(result.action).toBe("back");
        expect(state.currentIndex).toBe(0);
        expect(state.responses).toHaveLength(0);
      });

      it("should not go back past the first question", () => {
        const state = {
          currentIndex: 0,
          questionOrder: ["q1", "q2"],
          responses: [] as { questionId: string; value: string; timestamp: string }[],
          skipped: [] as string[],
          startedAt: new Date().toISOString(),
        };

        const nodeData = {
          type: "questionnaire" as const,
          schemaVersion: 1,
          label: "Survey",
          questions: [
            { id: "q1", content: "Q1?", responseType: "text" as const, required: true },
            { id: "q2", content: "Q2?", responseType: "text" as const, required: true },
          ],
          allowBack: true,
          shuffle: false,
        };

        const result = handleQuestionnaireResponse(
          state,
          nodeData,
          { type: "button_click", buttonId: "__back__" }
        );

        expect(result.action).toBe("back");
        expect(state.currentIndex).toBe(0); // Should stay at 0
      });

      it("should return validation_failed when text is too short", () => {
        const state = {
          currentIndex: 0,
          questionOrder: ["q1"],
          responses: [],
          skipped: [],
          startedAt: new Date().toISOString(),
        };

        const nodeData = {
          type: "questionnaire" as const,
          schemaVersion: 1,
          label: "Survey",
          questions: [
            {
              id: "q1",
              content: "Enter your name",
              responseType: "text" as const,
              required: true,
              validation: { minLength: 5 },
            },
          ],
          allowBack: false,
          shuffle: false,
        };

        const result = handleQuestionnaireResponse(
          state,
          nodeData,
          { type: "text_message", text: "Hi" } // 2 chars, less than minLength 5
        );

        expect(result.action).toBe("validation_failed");
        expect(result.validationError).toBeDefined();
        expect(state.currentIndex).toBe(0); // Should NOT advance
        expect(state.responses).toHaveLength(0); // Response NOT stored
      });

      it("should return validation_failed when text is too long", () => {
        const state = {
          currentIndex: 0,
          questionOrder: ["q1"],
          responses: [],
          skipped: [],
          startedAt: new Date().toISOString(),
        };

        const nodeData = {
          type: "questionnaire" as const,
          schemaVersion: 1,
          label: "Survey",
          questions: [
            {
              id: "q1",
              content: "Enter a short code",
              responseType: "text" as const,
              required: true,
              validation: { maxLength: 5 },
            },
          ],
          allowBack: false,
          shuffle: false,
        };

        const result = handleQuestionnaireResponse(
          state,
          nodeData,
          { type: "text_message", text: "TOOLONGVALUE" } // 12 chars, more than maxLength 5
        );

        expect(result.action).toBe("validation_failed");
        expect(result.validationError).toBeDefined();
        expect(state.currentIndex).toBe(0);
        expect(state.responses).toHaveLength(0);
      });

      it("should return validation_failed when regex pattern does not match", () => {
        const state = {
          currentIndex: 0,
          questionOrder: ["q1"],
          responses: [],
          skipped: [],
          startedAt: new Date().toISOString(),
        };

        const nodeData = {
          type: "questionnaire" as const,
          schemaVersion: 1,
          label: "Survey",
          questions: [
            {
              id: "q1",
              content: "Enter your email",
              responseType: "text" as const,
              required: true,
              validation: { pattern: "^[\\w.-]+@[\\w.-]+\\.\\w+$" },
            },
          ],
          allowBack: false,
          shuffle: false,
        };

        const result = handleQuestionnaireResponse(
          state,
          nodeData,
          { type: "text_message", text: "not-an-email" }
        );

        expect(result.action).toBe("validation_failed");
        expect(result.validationError).toBeDefined();
      });

      it("should pass validation when all rules are satisfied", () => {
        const state = {
          currentIndex: 0,
          questionOrder: ["q1"],
          responses: [],
          skipped: [],
          startedAt: new Date().toISOString(),
        };

        const nodeData = {
          type: "questionnaire" as const,
          schemaVersion: 1,
          label: "Survey",
          questions: [
            {
              id: "q1",
              content: "Enter your email",
              responseType: "text" as const,
              required: true,
              validation: {
                minLength: 5,
                maxLength: 50,
                pattern: "^[\\w.-]+@[\\w.-]+\\.\\w+$",
              },
            },
          ],
          allowBack: false,
          shuffle: false,
        };

        const result = handleQuestionnaireResponse(
          state,
          nodeData,
          { type: "text_message", text: "test@example.com" }
        );

        expect(result.action).toBe("continue");
        expect(result.response).toBeDefined();
        expect(result.response?.value).toBe("test@example.com");
        expect(state.currentIndex).toBe(1); // Should advance
        expect(state.responses).toHaveLength(1);
      });

      it("should use custom errorMessage when provided", () => {
        const state = {
          currentIndex: 0,
          questionOrder: ["q1"],
          responses: [],
          skipped: [],
          startedAt: new Date().toISOString(),
        };

        const customError = "Please enter at least 5 characters for your name";
        const nodeData = {
          type: "questionnaire" as const,
          schemaVersion: 1,
          label: "Survey",
          questions: [
            {
              id: "q1",
              content: "Enter your name",
              responseType: "text" as const,
              required: true,
              validation: { minLength: 5, errorMessage: customError },
            },
          ],
          allowBack: false,
          shuffle: false,
        };

        const result = handleQuestionnaireResponse(
          state,
          nodeData,
          { type: "text_message", text: "Hi" }
        );

        expect(result.action).toBe("validation_failed");
        expect(result.validationError).toBe(customError);
      });

      it("should skip validation for button responses", () => {
        const state = {
          currentIndex: 0,
          questionOrder: ["q1"],
          responses: [],
          skipped: [],
          startedAt: new Date().toISOString(),
        };

        const nodeData = {
          type: "questionnaire" as const,
          schemaVersion: 1,
          label: "Survey",
          questions: [
            {
              id: "q1",
              content: "Choose an option",
              responseType: "buttons" as const,
              required: true,
              buttons: [
                { id: "a", text: "A" },
                { id: "b", text: "B" },
              ],
              // Validation rules that would normally fail
              validation: { minLength: 100 },
            },
          ],
          allowBack: false,
          shuffle: false,
        };

        const result = handleQuestionnaireResponse(
          state,
          nodeData,
          { type: "button_click", buttonId: "a" } // Button click, not text
        );

        // Should pass - validation is skipped for button clicks
        expect(result.action).toBe("continue");
        expect(result.response?.value).toBe("a");
      });
    });
  });
});
