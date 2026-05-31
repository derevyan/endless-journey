import { describe, expect, it } from "vitest";
import type { EnhancedUserJourney, JourneyNodeData } from "@journey/schemas";
import { getNodeOutput, sanitizeNodeLabel, storeNodeOutput } from "../utils/node-outputs";

describe("Node Output Utilities", () => {
  // Helper functions for all test suites
  const createSession = (): EnhancedUserJourney => ({
    sessionId: "session-1",
    userId: "user-1",
    platformUserId: "user-1",
    journeyId: "journey-1",
    currentNodeId: "node-1",
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
  });

  const createNode = (id: string, label: string, type: string): JourneyNodeData =>
    ({
      id,
      type: "custom",
      data: {
        type,
        label,
        description: "",
      },
      position: { x: 0, y: 0 },
    }) as unknown as JourneyNodeData;

  describe("sanitizeNodeLabel", () => {
    it("should replace spaces with underscores", () => {
      expect(sanitizeNodeLabel("Get Customer")).toBe("Get_Customer");
    });

    it("should handle multiple spaces", () => {
      expect(sanitizeNodeLabel("Validate User Data")).toBe("Validate_User_Data");
    });

    it("should remove special characters", () => {
      expect(sanitizeNodeLabel("API Call (v2)")).toBe("API_Call_v2");
    });

    it("should handle exclamation marks", () => {
      expect(sanitizeNodeLabel("Validate User!")).toBe("Validate_User");
    });

    it("should collapse multiple underscores", () => {
      expect(sanitizeNodeLabel("Get   Customer")).toBe("Get_Customer");
    });

    it("should trim leading/trailing underscores", () => {
      expect(sanitizeNodeLabel(" Get Customer ")).toBe("Get_Customer");
    });

    it("should handle single word labels", () => {
      expect(sanitizeNodeLabel("Webhook")).toBe("Webhook");
    });

    it("should handle empty string", () => {
      expect(sanitizeNodeLabel("")).toBe("");
    });
  });

  describe("storeNodeOutput", () => {
    it("should store node output with sanitized label", () => {
      const session = createSession();
      const node = createNode("node-1", "Get Customer", "webhook");
      const data = { email: "john@example.com", name: "John" };

      storeNodeOutput(session, node, data);

      expect(session.nodeOutputs).toHaveProperty("Get_Customer");
      expect(session.nodeOutputs!.Get_Customer.data).toEqual(data);
      expect(session.nodeOutputs!.Get_Customer.nodeId).toBe("node-1");
      expect(session.nodeOutputs!.Get_Customer.nodeLabel).toBe("Get Customer");
      expect(session.nodeOutputs!.Get_Customer.nodeType).toBe("webhook");
    });

    it("should overwrite existing output with same label", () => {
      const session = createSession();
      const node = createNode("node-1", "Get Customer", "webhook");

      storeNodeOutput(session, node, { email: "first@example.com" });
      storeNodeOutput(session, node, { email: "second@example.com" });

      expect(session.nodeOutputs!.Get_Customer.data).toEqual({ email: "second@example.com" });
    });

    it("should initialize nodeOutputs if undefined", () => {
      const session = createSession();
      // @ts-expect-error - simulating missing nodeOutputs
      delete session.nodeOutputs;
      const node = createNode("node-1", "Test", "webhook");

      storeNodeOutput(session, node, { test: true });

      expect(session.nodeOutputs).toBeDefined();
      expect(session.nodeOutputs!.Test.data).toEqual({ test: true });
    });

    it("should store multiple node outputs", () => {
      const session = createSession();
      const node1 = createNode("node-1", "Get Customer", "webhook");
      const node2 = createNode("node-2", "Validate User", "condition");

      storeNodeOutput(session, node1, { id: "cust-1" });
      storeNodeOutput(session, node2, { isValid: true });

      expect(Object.keys(session.nodeOutputs!)).toHaveLength(2);
      expect(session.nodeOutputs!.Get_Customer.data).toEqual({ id: "cust-1" });
      expect(session.nodeOutputs!.Validate_User.data).toEqual({ isValid: true });
    });
  });

  describe("getNodeOutput", () => {
    const createSessionWithOutputs = (): EnhancedUserJourney => ({
      sessionId: "session-1",
      userId: "user-1",
      platformUserId: "user-1",
      journeyId: "journey-1",
      currentNodeId: "node-1",
      status: "active",
      context: {},
      tags: [],
      pendingTimers: [],
            pendingPluginFollowUps: [],
      nodeOutputs: {
        Get_Customer: {
          nodeId: "node-1",
          nodeLabel: "Get Customer",
          nodeType: "webhook",
          executedAt: new Date().toISOString(),
          data: { email: "john@example.com", name: "John" },
        },
        Validate_User: {
          nodeId: "node-2",
          nodeLabel: "Validate User",
          nodeType: "condition",
          executedAt: new Date().toISOString(),
          data: { isValid: true, branchId: "branch-yes" },
        },
      },
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedAt: null,
    hasStarted: false,
      history: [],
    });

    it("should get output by sanitized label", () => {
      const session = createSessionWithOutputs();
      const output = getNodeOutput(session, "Get Customer");

      expect(output).toEqual({ email: "john@example.com", name: "John" });
    });

    it("should get output by already sanitized label", () => {
      const session = createSessionWithOutputs();
      const output = getNodeOutput(session, "Get_Customer");

      expect(output).toEqual({ email: "john@example.com", name: "John" });
    });

    it("should get output by node ID", () => {
      const session = createSessionWithOutputs();
      const output = getNodeOutput(session, "node-2");

      expect(output).toEqual({ isValid: true, branchId: "branch-yes" });
    });

    it("should return undefined for non-existent label", () => {
      const session = createSessionWithOutputs();
      const output = getNodeOutput(session, "NonExistent");

      expect(output).toBeUndefined();
    });

    it("should return undefined for non-existent node ID", () => {
      const session = createSessionWithOutputs();
      const output = getNodeOutput(session, "node-999");

      expect(output).toBeUndefined();
    });

    it("should return undefined if nodeOutputs is undefined", () => {
      const session = createSessionWithOutputs();
      // @ts-expect-error - simulating missing nodeOutputs
      delete session.nodeOutputs;
      const output = getNodeOutput(session, "Get Customer");

      expect(output).toBeUndefined();
    });
  });

  describe("Multi-turn Agent Conversations (Hybrid Model)", () => {
    const createSession = (): EnhancedUserJourney => ({
      sessionId: "session-1",
      userId: "user-1",
      platformUserId: "user-1",
      journeyId: "journey-1",
      currentNodeId: "agent-1",
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
    });

    const createAgentNode = (): JourneyNodeData =>
      ({
        id: "agent-1",
        type: "custom",
        data: {
          type: "agent",
          label: "AI Assistant",
          description: "Multi-turn agent node",
        },
        position: { x: 0, y: 0 },
      }) as unknown as JourneyNodeData;

    it("should store first agent response with all fields", () => {
      const session = createSession();
      const node = createAgentNode();
      const agentState = {
        totalTokens: 100,
        totalCostUSD: 0.001,
        conversationStartedAt: new Date().toISOString(),
      };

      const outputData = {
        lastResponse: "Hello, how can I help?",
        lastSuccess: true,
        lastBlocked: false,
        lastToolCalls: [],
        lastDurationMs: 1000,
        lastTraceLength: 2,
        allResponses: [
          {
            response: "Hello, how can I help?",
            success: true,
            blocked: false,
            toolCalls: [],
            durationMs: 1000,
            traceLength: 2,
            executedAt: new Date().toISOString(),
            userMessage: "Hi",
          },
        ],
        conversationMetrics: {
          turnCount: 1,
          totalTokens: 100,
          totalCostUSD: 0.001,
          conversationStartedAt: agentState.conversationStartedAt,
          lastTurnAt: new Date().toISOString(),
        },
      };

      storeNodeOutput(session, node, outputData);

      const output = session.nodeOutputs!.AI_Assistant;
      expect(output.data).toHaveProperty("lastResponse");
      expect(output.data).toHaveProperty("allResponses");
      expect(output.data).toHaveProperty("conversationMetrics");
      expect((output.data as any).allResponses).toHaveLength(1);
      expect((output.data as any).conversationMetrics.turnCount).toBe(1);
    });

    it("should append second response to allResponses without overwriting", () => {
      const session = createSession();
      const node = createAgentNode();

      // First response
      const firstOutput = {
        lastResponse: "Hello!",
        allResponses: [
          {
            response: "Hello!",
            success: true,
            executedAt: new Date().toISOString(),
            userMessage: "Hi",
          },
        ],
        conversationMetrics: { turnCount: 1 },
      };

      storeNodeOutput(session, node, firstOutput);

      // Second response (building on first)
      const existingOutput = session.nodeOutputs!.AI_Assistant;
      const allResponses = (existingOutput?.data as any)?.allResponses || [];

      allResponses.push({
        response: "What can I help you with?",
        success: true,
        executedAt: new Date().toISOString(),
        userMessage: "I need help",
      });

      const secondOutput = {
        lastResponse: "What can I help you with?",
        allResponses,
        conversationMetrics: { turnCount: allResponses.length },
      };

      storeNodeOutput(session, node, secondOutput);

      const output = session.nodeOutputs!.AI_Assistant;
      expect((output.data as any).allResponses).toHaveLength(2);
      expect((output.data as any).lastResponse).toBe("What can I help you with?");
      expect((output.data as any).conversationMetrics.turnCount).toBe(2);
      expect((output.data as any).allResponses[0].response).toBe("Hello!");
      expect((output.data as any).allResponses[1].response).toBe("What can I help you with?");
    });

    it("should preserve all three responses in multi-turn conversation", () => {
      const session = createSession();
      const node = createAgentNode();

      // Simulate three agent turns
      const turns = [
        { response: "What's your name?", userMessage: "Hi there" },
        { response: "Nice to meet you, John!", userMessage: "I'm John" },
        { response: "How can I help today?", userMessage: "I need assistance" },
      ];

      let allResponses: any[] = [];

      for (const turn of turns) {
        allResponses.push({
          response: turn.response,
          success: true,
          executedAt: new Date().toISOString(),
          userMessage: turn.userMessage,
        });

        const outputData = {
          lastResponse: turn.response,
          allResponses: [...allResponses],
          conversationMetrics: { turnCount: allResponses.length },
        };

        storeNodeOutput(session, node, outputData);
      }

      const output = session.nodeOutputs!.AI_Assistant;
      expect((output.data as any).allResponses).toHaveLength(3);
      expect((output.data as any).conversationMetrics.turnCount).toBe(3);
      expect((output.data as any).lastResponse).toBe("How can I help today?");

      // Verify full conversation history is preserved
      const allResponses_final = (output.data as any).allResponses;
      expect(allResponses_final[0].userMessage).toBe("Hi there");
      expect(allResponses_final[1].userMessage).toBe("I'm John");
      expect(allResponses_final[2].userMessage).toBe("I need assistance");
    });
  });

  describe("Message Handler Outputs", () => {
    it("should store message execution metadata", () => {
      const session = createSession();
      const node = createNode("msg-1", "Welcome Message", "message");
      const messageData = {
        message: "Hello, welcome!",
        messageDelivered: true,
        mediaAttached: null,
        responseType: "buttons" as const,
        buttonsDisplayed: [{ id: "btn-1", text: "Continue" }],
        delayApplied: null,
        timerScheduled: false,
        sentAt: new Date().toISOString(),
      };

      storeNodeOutput(session, node, messageData);

      expect(session.nodeOutputs).toHaveProperty("Welcome_Message");
      expect(session.nodeOutputs!.Welcome_Message.data).toEqual(messageData);
      expect(session.nodeOutputs!.Welcome_Message.nodeType).toBe("message");
    });

    it("should store message delivery failure", () => {
      const session = createSession();
      const node = createNode("msg-1", "Error Message", "message");
      const messageData = {
        message: "An error occurred",
        messageDelivered: false,
        mediaAttached: null,
        responseType: "auto" as const,
        buttonsDisplayed: null,
        delayApplied: null,
        timerScheduled: false,
        sentAt: new Date().toISOString(),
      };

      storeNodeOutput(session, node, messageData);

      expect((session.nodeOutputs!.Error_Message.data as any).messageDelivered).toBe(false);
    });
  });

  describe("Start Handler Outputs", () => {
    it("should store journey entry metadata", () => {
      const session = createSession();
      const node = createNode("start-1", "Start", "start");
      const startedAt = new Date().toISOString();
      const startData = {
        message: "Welcome to our journey!",
        messageDelivered: true,
        mediaAttached: null,
        journeyStartedAt: startedAt,
      };

      storeNodeOutput(session, node, startData);

      expect(session.nodeOutputs).toHaveProperty("Start");
      expect(session.nodeOutputs!.Start.data).toEqual(startData);
      expect(session.nodeOutputs!.Start.nodeType).toBe("start");
    });

    it("should track journey start time", () => {
      const session = createSession();
      const node = createNode("start-1", "Begin Journey", "start");
      const startData = {
        message: "Let's begin!",
        messageDelivered: true,
        mediaAttached: null,
        journeyStartedAt: new Date().toISOString(),
      };

      storeNodeOutput(session, node, startData);

      const output = session.nodeOutputs!.Begin_Journey.data as any;
      expect(output.journeyStartedAt).toBeDefined();
      expect(new Date(output.journeyStartedAt)).toBeInstanceOf(Date);
    });
  });

  describe("Wait Handler Outputs", () => {
    it("should store timing metadata", () => {
      const session = createSession();
      const node = createNode("wait-1", "Pause", "wait");
      const duration = { value: 5, unit: "seconds" as const };
      const delayMs = 5000;
      const now = new Date();
      const expectedCompletion = new Date(now.getTime() + delayMs);

      const waitData = {
        duration: duration,
        delayMs: delayMs,
        timerScheduledAt: now.toISOString(),
        expectedCompletionAt: expectedCompletion.toISOString(),
      };

      storeNodeOutput(session, node, waitData);

      expect(session.nodeOutputs).toHaveProperty("Pause");
      expect(session.nodeOutputs!.Pause.data).toEqual(waitData);
      expect(session.nodeOutputs!.Pause.nodeType).toBe("wait");
    });

    it("should calculate expected completion time", () => {
      const session = createSession();
      const node = createNode("wait-1", "Sleep", "wait");
      const delayMs = 60000; // 1 minute
      const now = new Date();
      const expectedCompletion = new Date(now.getTime() + delayMs);

      const waitData = {
        duration: { value: 60, unit: "seconds" as const },
        delayMs: delayMs,
        timerScheduledAt: now.toISOString(),
        expectedCompletionAt: expectedCompletion.toISOString(),
      };

      storeNodeOutput(session, node, waitData);

      const output = session.nodeOutputs!.Sleep.data as any;
      const scheduled = new Date(output.timerScheduledAt).getTime();
      const expected = new Date(output.expectedCompletionAt).getTime();
      expect(expected - scheduled).toBe(delayMs);
    });
  });

  describe("End Handler Outputs", () => {
    it("should store completion metadata", () => {
      const session = createSession();
      const node = createNode("end-1", "Finish", "end");
      const completedAt = new Date().toISOString();
      const endData = {
        message: "Thank you for completing the journey!",
        messageDelivered: true,
        mediaAttached: null,
        journeyCompletedAt: completedAt,
        sessionStatus: "completed",
      };

      storeNodeOutput(session, node, endData);

      expect(session.nodeOutputs).toHaveProperty("Finish");
      expect(session.nodeOutputs!.Finish.data).toEqual(endData);
      expect(session.nodeOutputs!.Finish.nodeType).toBe("end");
    });

    it("should handle end nodes without final message", () => {
      const session = createSession();
      const node = createNode("end-1", "Silent End", "end");
      const endData = {
        message: null,
        messageDelivered: false,
        mediaAttached: null,
        journeyCompletedAt: new Date().toISOString(),
        sessionStatus: "completed",
      };

      storeNodeOutput(session, node, endData);

      const output = session.nodeOutputs!.Silent_End.data as any;
      expect(output.message).toBeNull();
      expect(output.messageDelivered).toBe(false);
      expect(output.sessionStatus).toBe("completed");
    });
  });

  describe("Teleport Handler Outputs", () => {
    it("should store teleport metadata", () => {
      const session = createSession();
      const node = createNode("teleport-1", "Switch Journey", "teleport");
      const teleportData = {
        teleportedTo: "journey-2",
        targetNode: "node-start",
        preserveContext: true,
        fromJourneyId: "journey-1",
        teleportedAt: new Date().toISOString(),
      };

      storeNodeOutput(session, node, teleportData);

      expect(session.nodeOutputs).toHaveProperty("Switch_Journey");
      expect(session.nodeOutputs!.Switch_Journey.data).toEqual(teleportData);
      expect(session.nodeOutputs!.Switch_Journey.nodeType).toBe("teleport");
    });

    it("should track journey transition", () => {
      const session = createSession();
      const node = createNode("teleport-1", "Jump", "teleport");
      const fromId = "old-journey";
      const toId = "new-journey";

      const teleportData = {
        teleportedTo: toId,
        targetNode: null,
        preserveContext: false,
        fromJourneyId: fromId,
        teleportedAt: new Date().toISOString(),
      };

      storeNodeOutput(session, node, teleportData);

      const output = session.nodeOutputs!.Jump.data as any;
      expect(output.fromJourneyId).toBe(fromId);
      expect(output.teleportedTo).toBe(toId);
      expect(output.preserveContext).toBe(false);
    });
  });
});

