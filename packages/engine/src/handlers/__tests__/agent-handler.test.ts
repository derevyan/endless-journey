/**
 * Agent Handler Tests
 *
 * Tests for AI agent node handler with workflow-only execution.
 * The agent node delegates all logic to Agent Workflows.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Import after mocks are set up
import { agentHandler } from "../types/agent";
import { createSessionStateManager } from "../../state/session-state-manager";
import type { ExecutionContext } from "../../types";
import type { AgentNodeData, AgentWorkflow } from "@journey/schemas";
import { createStateMethods } from "../../utils";

// Default mock workflow
const mockWorkflow: AgentWorkflow = {
  id: "workflow-id-123",
  orgId: "test-org-id",
  key: "test-workflow",
  name: "Test Workflow",
  status: "active",
  configuration: {
    nodes: [
      { id: "start", type: "start", position: { x: 0, y: 0 }, data: {} },
      { id: "agent-1", type: "agent", position: { x: 100, y: 0 }, data: { name: "Test Agent" } },
      { id: "end", type: "end", position: { x: 200, y: 0 }, data: {} },
    ],
    edges: [
      { id: "e1", source: "start", target: "agent-1" },
      { id: "e2", source: "agent-1", target: "end" },
    ],
  },
  settings: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Default mock workflow result
const mockWorkflowResult = {
  success: true,
  blocked: false,
  response: "Hello from workflow!",
  toolCalls: [],
  trace: [{ nodeId: "agent-1", nodeType: "agent", durationMs: 100, outHandle: undefined }],
  totalDurationMs: 150,
  variables: {},
};

const mockLoadWorkflow = vi.fn();
const mockRunWorkflow = vi.fn();
const mockInitialize = vi.fn();

/**
 * Create a mock session history event
 */
function createHistoryEvent(
  type: "user.message" | "engine.message",
  text: string
) {
  return {
    id: `event-${Math.random().toString(36).slice(2)}`,
    nodeId: "test-agent-node",
    type,
    payload: type === "engine.message" ? { content: text } : { text },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Create mock execution context for agent node
 */
function createMockContext(nodeData: Partial<AgentNodeData> = {}): ExecutionContext {
  const defaultNodeData: AgentNodeData = {
    type: "agent",
    schemaVersion: 1,
    label: "Test Agent",
    workflowKey: "test-workflow",
    executionMode: "immediate",
    ...nodeData,
  };

  const session = {
    sessionId: "test-session-id",
    userId: "test-user-id",
    platformUserId: "test-user-id",
    journeyId: "test-journey-id",
    currentNodeId: "test-agent-node",
    context: {},
    nodeOutputs: {},
    tags: [],
    status: "active" as const,
    pendingTimers: [],
    pendingFollowUps: [],
    pendingPluginFollowUps: [],
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null,
    hasStarted: false,
    history: [createHistoryEvent("user.message", "Hello")],
  };

  const stateManager = createSessionStateManager(session);

  return {
    node: {
      id: "test-agent-node",
      type: "custom",
      data: defaultNodeData,
      position: { x: 0, y: 0 },
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: "1.0.0",
        status: "active",
      },
    },
    session,
    stateManager,
    services: {
      variable: {
        getAll: vi.fn().mockResolvedValue({}),
        executeAction: vi.fn().mockResolvedValue(undefined),
      },
      messenger: {
        sendMessage: vi.fn().mockResolvedValue(undefined),
      },
      timer: {
        scheduleTimer: vi.fn().mockResolvedValue("timer-id"),
        cancelTimer: vi.fn().mockResolvedValue(undefined),
      },
      template: {
        substitute: vi.fn((template: string) => template),
      },
      mindstate: {
        getParameters: vi.fn().mockResolvedValue({}),
      },
      conversationHistory: {
        buildFromEvents: vi.fn((events: any[]) => {
          // Convert InteractionEvent[] to ConversationMessage[]
          return events.map((event: any) => ({
            role: event.type === "user.message" ? "user" : "assistant",
            content:
              event.type === "user.message"
                ? (event.payload as any).text || ""
                : (event.payload as any).content || "",
            timestamp: new Date(event.timestamp),
          }));
        }),
        getLastUserMessage: vi.fn((history) => {
          // Find last user message
          if (!history || history.length === 0) return "";
          for (let i = history.length - 1; i >= 0; i--) {
            if (history[i].role === "user") {
              return history[i].content;
            }
          }
          return "";
        }),
        hasRecentUserMessage: vi.fn((history) => {
          if (!history || history.length === 0) return false;
          return history[history.length - 1].role === "user";
        }),
      },
      agentWorkflow: {
        initialize: mockInitialize,
        loadWorkflow: mockLoadWorkflow,
        runWorkflow: mockRunWorkflow,
      },
      eventLogger: {
        logEvent: vi.fn(),
      },
      has: vi.fn().mockReturnValue(false),
    } as any,
    log: {
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as any,
    journey: {
      nodes: [],
      edges: [],
    },
    outgoingEdges: [
      {
        id: "completion-edge",
        source: "test-agent-node",
        target: "next-node",
        edgeType: "default",
      },
    ],
    clientData: {
      id: "test-user-id",
      platform: "telegram",
      firstName: "Test",
      lastName: "User",
      username: "testuser",
    },
    organizationId: "test-org-id",
    ...createStateMethods(session, "test-agent-node", "agent", stateManager),
  };
}

describe("Agent Handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockLoadWorkflow.mockResolvedValue(mockWorkflow);
    mockRunWorkflow.mockResolvedValue(mockWorkflowResult);
  });

  describe("Workflow Loading", () => {
    it("should throw error when workflowKey is missing", async () => {
      const context = createMockContext({ workflowKey: "" });

      await expect(agentHandler.execute(context)).rejects.toThrow("Agent node requires workflowKey");
    });

    it("should throw error when executionMode is missing", async () => {
      const context = createMockContext({ executionMode: undefined as any });

      await expect(agentHandler.execute(context)).rejects.toThrow("requires executionMode field");
    });

    it("should throw error when workflow is not found", async () => {
      mockLoadWorkflow.mockResolvedValueOnce(null);

      const context = createMockContext({ workflowKey: "non-existent" });

      await expect(agentHandler.execute(context)).rejects.toThrow("Workflow not found: non-existent");
    });

    it("should throw error when workflow is not active", async () => {
      mockLoadWorkflow.mockResolvedValueOnce({ ...mockWorkflow, status: "draft" });

      const context = createMockContext({ workflowKey: "draft-workflow" });

      await expect(agentHandler.execute(context)).rejects.toThrow(
        'Workflow "draft-workflow" is not active'
      );
    });

    it("should load workflow by key from database", async () => {
      const context = createMockContext();
      await agentHandler.execute(context);

      expect(mockLoadWorkflow).toHaveBeenCalledWith({
        organizationId: "test-org-id",
        workflowKey: "test-workflow",
      });
    });
  });

  describe("Workflow Execution", () => {
    it("should execute workflow with conversation history", async () => {
      const context = createMockContext();

      // Add more history events
      context.session.history = [
        createHistoryEvent("user.message", "Hello"),
        createHistoryEvent("engine.message", "Hi there!"),
        createHistoryEvent("user.message", "How are you?"),
      ];

      await agentHandler.execute(context);

      // Verify runWorkflow was called
      expect(mockRunWorkflow).toHaveBeenCalled();

      // Check conversation history was passed
      const callArgs = mockRunWorkflow.mock.calls[0][0];
      const input = callArgs.input;
      expect(input.conversationHistory).toHaveLength(3);
      expect(input.conversationHistory![0]).toMatchObject({ role: "user", content: "Hello" });
      expect(input.conversationHistory![1]).toMatchObject({ role: "assistant", content: "Hi there!" });
      expect(input.conversationHistory![2]).toMatchObject({ role: "user", content: "How are you?" });
    });

    it("should pass last message via conversationHistory (not message field)", async () => {
      // Architectural design: conversationHistory is the single source of truth.
      // The `message` field is only used for EXTERNAL inputs (templates, overrides).
      // Normal user messages are already in conversationHistory, so message = ""
      // to prevent duplicates being sent to the LLM.
      const context = createMockContext();

      context.session.history = [
        createHistoryEvent("user.message", "First message"),
        createHistoryEvent("user.message", "Last message"),
      ];

      await agentHandler.execute(context);

      const callArgs = mockRunWorkflow.mock.calls[0][0];
      const input = callArgs.input;
      // message is empty because the user's message is already in conversationHistory
      expect(input.message).toBe("");
      // The last message IS in conversationHistory where it belongs
      expect(input.conversationHistory).toHaveLength(2);
      expect(input.conversationHistory![1]).toMatchObject({ role: "user", content: "Last message" });
    });

    it("should include journey context in workflow context", async () => {
      const context = createMockContext();
      context.session.context = { testVar: "testValue" };
      context.session.tags = ["tag1", "tag2"];

      await agentHandler.execute(context);

      const callArgs = mockRunWorkflow.mock.calls[0][0];
      const workflowContext = callArgs.context;
      expect(workflowContext.journey?.variables).toEqual({ testVar: "testValue" });
      expect(workflowContext.journey?.tags).toEqual(["tag1", "tag2"]);
    });

    it("should inject services into workflow context", async () => {
      const context = createMockContext();

      await agentHandler.execute(context);

      const callArgs = mockRunWorkflow.mock.calls[0][0];
      const workflowContext = callArgs.context;
      expect(workflowContext.services?.variable).toBeDefined();
      expect(workflowContext.services?.messenger).toBeDefined();
      expect(workflowContext.services?.mindstate).toBeDefined();
    });
  });

  describe("Response Handling", () => {
    it("should send workflow response to user", async () => {
      mockRunWorkflow.mockResolvedValueOnce({
        ...mockWorkflowResult,
        response: "Workflow says hello!",
      });

      const context = createMockContext();
      await agentHandler.execute(context);

      expect(context.services.messenger.sendMessage).toHaveBeenCalledWith(
        "Workflow says hello!",
        undefined,
        undefined,
        undefined,
        undefined
      );
    });

    it("should wait for more input when exit not requested", async () => {
      // Default mock has no exit_to_next_node tool call
      const context = createMockContext();
      const result = await agentHandler.execute(context);

      // Should wait for next user message (multi-turn conversation)
      expect(result.action).toBe("wait");
    });

    it("should transition to next node when exit_to_next_node is called", async () => {
      // Mock workflow result with exit_to_next_node tool call
      mockRunWorkflow.mockResolvedValueOnce({
        ...mockWorkflowResult,
        exitRequested: true,
        toolCalls: [{ name: "exit_to_next_node", args: {} }],
      });

      const context = createMockContext();
      const result = await agentHandler.execute(context);

      expect(result.action).toBe("transition");
      expect((result as any).targetNodeId).toBe("next-node");
      expect((result as any).trigger).toBe("workflow_complete");
    });

    it("should transition when exitRequested flag is true (primary detection)", async () => {
      // Mock workflow result with explicit exitRequested flag
      mockRunWorkflow.mockResolvedValueOnce({
        ...mockWorkflowResult,
        exitRequested: true,
        toolCalls: [], // Empty toolCalls - should still work!
      });

      const context = createMockContext();
      const result = await agentHandler.execute(context);

      expect(result.action).toBe("transition");
      expect((result as any).targetNodeId).toBe("next-node");
    });

    it("should transition when exitRequested is true with empty response", async () => {
      // Model returns only tool calls with empty content
      mockRunWorkflow.mockResolvedValueOnce({
        ...mockWorkflowResult,
        response: "", // Empty response
        exitRequested: true,
        toolCalls: [],
      });

      const context = createMockContext();
      const result = await agentHandler.execute(context);

      expect(result.action).toBe("transition");
    });

    it("should send response AND transition when exitRequested with DEFERRED timing", async () => {
      // Simulates: LLM calls __final_response__ + exit_to_next_node (deferred)
      // When exit is DEFERRED ("After response"), message should be sent first
      mockRunWorkflow.mockResolvedValueOnce({
        ...mockWorkflowResult,
        response: '{"response":"Thank you! Proceeding to next step..."}',
        exitRequested: true,
        toolCalls: [],
        // exit_to_next_node in deferredToolCalls = DEFERRED timing
        deferredToolCalls: [{ name: "exit_to_next_node", args: {}, toolCallId: "tc-1", execute: vi.fn() }],
      });

      const context = createMockContext();
      const result = await agentHandler.execute(context);

      // Should send the message (parsed from structured response)
      expect(context.services.messenger.sendMessage).toHaveBeenCalledWith(
        "Thank you! Proceeding to next step...",
        undefined,
        undefined,
        undefined,
        undefined
      );
      // AND should transition
      expect(result.action).toBe("transition");
    });

    it("should NOT send response when exitRequested with IMMEDIATE timing", async () => {
      // Simulates: LLM calls __final_response__ + exit_to_next_node (immediate)
      // When exit is IMMEDIATE ("Before response"), message should be SKIPPED
      mockRunWorkflow.mockResolvedValueOnce({
        ...mockWorkflowResult,
        response: '{"response":"Thank you! Proceeding to next step..."}',
        exitRequested: true,
        toolCalls: [],
        // NO exit_to_next_node in deferredToolCalls = IMMEDIATE timing
        deferredToolCalls: [],
      });

      const context = createMockContext();
      const result = await agentHandler.execute(context);

      // Should NOT send the message (exit was immediate = "Before response")
      expect(context.services.messenger.sendMessage).not.toHaveBeenCalled();
      // But SHOULD still transition
      expect(result.action).toBe("transition");
    });

    it("should NOT send response when exitRequested with IMMEDIATE timing (undefined deferredToolCalls)", async () => {
      // When deferredToolCalls is undefined, it means no tools were deferred
      // This implies exit_to_next_node was executed immediately
      mockRunWorkflow.mockResolvedValueOnce({
        ...mockWorkflowResult,
        response: '{"response":"Thank you! Proceeding to next step..."}',
        exitRequested: true,
        toolCalls: [],
        // deferredToolCalls: undefined = IMMEDIATE timing (no deferred tools)
      });

      const context = createMockContext();
      const result = await agentHandler.execute(context);

      // Should NOT send the message (exit was immediate)
      expect(context.services.messenger.sendMessage).not.toHaveBeenCalled();
      // But SHOULD still transition
      expect(result.action).toBe("transition");
    });

    it("should wait when workflow is blocked", async () => {
      mockRunWorkflow.mockResolvedValueOnce({
        ...mockWorkflowResult,
        success: false,
        blocked: true,
        blockedMessage: "Request blocked by safety guard",
      });

      const context = createMockContext();
      const result = await agentHandler.execute(context);

      expect(result.action).toBe("wait");
      expect(context.services.messenger.sendMessage).toHaveBeenCalledWith(
        "Request blocked by safety guard",
        undefined,
        undefined,
        undefined,
        undefined
      );
    });

    it("should wait when no outgoing edges exist", async () => {
      const context = createMockContext();
      context.outgoingEdges = [];

      const result = await agentHandler.execute(context);

      expect(result.action).toBe("wait");
    });

    it("should filter out timer edges for completion routing", async () => {
      // Mock workflow result with exit_to_next_node to trigger transition
      mockRunWorkflow.mockResolvedValueOnce({
        ...mockWorkflowResult,
        toolCalls: [{ name: "exit_to_next_node", args: {} }],
        exitRequested: true,
      });

      const context = createMockContext();
      context.outgoingEdges = [
        { id: "timer-edge", source: "test-agent-node", target: "timeout-node", edgeType: "timer" },
        { id: "completion-edge", source: "test-agent-node", target: "next-node", edgeType: "default" },
      ];

      const result = await agentHandler.execute(context);

      expect((result as any).targetNodeId).toBe("next-node");
    });

  });

  describe("Empty Conversation", () => {
    it("should handle empty history gracefully", async () => {
      const context = createMockContext();
      context.session.history = [];

      await agentHandler.execute(context);

      const callArgs = mockRunWorkflow.mock.calls[0][0];
      const input = callArgs.input;
      expect(input.conversationHistory).toHaveLength(0);
      expect(input.message).toBe("");
    });
  });

  // ===========================================================================
  // DEFERRED TOOL EXECUTION TESTS
  // ===========================================================================
  // Tests for tools with timing="deferred" that execute after the message is sent.

  describe("Deferred Tool Execution", () => {
    it("should execute deferred tools AFTER message is sent", async () => {
      const executionOrder: string[] = [];

      // Track when sendMessage is called
      const mockSendMessage = vi.fn().mockImplementation(() => {
        executionOrder.push("sendMessage");
        return Promise.resolve();
      });

      // Create a deferred tool that tracks when it executes
      const deferredExecute = vi.fn().mockImplementation(() => {
        executionOrder.push("deferredTool");
        return Promise.resolve({ success: true });
      });

      mockRunWorkflow.mockResolvedValueOnce({
        ...mockWorkflowResult,
        response: "Hello!",
        deferredToolCalls: [
          {
            name: "save_memory",
            args: { content: "test memory" },
            toolCallId: "call-123",
            execute: deferredExecute,
          },
        ],
      });

      const context = createMockContext();
      context.services.messenger.sendMessage = mockSendMessage;

      await agentHandler.execute(context);

      // Verify execution order: message first, then deferred tool
      expect(executionOrder).toEqual(["sendMessage", "deferredTool"]);
      expect(deferredExecute).toHaveBeenCalledTimes(1);
    });

    it("should log error but NOT fail handler when deferred tool errors", async () => {
      // Create a deferred tool that throws
      const deferredExecute = vi.fn().mockRejectedValue(new Error("Network timeout"));

      mockRunWorkflow.mockResolvedValueOnce({
        ...mockWorkflowResult,
        response: "Hello!",
        deferredToolCalls: [
          {
            name: "save_memory",
            args: { content: "test" },
            toolCallId: "call-123",
            execute: deferredExecute,
          },
        ],
      });

      const context = createMockContext();
      const result = await agentHandler.execute(context);

      // Handler should complete successfully despite deferred tool error
      expect(result.action).toBe("wait");
      // Message should have been sent
      expect(context.services.messenger.sendMessage).toHaveBeenCalledWith(
        "Hello!",
        undefined,
        undefined,
        undefined,
        undefined
      );
      // Error should be logged
      expect(context.log.error).toHaveBeenCalledWith(
        expect.objectContaining({
          toolName: "save_memory",
        }),
        "agent:deferredTool:error"
      );
    });

    it("should execute multiple deferred tools in sequence", async () => {
      const executionOrder: string[] = [];

      const deferredTool1 = vi.fn().mockImplementation(() => {
        executionOrder.push("tool1");
        return Promise.resolve({ success: true });
      });

      const deferredTool2 = vi.fn().mockImplementation(() => {
        executionOrder.push("tool2");
        return Promise.resolve({ success: true });
      });

      const deferredTool3 = vi.fn().mockImplementation(() => {
        executionOrder.push("tool3");
        return Promise.resolve({ success: true });
      });

      mockRunWorkflow.mockResolvedValueOnce({
        ...mockWorkflowResult,
        response: "Done!",
        deferredToolCalls: [
          { name: "add_tag", args: {}, toolCallId: "call-1", execute: deferredTool1 },
          { name: "save_memory", args: {}, toolCallId: "call-2", execute: deferredTool2 },
          { name: "move_pipeline", args: {}, toolCallId: "call-3", execute: deferredTool3 },
        ],
      });

      const context = createMockContext();
      await agentHandler.execute(context);

      // All tools should execute in order
      expect(executionOrder).toEqual(["tool1", "tool2", "tool3"]);
      expect(deferredTool1).toHaveBeenCalledTimes(1);
      expect(deferredTool2).toHaveBeenCalledTimes(1);
      expect(deferredTool3).toHaveBeenCalledTimes(1);
    });

    it("should continue executing remaining tools if one fails", async () => {
      const executionOrder: string[] = [];

      const deferredTool1 = vi.fn().mockImplementation(() => {
        executionOrder.push("tool1");
        return Promise.resolve({ success: true });
      });

      // This tool fails
      const deferredTool2 = vi.fn().mockImplementation(() => {
        executionOrder.push("tool2-failed");
        return Promise.reject(new Error("Tool 2 failed"));
      });

      const deferredTool3 = vi.fn().mockImplementation(() => {
        executionOrder.push("tool3");
        return Promise.resolve({ success: true });
      });

      mockRunWorkflow.mockResolvedValueOnce({
        ...mockWorkflowResult,
        response: "Response",
        deferredToolCalls: [
          { name: "tool_1", args: {}, toolCallId: "call-1", execute: deferredTool1 },
          { name: "tool_2", args: {}, toolCallId: "call-2", execute: deferredTool2 },
          { name: "tool_3", args: {}, toolCallId: "call-3", execute: deferredTool3 },
        ],
      });

      const context = createMockContext();
      await agentHandler.execute(context);

      // All tools should be attempted, including after tool2 failed
      expect(executionOrder).toEqual(["tool1", "tool2-failed", "tool3"]);
      expect(context.log.error).toHaveBeenCalledWith(
        expect.objectContaining({ toolName: "tool_2" }),
        "agent:deferredTool:error"
      );
    });

    it("should log info when starting deferred tool execution", async () => {
      const deferredExecute = vi.fn().mockResolvedValue({ success: true });

      mockRunWorkflow.mockResolvedValueOnce({
        ...mockWorkflowResult,
        response: "Hello!",
        deferredToolCalls: [
          { name: "save_memory", args: {}, toolCallId: "call-1", execute: deferredExecute },
          { name: "add_tag", args: {}, toolCallId: "call-2", execute: deferredExecute },
        ],
      });

      const context = createMockContext();
      await agentHandler.execute(context);

      // Should log info about starting deferred execution
      expect(context.log.info).toHaveBeenCalledWith(
        expect.objectContaining({ count: 2 }),
        "agent:deferredTools:executing"
      );
    });

    it("should handle empty deferredToolCalls array", async () => {
      mockRunWorkflow.mockResolvedValueOnce({
        ...mockWorkflowResult,
        response: "Hello!",
        deferredToolCalls: [],
      });

      const context = createMockContext();
      const result = await agentHandler.execute(context);

      // Handler should complete normally
      expect(result.action).toBe("wait");
      // Should NOT log deferred tools executing
      expect(context.log.info).not.toHaveBeenCalledWith(
        expect.anything(),
        "agent:deferredTools:executing"
      );
    });

    it("should handle undefined deferredToolCalls", async () => {
      mockRunWorkflow.mockResolvedValueOnce({
        ...mockWorkflowResult,
        response: "Hello!",
        // deferredToolCalls is undefined (not set)
      });

      const context = createMockContext();
      const result = await agentHandler.execute(context);

      // Handler should complete normally
      expect(result.action).toBe("wait");
    });
  });
});
