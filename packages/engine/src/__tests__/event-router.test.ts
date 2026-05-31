import { describe, expect, it, vi } from "vitest";
import type { EnhancedUserJourney, JourneyEdgeData, JourneyNodeData } from "@journey/schemas";
import { EventRouter } from "../event/event-router";
import { createSessionStateManager } from "../state/session-state-manager";
import type { EventLogger, JourneyEvent, MessengerService, TimerService } from "../types";

function createSession(overrides?: Partial<EnhancedUserJourney>): EnhancedUserJourney {
  const now = new Date().toISOString();
  return {
    sessionId: "session-1",
    userId: "user-1",
    platformUserId: "user-1",
    journeyId: "journey-1",
    currentNodeId: "msg",
    status: "active",
    context: {},
    tags: [],
    pendingTimers: [],
            pendingPluginFollowUps: [],
    nodeOutputs: {},
    startedAt: now,
    updatedAt: now,
    completedAt: null,
    hasStarted: false,
    history: [],
    ...overrides,
  };
}

function createRouter(options: {
  session: EnhancedUserJourney;
  node: JourneyNodeData;
  edges: JourneyEdgeData[];
  clientPlatform?: string;
}) {
  const eventLogger: EventLogger = { logEvent: vi.fn() };
  const timerService: TimerService = {
    scheduleTimer: vi.fn(),
    cancelTimer: vi.fn(),
    cancelTimersForNode: vi.fn().mockResolvedValue(undefined),
    getEdgeForTimer: vi.fn(),
    markTimerFired: vi.fn(),
    clearAll: vi.fn(),
    // Plugin follow-up methods
    schedulePluginFollowUpTimer: vi.fn().mockResolvedValue("plugin-followup-timer-1"),
    getPluginFollowUpContext: vi.fn(),
    hasPluginFollowUp: vi.fn().mockReturnValue(false),
    markPluginFollowUpFired: vi.fn(),
    cancelPluginFollowUpsForNode: vi.fn().mockResolvedValue(undefined),
    cancelAllPluginFollowUps: vi.fn().mockResolvedValue(undefined),
    shouldCancelPluginFollowUpsOnResponse: vi.fn().mockReturnValue(true),
    getPluginFollowUpResponseBehavior: vi.fn().mockReturnValue(null),
  };
  const messengerService: MessengerService = {
    sendMessage: vi.fn().mockResolvedValue({ success: true, messageIds: [] }),
  };
  const log = {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    trace: vi.fn(),
  } as unknown as ReturnType<typeof import("@journey/logger").createLogger>;

  const onTransition = vi.fn().mockResolvedValue(undefined);

  const stateManager = createSessionStateManager(options.session);
  const router = new EventRouter(
    { session: options.session, stateManager, eventLogger, timerService, messengerService, log },
    {
      getNode: () => options.node,
      getOutgoingEdges: () => options.edges,
      onTransition,
      getClientData: () =>
        options.clientPlatform
          ? { id: options.session.userId, platform: options.clientPlatform }
          : undefined,
    }
  );

  return { router, onTransition };
}

describe("EventRouter button guards", () => {
  const node: JourneyNodeData = {
    id: "msg",
    type: "custom",
    position: { x: 0, y: 0 },
    data: {
      type: "message",
      schemaVersion: 2,
      contentFormat: "text",
      label: "Message",
      content: "Pick",
      responseType: "buttons",
      buttons: [{ id: "btn-a", text: "A", targetNodeId: "node-a" }],
    },
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: "1.0.0",
      status: "active",
    },
  };

  const edges: JourneyEdgeData[] = [
    {
      id: "edge-a",
      source: "msg",
      target: "node-a",
      edgeType: "default",
      guard: { type: "expression", expression: 'user.platform == "telegram"' },
    },
  ];

  const event: JourneyEvent = {
    type: "button_click",
    userId: "user-1",
    sessionId: "session-1",
    timestamp: new Date().toISOString(),
    payload: { buttonId: "btn-a" },
  };

  it("blocks guarded button routes when guard fails", async () => {
    const session = createSession({
      activeButtons: [{ id: "btn-a", text: "A", targetNodeId: "node-a", source: "node" }],
    });
    const { router, onTransition } = createRouter({
      session,
      node,
      edges,
      clientPlatform: "whatsapp",
    });

    await router.handle(event);

    expect(onTransition).not.toHaveBeenCalled();
  });

  it("allows guarded button routes when guard passes", async () => {
    const session = createSession({
      activeButtons: [{ id: "btn-a", text: "A", targetNodeId: "node-a", source: "node" }],
    });
    const { router, onTransition } = createRouter({
      session,
      node,
      edges,
      clientPlatform: "telegram",
    });

    await router.handle(event);

    expect(onTransition).toHaveBeenCalledWith("node-a", "button_click", "btn-a");
  });
});

describe("EventRouter userId/sessionId validation", () => {
  const node: JourneyNodeData = {
    id: "msg",
    type: "custom",
    position: { x: 0, y: 0 },
    data: {
      type: "message",
      schemaVersion: 2,
      contentFormat: "text",
      label: "Message",
      content: "Test",
      responseType: "text",
    },
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: "1.0.0",
      status: "active",
    },
  };

  const edges: JourneyEdgeData[] = [
    {
      id: "edge-1",
      source: "msg",
      target: "node-next",
      edgeType: "default",
    },
  ];

  describe("session validation", () => {
    it("should process event with matching sessionId and userId", async () => {
      const session = createSession({
        sessionId: "session-123",
        userId: "user-456",
      });
      const { router, onTransition } = createRouter({
        session,
        node,
        edges,
      });

      const event: JourneyEvent = {
        type: "message",
        userId: "user-456", // Matches session
        sessionId: "session-123", // Matches session
        timestamp: new Date().toISOString(),
        payload: { text: "hello" },
      };

      await router.handle(event);

      expect(onTransition).toHaveBeenCalled();
    });

    it("should reject event with mismatched sessionId", async () => {
      const session = createSession({
        sessionId: "session-123",
        userId: "user-456",
      });
      const { router, onTransition } = createRouter({
        session,
        node,
        edges,
      });

      const event: JourneyEvent = {
        type: "message",
        userId: "user-456",
        sessionId: "WRONG-SESSION", // ❌ Mismatch
        timestamp: new Date().toISOString(),
        payload: { text: "hello" },
      };

      await router.handle(event);

      expect(onTransition).not.toHaveBeenCalled();
    });

    it("should reject event with mismatched userId", async () => {
      const session = createSession({
        sessionId: "session-123",
        userId: "user-456",
      });
      const { router, onTransition } = createRouter({
        session,
        node,
        edges,
      });

      const event: JourneyEvent = {
        type: "message",
        userId: "WRONG-USER", // ❌ Mismatch
        sessionId: "session-123",
        timestamp: new Date().toISOString(),
        payload: { text: "hello" },
      };

      await router.handle(event);

      expect(onTransition).not.toHaveBeenCalled();
    });

    it("should reject event with empty sessionId when session has sessionId", async () => {
      const session = createSession({
        sessionId: "session-123",
        userId: "user-456",
      });
      const { router, onTransition } = createRouter({
        session,
        node,
        edges,
      });

      const event: JourneyEvent = {
        type: "message",
        userId: "user-456",
        sessionId: "", // ❌ Empty
        timestamp: new Date().toISOString(),
        payload: { text: "hello" },
      };

      await router.handle(event);

      expect(onTransition).not.toHaveBeenCalled();
    });

    it("should reject event with empty userId when session has userId", async () => {
      const session = createSession({
        sessionId: "session-123",
        userId: "user-456",
      });
      const { router, onTransition } = createRouter({
        session,
        node,
        edges,
      });

      const event: JourneyEvent = {
        type: "message",
        userId: "", // ❌ Empty
        sessionId: "session-123",
        timestamp: new Date().toISOString(),
        payload: { text: "hello" },
      };

      await router.handle(event);

      expect(onTransition).not.toHaveBeenCalled();
    });

    it("should accept timeout event with matching IDs (with edgeId to prevent stale detection)", async () => {
      const session = createSession({
        sessionId: "session-123",
        userId: "user-456",
      });
      const { router, onTransition } = createRouter({
        session,
        node,
        edges,
      });

      const event: JourneyEvent = {
        type: "timeout",
        userId: "user-456",
        sessionId: "session-123",
        timestamp: new Date().toISOString(),
        // Include edgeId in payload to prevent stale timeout detection
        // In production, this comes from BullMQ job data
        payload: { timerId: "timer-1", edgeId: "edge-1" },
      };

      await router.handle(event);

      expect(onTransition).toHaveBeenCalled();
    });

    it("should reject timeout event with mismatched userId (even if edgeId is present)", async () => {
      const session = createSession({
        sessionId: "session-123",
        userId: "user-456",
      });
      const { router, onTransition } = createRouter({
        session,
        node,
        edges,
      });

      const event: JourneyEvent = {
        type: "timeout",
        userId: "WRONG-USER", // ❌ Platform ID instead of UUID - BUG #2 that we fixed
        sessionId: "session-123",
        timestamp: new Date().toISOString(),
        payload: { timerId: "timer-1", edgeId: "edge-1" },
      };

      await router.handle(event);

      expect(onTransition).not.toHaveBeenCalled();
    });

    it("should accept button_click with matching IDs", async () => {
      const session = createSession({
        sessionId: "session-123",
        userId: "user-456",
        activeButtons: [{ id: "btn-1", text: "Click", targetNodeId: "node-next", source: "node" }],
      });
      const { router, onTransition } = createRouter({
        session,
        node,
        edges,
      });

      const event: JourneyEvent = {
        type: "button_click",
        userId: "user-456",
        sessionId: "session-123",
        timestamp: new Date().toISOString(),
        payload: { buttonId: "btn-1" },
      };

      await router.handle(event);

      expect(onTransition).toHaveBeenCalled();
    });

    it("should reject button_click with mismatched sessionId (critical for preventing cross-session attacks)", async () => {
      const session = createSession({
        sessionId: "session-123",
        userId: "user-456",
        activeButtons: [{ id: "btn-1", text: "Click", targetNodeId: "node-next", source: "node" }],
      });
      const { router, onTransition } = createRouter({
        session,
        node,
        edges,
      });

      const event: JourneyEvent = {
        type: "button_click",
        userId: "user-456",
        sessionId: "different-session", // ❌ Wrong session
        timestamp: new Date().toISOString(),
        payload: { buttonId: "btn-1" },
      };

      await router.handle(event);

      expect(onTransition).not.toHaveBeenCalled();
    });
  });
});

describe("EventRouter stale timeout detection", () => {
  const node: JourneyNodeData = {
    id: "msg",
    type: "custom",
    position: { x: 0, y: 0 },
    data: {
      type: "message",
      schemaVersion: 2,
      contentFormat: "text",
      label: "Message",
      content: "Wait for timeout",
      responseType: "any",
    },
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: "1.0.0",
      status: "active",
    },
  };

  const timerEdge: JourneyEdgeData = {
    id: "timer-edge-1",
    source: "msg",
    target: "timeout-node",
    edgeType: "timer",
  };

  it("should ignore stale timeout when timer was cancelled (empty timerMap, no edgeId)", async () => {
    const session = createSession();
    const eventLogger = { logEvent: vi.fn() };
    const timerService = {
      scheduleTimer: vi.fn(),
      cancelTimer: vi.fn(),
      cancelTimersForNode: vi.fn().mockResolvedValue(undefined),
      getEdgeForTimer: vi.fn().mockReturnValue(undefined), // Timer cancelled - not in map
      markTimerFired: vi.fn(),
      clearAll: vi.fn(),
      schedulePluginFollowUpTimer: vi.fn(),
      getPluginFollowUpContext: vi.fn(),
      hasPluginFollowUp: vi.fn().mockReturnValue(false),
      markPluginFollowUpFired: vi.fn(),
      cancelPluginFollowUpsForNode: vi.fn().mockResolvedValue(undefined),
      cancelAllPluginFollowUps: vi.fn().mockResolvedValue(undefined),
      shouldCancelPluginFollowUpsOnResponse: vi.fn().mockReturnValue(true),
      getPluginFollowUpResponseBehavior: vi.fn().mockReturnValue(null),
    };
    const log = { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), trace: vi.fn() } as any;
    const onTransition = vi.fn();
    const stateManager = createSessionStateManager(session);

    const router = new EventRouter(
      { session, stateManager, eventLogger, timerService, messengerService: { sendMessage: vi.fn() }, log },
      { getNode: () => node, getOutgoingEdges: () => [timerEdge], onTransition }
    );

    const event: JourneyEvent = {
      type: "timeout",
      userId: "user-1",
      sessionId: "session-1",
      timestamp: new Date().toISOString(),
      payload: { timerId: "stale-timer" }, // No edgeId - truly stale
    };

    await router.handle(event);

    expect(onTransition).not.toHaveBeenCalled();
    expect(log.debug).toHaveBeenCalledWith(
      expect.objectContaining({ timerId: "stale-timer" }),
      "router:staleTimeoutIgnored"
    );
  });

  it("should process timeout when timerMap has edge for timer", async () => {
    const session = createSession();
    const eventLogger = { logEvent: vi.fn() };
    const timerService = {
      scheduleTimer: vi.fn(),
      cancelTimer: vi.fn(),
      cancelTimersForNode: vi.fn().mockResolvedValue(undefined),
      getEdgeForTimer: vi.fn().mockReturnValue("timer-edge-1"), // Timer is valid
      markTimerFired: vi.fn(),
      clearAll: vi.fn(),
      schedulePluginFollowUpTimer: vi.fn(),
      getPluginFollowUpContext: vi.fn(),
      hasPluginFollowUp: vi.fn().mockReturnValue(false),
      markPluginFollowUpFired: vi.fn(),
      cancelPluginFollowUpsForNode: vi.fn().mockResolvedValue(undefined),
      cancelAllPluginFollowUps: vi.fn().mockResolvedValue(undefined),
      shouldCancelPluginFollowUpsOnResponse: vi.fn().mockReturnValue(true),
      getPluginFollowUpResponseBehavior: vi.fn().mockReturnValue(null),
    };
    const log = { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), trace: vi.fn() } as any;
    const onTransition = vi.fn().mockResolvedValue(undefined);
    const stateManager = createSessionStateManager(session);

    const router = new EventRouter(
      { session, stateManager, eventLogger, timerService, messengerService: { sendMessage: vi.fn() }, log },
      { getNode: () => node, getOutgoingEdges: () => [timerEdge], onTransition }
    );

    const event: JourneyEvent = {
      type: "timeout",
      userId: "user-1",
      sessionId: "session-1",
      timestamp: new Date().toISOString(),
      payload: { timerId: "valid-timer" },
    };

    await router.handle(event);

    // Note: 3rd arg is undefined because extractButtonId() only returns buttonId for button_click events
    expect(onTransition).toHaveBeenCalledWith("timeout-node", "timeout", undefined);
    expect(timerService.markTimerFired).toHaveBeenCalledWith("valid-timer");
  });

  it("should process timeout via edgeId fallback when timerMap empty (BullMQ recovery)", async () => {
    const session = createSession();
    const eventLogger = { logEvent: vi.fn() };
    const timerService = {
      scheduleTimer: vi.fn(),
      cancelTimer: vi.fn(),
      cancelTimersForNode: vi.fn().mockResolvedValue(undefined),
      getEdgeForTimer: vi.fn().mockReturnValue(undefined), // Empty timerMap (fresh engine)
      markTimerFired: vi.fn(),
      clearAll: vi.fn(),
      schedulePluginFollowUpTimer: vi.fn(),
      getPluginFollowUpContext: vi.fn(),
      hasPluginFollowUp: vi.fn().mockReturnValue(false),
      markPluginFollowUpFired: vi.fn(),
      cancelPluginFollowUpsForNode: vi.fn().mockResolvedValue(undefined),
      cancelAllPluginFollowUps: vi.fn().mockResolvedValue(undefined),
      shouldCancelPluginFollowUpsOnResponse: vi.fn().mockReturnValue(true),
      getPluginFollowUpResponseBehavior: vi.fn().mockReturnValue(null),
    };
    const log = { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), trace: vi.fn() } as any;
    const onTransition = vi.fn().mockResolvedValue(undefined);
    const stateManager = createSessionStateManager(session);

    const router = new EventRouter(
      { session, stateManager, eventLogger, timerService, messengerService: { sendMessage: vi.fn() }, log },
      { getNode: () => node, getOutgoingEdges: () => [timerEdge], onTransition }
    );

    const event: JourneyEvent = {
      type: "timeout",
      userId: "user-1",
      sessionId: "session-1",
      timestamp: new Date().toISOString(),
      payload: { timerId: "recovered-timer", edgeId: "timer-edge-1" }, // edgeId from BullMQ
    };

    await router.handle(event);

    // Note: 3rd arg is undefined - extractButtonId() doesn't return timerId
    expect(onTransition).toHaveBeenCalledWith("timeout-node", "timeout", undefined);
  });
});

describe("EventRouter plugin follow-up timeout routing", () => {
  const node: JourneyNodeData = {
    id: "msg",
    type: "custom",
    position: { x: 0, y: 0 },
    data: {
      type: "message",
      schemaVersion: 2,
      contentFormat: "text",
      label: "Message",
      content: "Parent message",
      responseType: "any",
    },
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: "1.0.0",
      status: "active",
    },
  };

  const edges: JourneyEdgeData[] = [
    { id: "edge-1", source: "msg", target: "next-node", edgeType: "default" },
  ];

  it("should route plugin follow-up timeout and continue on same node", async () => {
    const session = createSession();
    const eventLogger = { logEvent: vi.fn() };
    const timerService = {
      scheduleTimer: vi.fn(),
      cancelTimer: vi.fn(),
      cancelTimersForNode: vi.fn().mockResolvedValue(undefined),
      getEdgeForTimer: vi.fn(),
      markTimerFired: vi.fn(),
      clearAll: vi.fn(),
      schedulePluginFollowUpTimer: vi.fn(),
      getPluginFollowUpContext: vi.fn().mockReturnValue({
        pluginId: "follow-up",
        parentNodeId: "msg",
        stepIndex: 0,
        totalSteps: 3,
      }),
      hasPluginFollowUp: vi.fn().mockReturnValue(true), // This IS a plugin follow-up
      markPluginFollowUpFired: vi.fn(),
      cancelPluginFollowUpsForNode: vi.fn().mockResolvedValue(undefined),
      cancelAllPluginFollowUps: vi.fn().mockResolvedValue(undefined),
      shouldCancelPluginFollowUpsOnResponse: vi.fn().mockReturnValue(true),
      getPluginFollowUpResponseBehavior: vi.fn().mockReturnValue(null),
    };
    const log = { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), trace: vi.fn() } as any;
    const onTransition = vi.fn().mockResolvedValue(undefined);
    const onPluginTimeout = vi.fn().mockResolvedValue({ action: "continue" }); // Stay on node
    const stateManager = createSessionStateManager(session);

    const router = new EventRouter(
      { session, stateManager, eventLogger, timerService, messengerService: { sendMessage: vi.fn() }, log },
      { getNode: () => node, getOutgoingEdges: () => edges, onTransition, onPluginTimeout }
    );

    const event: JourneyEvent = {
      type: "timeout",
      userId: "user-1",
      sessionId: "session-1",
      timestamp: new Date().toISOString(),
      payload: { timerId: "plugin-followup-timer-1" },
    };

    await router.handle(event);

    expect(onPluginTimeout).toHaveBeenCalledWith("plugin-followup-timer-1");
    expect(timerService.markPluginFollowUpFired).toHaveBeenCalledWith("plugin-followup-timer-1");
    expect(onTransition).not.toHaveBeenCalled(); // Stayed on node
  });

  it("should transition to exit node when plugin follow-up returns transition action", async () => {
    const session = createSession();
    const eventLogger = { logEvent: vi.fn() };
    const timerService = {
      scheduleTimer: vi.fn(),
      cancelTimer: vi.fn(),
      cancelTimersForNode: vi.fn().mockResolvedValue(undefined),
      getEdgeForTimer: vi.fn(),
      markTimerFired: vi.fn(),
      clearAll: vi.fn(),
      schedulePluginFollowUpTimer: vi.fn(),
      getPluginFollowUpContext: vi.fn().mockReturnValue({
        pluginId: "follow-up",
        parentNodeId: "msg",
        stepIndex: 2,
        totalSteps: 3,
      }),
      hasPluginFollowUp: vi.fn().mockReturnValue(true),
      markPluginFollowUpFired: vi.fn(),
      cancelPluginFollowUpsForNode: vi.fn().mockResolvedValue(undefined),
      cancelAllPluginFollowUps: vi.fn().mockResolvedValue(undefined),
      shouldCancelPluginFollowUpsOnResponse: vi.fn().mockReturnValue(true),
      getPluginFollowUpResponseBehavior: vi.fn().mockReturnValue(null),
    };
    const log = { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), trace: vi.fn() } as any;
    const onTransition = vi.fn().mockResolvedValue(undefined);
    const onPluginTimeout = vi.fn().mockResolvedValue({
      action: "transition",
      targetNodeId: "exit-node",
      trigger: "followup_sequence_complete",
    });
    const stateManager = createSessionStateManager(session);

    const router = new EventRouter(
      { session, stateManager, eventLogger, timerService, messengerService: { sendMessage: vi.fn() }, log },
      { getNode: () => node, getOutgoingEdges: () => edges, onTransition, onPluginTimeout }
    );

    const event: JourneyEvent = {
      type: "timeout",
      userId: "user-1",
      sessionId: "session-1",
      timestamp: new Date().toISOString(),
      payload: { timerId: "plugin-followup-timer-1" },
    };

    await router.handle(event);

    expect(onPluginTimeout).toHaveBeenCalledWith("plugin-followup-timer-1");
    expect(timerService.cancelPluginFollowUpsForNode).toHaveBeenCalled(); // Cancel remaining
    // Plugin follow-up transitions use 2-arg call: (targetNodeId, trigger) - no buttonId
    expect(onTransition).toHaveBeenCalledWith("exit-node", "followup_sequence_complete");
  });

  it("should fall through to regular timeout handling when not a plugin follow-up", async () => {
    const session = createSession();
    const timerEdge: JourneyEdgeData = {
      id: "timer-edge",
      source: "msg",
      target: "timeout-node",
      edgeType: "timer",
    };
    const eventLogger = { logEvent: vi.fn() };
    const timerService = {
      scheduleTimer: vi.fn(),
      cancelTimer: vi.fn(),
      cancelTimersForNode: vi.fn().mockResolvedValue(undefined),
      getEdgeForTimer: vi.fn().mockReturnValue("timer-edge"),
      markTimerFired: vi.fn(),
      clearAll: vi.fn(),
      schedulePluginFollowUpTimer: vi.fn(),
      getPluginFollowUpContext: vi.fn(),
      hasPluginFollowUp: vi.fn().mockReturnValue(false), // NOT a plugin follow-up
      markPluginFollowUpFired: vi.fn(),
      cancelPluginFollowUpsForNode: vi.fn().mockResolvedValue(undefined),
      cancelAllPluginFollowUps: vi.fn().mockResolvedValue(undefined),
      shouldCancelPluginFollowUpsOnResponse: vi.fn().mockReturnValue(true),
      getPluginFollowUpResponseBehavior: vi.fn().mockReturnValue(null),
    };
    const log = { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), trace: vi.fn() } as any;
    const onTransition = vi.fn().mockResolvedValue(undefined);
    const onPluginTimeout = vi.fn();
    const stateManager = createSessionStateManager(session);

    const router = new EventRouter(
      { session, stateManager, eventLogger, timerService, messengerService: { sendMessage: vi.fn() }, log },
      { getNode: () => node, getOutgoingEdges: () => [timerEdge], onTransition, onPluginTimeout }
    );

    const event: JourneyEvent = {
      type: "timeout",
      userId: "user-1",
      sessionId: "session-1",
      timestamp: new Date().toISOString(),
      payload: { timerId: "regular-timer" },
    };

    await router.handle(event);

    expect(onPluginTimeout).not.toHaveBeenCalled(); // Not called for regular timers
    // Note: 3rd arg is undefined - extractButtonId() doesn't return timerId
    expect(onTransition).toHaveBeenCalledWith("timeout-node", "timeout", undefined);
  });
});

describe("EventRouter user response storage", () => {
  const node: JourneyNodeData = {
    id: "msg",
    type: "custom",
    position: { x: 0, y: 0 },
    data: {
      type: "message",
      schemaVersion: 2,
      contentFormat: "text",
      label: "Message",
      content: "Type something",
      responseType: "text",
      storeResponseAs: "user_input",
    },
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: "1.0.0",
      status: "active",
    },
  };

  const edges: JourneyEdgeData[] = [
    { id: "edge-1", source: "msg", target: "next-node", edgeType: "default" },
  ];

  it("should store text message response in session context", async () => {
    const session = createSession();
    const { router, onTransition } = createRouter({ session, node, edges });

    const event: JourneyEvent = {
      type: "message",
      userId: "user-1",
      sessionId: "session-1",
      timestamp: new Date().toISOString(),
      payload: { text: "Hello world" },
    };

    await router.handle(event);

    expect(session.context.userResponse).toEqual({
      type: "text",
      value: "Hello world",
      inputType: "text",
    });
    expect(session.context.user_input).toBe("Hello world"); // storeResponseAs
    expect(onTransition).toHaveBeenCalled();
  });

  it("should store voice message response with inputType voice", async () => {
    const session = createSession();
    const { router, onTransition } = createRouter({ session, node, edges });

    const event: JourneyEvent = {
      type: "message",
      userId: "user-1",
      sessionId: "session-1",
      timestamp: new Date().toISOString(),
      payload: { text: "Voice transcription", inputType: "voice" },
    };

    await router.handle(event);

    expect(session.context.userResponse).toEqual({
      type: "text",
      value: "Voice transcription",
      inputType: "voice",
    });
    expect(onTransition).toHaveBeenCalled();
  });

  it("should store button click response with button value", async () => {
    const buttonNode: JourneyNodeData = {
      ...node,
      data: {
        type: "message" as const,
        schemaVersion: 2,
        contentFormat: "text",
        label: "Message",
        content: "Type something",
        responseType: "buttons",
        buttons: [{ id: "btn-yes", text: "Yes", targetNodeId: "next-node" }],
        storeResponseAs: "user_input",
      },
    };
    const session = createSession({
      activeButtons: [{ id: "btn-yes", text: "Yes", targetNodeId: "next-node", source: "node" }],
    });
    const { router, onTransition } = createRouter({ session, node: buttonNode, edges });

    const event: JourneyEvent = {
      type: "button_click",
      userId: "user-1",
      sessionId: "session-1",
      timestamp: new Date().toISOString(),
      payload: { buttonId: "btn-yes" },
    };

    await router.handle(event);

    expect(session.context.userResponse).toEqual({
      type: "button",
      value: "btn-yes",
    });
    expect(onTransition).toHaveBeenCalled();
  });

  it("should NOT store timeout as user response", async () => {
    const session = createSession();
    const timerEdge: JourneyEdgeData = {
      id: "timer-edge",
      source: "msg",
      target: "timeout-node",
      edgeType: "timer",
    };
    const eventLogger = { logEvent: vi.fn() };
    const timerService = {
      scheduleTimer: vi.fn(),
      cancelTimer: vi.fn(),
      cancelTimersForNode: vi.fn().mockResolvedValue(undefined),
      getEdgeForTimer: vi.fn().mockReturnValue("timer-edge"),
      markTimerFired: vi.fn(),
      clearAll: vi.fn(),
      schedulePluginFollowUpTimer: vi.fn(),
      getPluginFollowUpContext: vi.fn(),
      hasPluginFollowUp: vi.fn().mockReturnValue(false),
      markPluginFollowUpFired: vi.fn(),
      cancelPluginFollowUpsForNode: vi.fn().mockResolvedValue(undefined),
      cancelAllPluginFollowUps: vi.fn().mockResolvedValue(undefined),
      shouldCancelPluginFollowUpsOnResponse: vi.fn().mockReturnValue(true),
      getPluginFollowUpResponseBehavior: vi.fn().mockReturnValue(null),
    };
    const log = { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), trace: vi.fn() } as any;
    const onTransition = vi.fn().mockResolvedValue(undefined);
    const stateManager = createSessionStateManager(session);

    const router = new EventRouter(
      { session, stateManager, eventLogger, timerService, messengerService: { sendMessage: vi.fn() }, log },
      { getNode: () => node, getOutgoingEdges: () => [timerEdge], onTransition }
    );

    const event: JourneyEvent = {
      type: "timeout",
      userId: "user-1",
      sessionId: "session-1",
      timestamp: new Date().toISOString(),
      payload: { timerId: "timer-1" },
    };

    await router.handle(event);

    expect(session.context.userResponse).toBeUndefined();
    expect(onTransition).toHaveBeenCalled();
  });
});

describe("EventRouter activeButtons O(1) routing", () => {
  const node: JourneyNodeData = {
    id: "msg",
    type: "custom",
    position: { x: 0, y: 0 },
    data: {
      type: "message",
      schemaVersion: 2,
      contentFormat: "text",
      label: "Message",
      content: "Pick an option",
      responseType: "buttons",
      buttons: [
        { id: "btn-a", text: "Option A", targetNodeId: "node-a" },
        { id: "btn-b", text: "Option B", targetNodeId: "node-b" },
      ],
    },
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: "1.0.0",
      status: "active",
    },
  };

  const edges: JourneyEdgeData[] = [
    { id: "edge-a", source: "msg", target: "node-a", edgeType: "default" },
    { id: "edge-b", source: "msg", target: "node-b", edgeType: "default" },
  ];

  it("should route via activeButtons for O(1) lookup", async () => {
    const session = createSession({
      activeButtons: [
        { id: "btn-a", text: "Option A", targetNodeId: "node-a", source: "node" },
        { id: "btn-b", text: "Option B", targetNodeId: "node-b", source: "node" },
      ],
    });
    const { router, onTransition } = createRouter({ session, node, edges });

    const event: JourneyEvent = {
      type: "button_click",
      userId: "user-1",
      sessionId: "session-1",
      timestamp: new Date().toISOString(),
      payload: { buttonId: "btn-b" },
    };

    await router.handle(event);

    expect(onTransition).toHaveBeenCalledWith("node-b", "button_click", "btn-b");
  });

  it("should fallback to node.data.buttons when activeButtons is empty", async () => {
    const session = createSession({
      activeButtons: undefined, // No active buttons set
    });
    const { router, onTransition } = createRouter({ session, node, edges });

    const event: JourneyEvent = {
      type: "button_click",
      userId: "user-1",
      sessionId: "session-1",
      timestamp: new Date().toISOString(),
      payload: { buttonId: "btn-a" },
    };

    await router.handle(event);

    expect(onTransition).toHaveBeenCalledWith("node-a", "button_click", "btn-a");
  });

  it("should clear activeButtons after successful transition", async () => {
    const session = createSession({
      activeButtons: [
        { id: "btn-a", text: "Option A", targetNodeId: "node-a", source: "node" },
      ],
    });
    const stateManager = createSessionStateManager(session);
    const clearActiveButtonsSpy = vi.spyOn(stateManager, "clearActiveButtons");

    const eventLogger = { logEvent: vi.fn() };
    const timerService = {
      scheduleTimer: vi.fn(),
      cancelTimer: vi.fn(),
      cancelTimersForNode: vi.fn().mockResolvedValue(undefined),
      getEdgeForTimer: vi.fn(),
      markTimerFired: vi.fn(),
      clearAll: vi.fn(),
      schedulePluginFollowUpTimer: vi.fn(),
      getPluginFollowUpContext: vi.fn(),
      hasPluginFollowUp: vi.fn().mockReturnValue(false),
      markPluginFollowUpFired: vi.fn(),
      cancelPluginFollowUpsForNode: vi.fn().mockResolvedValue(undefined),
      cancelAllPluginFollowUps: vi.fn().mockResolvedValue(undefined),
      shouldCancelPluginFollowUpsOnResponse: vi.fn().mockReturnValue(true),
      getPluginFollowUpResponseBehavior: vi.fn().mockReturnValue(null),
    };
    const log = { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), trace: vi.fn() } as any;
    const onTransition = vi.fn().mockResolvedValue(undefined);

    const router = new EventRouter(
      { session, stateManager, eventLogger, timerService, messengerService: { sendMessage: vi.fn() }, log },
      { getNode: () => node, getOutgoingEdges: () => edges, onTransition }
    );

    const event: JourneyEvent = {
      type: "button_click",
      userId: "user-1",
      sessionId: "session-1",
      timestamp: new Date().toISOString(),
      payload: { buttonId: "btn-a" },
    };

    await router.handle(event);

    expect(clearActiveButtonsSpy).toHaveBeenCalled();
  });
});

describe("EventRouter message event guard evaluation", () => {
  const textNode: JourneyNodeData = {
    id: "msg",
    type: "custom",
    position: { x: 0, y: 0 },
    data: {
      type: "message",
      schemaVersion: 2,
      contentFormat: "text",
      label: "Message",
      content: "Type something",
      responseType: "text",
    },
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: "1.0.0",
      status: "active",
    },
  };

  const buttonOnlyNode: JourneyNodeData = {
    ...textNode,
    data: {
      type: "message" as const,
      schemaVersion: 2,
      contentFormat: "text",
      label: "Message",
      content: "Type something",
      responseType: "buttons",
      buttons: [{ id: "btn-1", text: "Click", targetNodeId: "next" }],
    },
  };

  it("should ignore text message on buttons-only node", async () => {
    const session = createSession({
      activeButtons: [{ id: "btn-1", text: "Click", targetNodeId: "next", source: "node" }],
    });
    const edges: JourneyEdgeData[] = [
      { id: "edge-1", source: "msg", target: "next", edgeType: "default" },
    ];
    const eventLogger = { logEvent: vi.fn() };
    const log = { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), trace: vi.fn() } as any;
    const onTransition = vi.fn();
    const stateManager = createSessionStateManager(session);
    const timerService = {
      scheduleTimer: vi.fn(),
      cancelTimer: vi.fn(),
      cancelTimersForNode: vi.fn().mockResolvedValue(undefined),
      getEdgeForTimer: vi.fn(),
      markTimerFired: vi.fn(),
      clearAll: vi.fn(),
      schedulePluginFollowUpTimer: vi.fn(),
      getPluginFollowUpContext: vi.fn(),
      hasPluginFollowUp: vi.fn().mockReturnValue(false),
      markPluginFollowUpFired: vi.fn(),
      cancelPluginFollowUpsForNode: vi.fn().mockResolvedValue(undefined),
      cancelAllPluginFollowUps: vi.fn().mockResolvedValue(undefined),
      shouldCancelPluginFollowUpsOnResponse: vi.fn().mockReturnValue(true),
      getPluginFollowUpResponseBehavior: vi.fn().mockReturnValue(null),
    };

    const router = new EventRouter(
      { session, stateManager, eventLogger, timerService, messengerService: { sendMessage: vi.fn() }, log },
      { getNode: () => buttonOnlyNode, getOutgoingEdges: () => edges, onTransition }
    );

    const event: JourneyEvent = {
      type: "message",
      userId: "user-1",
      sessionId: "session-1",
      timestamp: new Date().toISOString(),
      payload: { text: "unexpected text" },
    };

    await router.handle(event);

    expect(onTransition).not.toHaveBeenCalled();
    expect(log.debug).toHaveBeenCalledWith(
      expect.objectContaining({ responseType: "buttons" }),
      "engine:textMessageIgnored:buttonNodeExpected"
    );
  });

  it("should route text message on text node with passing guard", async () => {
    const session = createSession();
    const edges: JourneyEdgeData[] = [
      {
        id: "edge-1",
        source: "msg",
        target: "next",
        edgeType: "default",
        guard: { type: "expression", expression: "true" }, // Always passes
      },
    ];
    const { router, onTransition } = createRouter({ session, node: textNode, edges });

    const event: JourneyEvent = {
      type: "message",
      userId: "user-1",
      sessionId: "session-1",
      timestamp: new Date().toISOString(),
      payload: { text: "hello" },
    };

    await router.handle(event);

    expect(onTransition).toHaveBeenCalledWith("next", "message", undefined);
  });

  it("should not route text message when guard fails and no fallback", async () => {
    const session = createSession();
    const edges: JourneyEdgeData[] = [
      {
        id: "edge-1",
        source: "msg",
        target: "next",
        edgeType: "default",
        guard: { type: "expression", expression: "false" }, // Always fails
      },
    ];
    const eventLogger = { logEvent: vi.fn() };
    const log = { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), trace: vi.fn() } as any;
    const onTransition = vi.fn();
    const stateManager = createSessionStateManager(session);
    const timerService = {
      scheduleTimer: vi.fn(),
      cancelTimer: vi.fn(),
      cancelTimersForNode: vi.fn().mockResolvedValue(undefined),
      getEdgeForTimer: vi.fn(),
      markTimerFired: vi.fn(),
      clearAll: vi.fn(),
      schedulePluginFollowUpTimer: vi.fn(),
      getPluginFollowUpContext: vi.fn(),
      hasPluginFollowUp: vi.fn().mockReturnValue(false),
      markPluginFollowUpFired: vi.fn(),
      cancelPluginFollowUpsForNode: vi.fn().mockResolvedValue(undefined),
      cancelAllPluginFollowUps: vi.fn().mockResolvedValue(undefined),
      shouldCancelPluginFollowUpsOnResponse: vi.fn().mockReturnValue(true),
      getPluginFollowUpResponseBehavior: vi.fn().mockReturnValue(null),
    };

    const router = new EventRouter(
      { session, stateManager, eventLogger, timerService, messengerService: { sendMessage: vi.fn() }, log },
      { getNode: () => textNode, getOutgoingEdges: () => edges, onTransition }
    );

    const event: JourneyEvent = {
      type: "message",
      userId: "user-1",
      sessionId: "session-1",
      timestamp: new Date().toISOString(),
      payload: { text: "hello" },
    };

    await router.handle(event);

    expect(onTransition).not.toHaveBeenCalled();
  });

  it("should accept message on responseType any", async () => {
    const anyNode: JourneyNodeData = {
      ...textNode,
      data: {
        type: "message" as const,
        schemaVersion: 2,
        contentFormat: "text",
        label: "Message",
        content: "Type something",
        responseType: "any",
      },
    };
    const session = createSession();
    const edges: JourneyEdgeData[] = [
      { id: "edge-1", source: "msg", target: "next", edgeType: "default" },
    ];
    const { router, onTransition } = createRouter({ session, node: anyNode, edges });

    const event: JourneyEvent = {
      type: "message",
      userId: "user-1",
      sessionId: "session-1",
      timestamp: new Date().toISOString(),
      payload: { text: "hello" },
    };

    await router.handle(event);

    expect(onTransition).toHaveBeenCalled();
  });
});

describe("EventRouter session status validation", () => {
  const node: JourneyNodeData = {
    id: "msg",
    type: "custom",
    position: { x: 0, y: 0 },
    data: {
      type: "message",
      schemaVersion: 2,
      contentFormat: "text",
      label: "Message",
      content: "Test",
      responseType: "text",
    },
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: "1.0.0",
      status: "active",
    },
  };

  const edges: JourneyEdgeData[] = [
    { id: "edge-1", source: "msg", target: "next", edgeType: "default" },
  ];

  it("should process event for active session", async () => {
    const session = createSession({ status: "active" });
    const { router, onTransition } = createRouter({ session, node, edges });

    const event: JourneyEvent = {
      type: "message",
      userId: "user-1",
      sessionId: "session-1",
      timestamp: new Date().toISOString(),
      payload: { text: "hello" },
    };

    await router.handle(event);

    expect(onTransition).toHaveBeenCalled();
  });

  it("should reject event for completed session", async () => {
    const session = createSession({ status: "completed" });
    const eventLogger = { logEvent: vi.fn() };
    const log = { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), trace: vi.fn() } as any;
    const onTransition = vi.fn();
    const stateManager = createSessionStateManager(session);
    const timerService = {
      scheduleTimer: vi.fn(),
      cancelTimer: vi.fn(),
      cancelTimersForNode: vi.fn().mockResolvedValue(undefined),
      getEdgeForTimer: vi.fn(),
      markTimerFired: vi.fn(),
      clearAll: vi.fn(),
      schedulePluginFollowUpTimer: vi.fn(),
      getPluginFollowUpContext: vi.fn(),
      hasPluginFollowUp: vi.fn().mockReturnValue(false),
      markPluginFollowUpFired: vi.fn(),
      cancelPluginFollowUpsForNode: vi.fn().mockResolvedValue(undefined),
      cancelAllPluginFollowUps: vi.fn().mockResolvedValue(undefined),
      shouldCancelPluginFollowUpsOnResponse: vi.fn().mockReturnValue(true),
      getPluginFollowUpResponseBehavior: vi.fn().mockReturnValue(null),
    };

    const router = new EventRouter(
      { session, stateManager, eventLogger, timerService, messengerService: { sendMessage: vi.fn() }, log },
      { getNode: () => node, getOutgoingEdges: () => edges, onTransition }
    );

    const event: JourneyEvent = {
      type: "message",
      userId: "user-1",
      sessionId: "session-1",
      timestamp: new Date().toISOString(),
      payload: { text: "hello" },
    };

    await router.handle(event);

    expect(onTransition).not.toHaveBeenCalled();
    expect(log.warn).toHaveBeenCalledWith(
      expect.objectContaining({ status: "completed" }),
      "router:inactiveSession:eventIgnored"
    );
  });

  it("should reject event for error session", async () => {
    const session = createSession({ status: "error" });
    const eventLogger = { logEvent: vi.fn() };
    const log = { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), trace: vi.fn() } as any;
    const onTransition = vi.fn();
    const stateManager = createSessionStateManager(session);
    const timerService = {
      scheduleTimer: vi.fn(),
      cancelTimer: vi.fn(),
      cancelTimersForNode: vi.fn().mockResolvedValue(undefined),
      getEdgeForTimer: vi.fn(),
      markTimerFired: vi.fn(),
      clearAll: vi.fn(),
      schedulePluginFollowUpTimer: vi.fn(),
      getPluginFollowUpContext: vi.fn(),
      hasPluginFollowUp: vi.fn().mockReturnValue(false),
      markPluginFollowUpFired: vi.fn(),
      cancelPluginFollowUpsForNode: vi.fn().mockResolvedValue(undefined),
      cancelAllPluginFollowUps: vi.fn().mockResolvedValue(undefined),
      shouldCancelPluginFollowUpsOnResponse: vi.fn().mockReturnValue(true),
      getPluginFollowUpResponseBehavior: vi.fn().mockReturnValue(null),
    };

    const router = new EventRouter(
      { session, stateManager, eventLogger, timerService, messengerService: { sendMessage: vi.fn() }, log },
      { getNode: () => node, getOutgoingEdges: () => edges, onTransition }
    );

    const event: JourneyEvent = {
      type: "message",
      userId: "user-1",
      sessionId: "session-1",
      timestamp: new Date().toISOString(),
      payload: { text: "hello" },
    };

    await router.handle(event);

    expect(onTransition).not.toHaveBeenCalled();
  });
});

describe("EventRouter timer cancellation", () => {
  const node: JourneyNodeData = {
    id: "msg",
    type: "custom",
    position: { x: 0, y: 0 },
    data: {
      type: "message",
      schemaVersion: 2,
      contentFormat: "text",
      label: "Message",
      content: "Test",
      responseType: "any",
    },
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: "1.0.0",
      status: "active",
    },
  };

  const edges: JourneyEdgeData[] = [
    { id: "edge-1", source: "msg", target: "next", edgeType: "default" },
  ];

  it("should cancel timers on valid user action with matching edge", async () => {
    const session = createSession();
    const timerService = {
      scheduleTimer: vi.fn(),
      cancelTimer: vi.fn(),
      cancelTimersForNode: vi.fn().mockResolvedValue(undefined),
      getEdgeForTimer: vi.fn(),
      markTimerFired: vi.fn(),
      clearAll: vi.fn(),
      schedulePluginFollowUpTimer: vi.fn(),
      getPluginFollowUpContext: vi.fn(),
      hasPluginFollowUp: vi.fn().mockReturnValue(false),
      markPluginFollowUpFired: vi.fn(),
      cancelPluginFollowUpsForNode: vi.fn().mockResolvedValue(undefined),
      cancelAllPluginFollowUps: vi.fn().mockResolvedValue(undefined),
      shouldCancelPluginFollowUpsOnResponse: vi.fn().mockReturnValue(true),
      getPluginFollowUpResponseBehavior: vi.fn().mockReturnValue(null),
    };
    const eventLogger = { logEvent: vi.fn() };
    const log = { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), trace: vi.fn() } as any;
    const onTransition = vi.fn().mockResolvedValue(undefined);
    const stateManager = createSessionStateManager(session);

    const router = new EventRouter(
      { session, stateManager, eventLogger, timerService, messengerService: { sendMessage: vi.fn() }, log },
      { getNode: () => node, getOutgoingEdges: () => edges, onTransition }
    );

    const event: JourneyEvent = {
      type: "message",
      userId: "user-1",
      sessionId: "session-1",
      timestamp: new Date().toISOString(),
      payload: { text: "hello" },
    };

    await router.handle(event);

    expect(timerService.cancelTimersForNode).toHaveBeenCalledWith("msg");
    expect(timerService.cancelPluginFollowUpsForNode).toHaveBeenCalledWith("msg");
    expect(onTransition).toHaveBeenCalled();
  });

  it("should NOT cancel plugin follow-ups when shouldCancelPluginFollowUpsOnResponse returns false", async () => {
    const session = createSession();
    const timerService = {
      scheduleTimer: vi.fn(),
      cancelTimer: vi.fn(),
      cancelTimersForNode: vi.fn().mockResolvedValue(undefined),
      getEdgeForTimer: vi.fn(),
      markTimerFired: vi.fn(),
      clearAll: vi.fn(),
      schedulePluginFollowUpTimer: vi.fn(),
      getPluginFollowUpContext: vi.fn(),
      hasPluginFollowUp: vi.fn().mockReturnValue(false),
      markPluginFollowUpFired: vi.fn(),
      cancelPluginFollowUpsForNode: vi.fn().mockResolvedValue(undefined),
      cancelAllPluginFollowUps: vi.fn().mockResolvedValue(undefined),
      shouldCancelPluginFollowUpsOnResponse: vi.fn().mockReturnValue(false), // Don't cancel
      getPluginFollowUpResponseBehavior: vi.fn().mockReturnValue(null),
    };
    const eventLogger = { logEvent: vi.fn() };
    const log = { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), trace: vi.fn() } as any;
    const onTransition = vi.fn().mockResolvedValue(undefined);
    const stateManager = createSessionStateManager(session);

    const router = new EventRouter(
      { session, stateManager, eventLogger, timerService, messengerService: { sendMessage: vi.fn() }, log },
      { getNode: () => node, getOutgoingEdges: () => edges, onTransition }
    );

    const event: JourneyEvent = {
      type: "message",
      userId: "user-1",
      sessionId: "session-1",
      timestamp: new Date().toISOString(),
      payload: { text: "hello" },
    };

    await router.handle(event);

    expect(timerService.cancelTimersForNode).toHaveBeenCalled(); // Regular timers still cancelled
    expect(timerService.cancelPluginFollowUpsForNode).not.toHaveBeenCalled(); // Follow-ups NOT cancelled
    expect(log.debug).toHaveBeenCalledWith(
      expect.anything(),
      "router:pluginFollowUps:notCancelled:cancelOnAnyResponseFalse"
    );
  });
});

describe("EventRouter edge cases", () => {
  const node: JourneyNodeData = {
    id: "msg",
    type: "custom",
    position: { x: 0, y: 0 },
    data: {
      type: "message",
      schemaVersion: 2,
      contentFormat: "text",
      label: "Message",
      content: "Test",
      responseType: "buttons",
      buttons: [{ id: "btn-1", text: "Click", targetNodeId: "next" }],
    },
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: "1.0.0",
      status: "active",
    },
  };

  it("should handle button click with unknown button ID gracefully", async () => {
    const session = createSession({
      activeButtons: [{ id: "btn-1", text: "Click", targetNodeId: "next", source: "node" }],
    });
    // Need multiple edges to prevent fallback routing (fallback only applies when there's exactly 1 edge)
    const edges: JourneyEdgeData[] = [
      { id: "edge-1", source: "msg", target: "next", edgeType: "default" },
      { id: "edge-2", source: "msg", target: "other", edgeType: "default" },
    ];
    const eventLogger = { logEvent: vi.fn() };
    const log = { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), trace: vi.fn() } as any;
    const onTransition = vi.fn();
    const stateManager = createSessionStateManager(session);
    const timerService = {
      scheduleTimer: vi.fn(),
      cancelTimer: vi.fn(),
      cancelTimersForNode: vi.fn().mockResolvedValue(undefined),
      getEdgeForTimer: vi.fn(),
      markTimerFired: vi.fn(),
      clearAll: vi.fn(),
      schedulePluginFollowUpTimer: vi.fn(),
      getPluginFollowUpContext: vi.fn(),
      hasPluginFollowUp: vi.fn().mockReturnValue(false),
      markPluginFollowUpFired: vi.fn(),
      cancelPluginFollowUpsForNode: vi.fn().mockResolvedValue(undefined),
      cancelAllPluginFollowUps: vi.fn().mockResolvedValue(undefined),
      shouldCancelPluginFollowUpsOnResponse: vi.fn().mockReturnValue(true),
      getPluginFollowUpResponseBehavior: vi.fn().mockReturnValue(null),
    };

    const router = new EventRouter(
      { session, stateManager, eventLogger, timerService, messengerService: { sendMessage: vi.fn() }, log },
      { getNode: () => node, getOutgoingEdges: () => edges, onTransition }
    );

    const event: JourneyEvent = {
      type: "button_click",
      userId: "user-1",
      sessionId: "session-1",
      timestamp: new Date().toISOString(),
      payload: { buttonId: "unknown-btn" }, // Not in activeButtons
    };

    await router.handle(event);

    expect(onTransition).not.toHaveBeenCalled();
  });

  it("should handle node with no outgoing edges", async () => {
    const session = createSession();
    const deadEndNode: JourneyNodeData = {
      ...node,
      data: {
        type: "message" as const,
        schemaVersion: 2,
        contentFormat: "text",
        label: "Message",
        content: "Test",
        responseType: "text",
      },
    };
    const eventLogger = { logEvent: vi.fn() };
    const log = { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), trace: vi.fn() } as any;
    const onTransition = vi.fn();
    const stateManager = createSessionStateManager(session);
    const timerService = {
      scheduleTimer: vi.fn(),
      cancelTimer: vi.fn(),
      cancelTimersForNode: vi.fn().mockResolvedValue(undefined),
      getEdgeForTimer: vi.fn(),
      markTimerFired: vi.fn(),
      clearAll: vi.fn(),
      schedulePluginFollowUpTimer: vi.fn(),
      getPluginFollowUpContext: vi.fn(),
      hasPluginFollowUp: vi.fn().mockReturnValue(false),
      markPluginFollowUpFired: vi.fn(),
      cancelPluginFollowUpsForNode: vi.fn().mockResolvedValue(undefined),
      cancelAllPluginFollowUps: vi.fn().mockResolvedValue(undefined),
      shouldCancelPluginFollowUpsOnResponse: vi.fn().mockReturnValue(true),
      getPluginFollowUpResponseBehavior: vi.fn().mockReturnValue(null),
    };

    const router = new EventRouter(
      { session, stateManager, eventLogger, timerService, messengerService: { sendMessage: vi.fn() }, log },
      { getNode: () => deadEndNode, getOutgoingEdges: () => [], onTransition } // No edges!
    );

    const event: JourneyEvent = {
      type: "message",
      userId: "user-1",
      sessionId: "session-1",
      timestamp: new Date().toISOString(),
      payload: { text: "hello" },
    };

    await router.handle(event);

    expect(onTransition).not.toHaveBeenCalled();
  });
});

describe("EventRouter handler delegation", () => {
  const questionnaireNode: JourneyNodeData = {
    id: "questionnaire-node",
    type: "custom",
    position: { x: 0, y: 0 },
    data: {
      type: "questionnaire" as const,
      schemaVersion: 1,
      label: "Questionnaire",
      questions: [{ id: "q1", content: "What is your name?", responseType: "text", required: true }],
      allowBack: false,
      shuffle: false,
    },
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: "1.0.0",
      status: "active",
    },
  };

  const agentNode: JourneyNodeData = {
    id: "agent-node",
    type: "custom",
    position: { x: 0, y: 0 },
    data: {
      type: "agent" as const,
      schemaVersion: 1,
      label: "Agent",
      workflowKey: "test-workflow",
    },
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: "1.0.0",
      status: "active",
    },
  };

  const messageNode: JourneyNodeData = {
    id: "message-node",
    type: "custom",
    position: { x: 0, y: 0 },
    data: {
      type: "message" as const,
      schemaVersion: 2,
      contentFormat: "text",
      label: "Message",
      content: "Hello",
      responseType: "text",
    },
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: "1.0.0",
      status: "active",
    },
  };

  const edges: JourneyEdgeData[] = [
    { id: "edge-1", source: "questionnaire-node", target: "next", edgeType: "default" },
  ];

  function createDelegatingRouter(options: {
    session: EnhancedUserJourney;
    node: JourneyNodeData;
    edges: JourneyEdgeData[];
    handlerResponse?: {
      handled: boolean;
      action?: "continue" | "transition" | "validation_failed";
      reExecute?: boolean;
      timerAction?: "none" | "all";
      validationError?: string;
      targetNodeId?: string;
      trigger?: string;
    } | null;
  }) {
    const eventLogger = { logEvent: vi.fn() };
    const timerService = {
      scheduleTimer: vi.fn(),
      cancelTimer: vi.fn(),
      cancelTimersForNode: vi.fn().mockResolvedValue(undefined),
      getEdgeForTimer: vi.fn(),
      markTimerFired: vi.fn(),
      clearAll: vi.fn(),
      schedulePluginFollowUpTimer: vi.fn(),
      getPluginFollowUpContext: vi.fn(),
      hasPluginFollowUp: vi.fn().mockReturnValue(false),
      markPluginFollowUpFired: vi.fn(),
      cancelPluginFollowUpsForNode: vi.fn().mockResolvedValue(undefined),
      cancelAllPluginFollowUps: vi.fn().mockResolvedValue(undefined),
      shouldCancelPluginFollowUpsOnResponse: vi.fn().mockReturnValue(true),
      getPluginFollowUpResponseBehavior: vi.fn().mockReturnValue(null),
    };
    const messengerService = { sendMessage: vi.fn().mockResolvedValue({ success: true, messageIds: [] }) };
    const log = { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), trace: vi.fn() } as any;
    const onTransition = vi.fn().mockResolvedValue(undefined);
    const onReExecuteNode = vi.fn().mockResolvedValue(undefined);
    const stateManager = createSessionStateManager(options.session);

    // Mock handler that implements handleEvent
    const mockHandler = {
      nodeType: options.node.data.type,
      handleEvent: vi.fn().mockResolvedValue(options.handlerResponse ?? null),
      execute: vi.fn().mockResolvedValue({ action: "continue" }),
    };

    // Mock services returned by getServices
    const mockServices = {
      messenger: messengerService,
      timer: timerService,
      variable: {},
      template: {},
      expression: {},
    };

    const router = new EventRouter(
      { session: options.session, stateManager, eventLogger, timerService, messengerService, log },
      {
        getNode: () => options.node,
        getOutgoingEdges: () => options.edges,
        onTransition,
        onReExecuteNode,
        getHandler: (nodeType: string) => (nodeType === "message" ? undefined : mockHandler),
        getServices: () => mockServices as any,
      }
    );

    return { router, onTransition, onReExecuteNode, mockHandler, messengerService, timerService, log };
  }

  it("should delegate to handler that implements handleEvent and returns handled=true", async () => {
    const session = createSession({ currentNodeId: "questionnaire-node" });
    const { router, onTransition, onReExecuteNode, mockHandler } = createDelegatingRouter({
      session,
      node: questionnaireNode,
      edges,
      handlerResponse: {
        handled: true,
        action: "continue",
        reExecute: true,
        timerAction: "none",
      },
    });

    const event: JourneyEvent = {
      type: "message",
      userId: "user-1",
      sessionId: "session-1",
      timestamp: new Date().toISOString(),
      payload: { text: "John" },
    };

    await router.handle(event);

    // Handler should have been called
    expect(mockHandler.handleEvent).toHaveBeenCalledWith(
      event,
      expect.objectContaining({
        session,
        node: questionnaireNode,
      })
    );

    // onReExecuteNode should be called when reExecute=true
    expect(onReExecuteNode).toHaveBeenCalled();

    // onTransition should NOT be called - handler consumed the event
    expect(onTransition).not.toHaveBeenCalled();
  });

  it("should send validation error message when handler returns validation_failed", async () => {
    const session = createSession({ currentNodeId: "questionnaire-node" });
    const { router, messengerService, mockHandler } = createDelegatingRouter({
      session,
      node: questionnaireNode,
      edges,
      handlerResponse: {
        handled: true,
        action: "validation_failed",
        reExecute: true,
        timerAction: "none",
        validationError: "Please enter a valid name",
      },
    });

    const event: JourneyEvent = {
      type: "message",
      userId: "user-1",
      sessionId: "session-1",
      timestamp: new Date().toISOString(),
      payload: { text: "" }, // Empty - invalid
    };

    await router.handle(event);

    expect(mockHandler.handleEvent).toHaveBeenCalled();
    expect(messengerService.sendMessage).toHaveBeenCalledWith("Please enter a valid name");
  });

  it("should clear userResponse when validation fails", async () => {
    const session = createSession({ currentNodeId: "questionnaire-node" });
    const { router } = createDelegatingRouter({
      session,
      node: questionnaireNode,
      edges,
      handlerResponse: {
        handled: true,
        action: "validation_failed",
        reExecute: true,
        timerAction: "none",
      },
    });

    const event: JourneyEvent = {
      type: "message",
      userId: "user-1",
      sessionId: "session-1",
      timestamp: new Date().toISOString(),
      payload: { text: "invalid" },
    };

    await router.handle(event);

    // userResponse should be cleared after validation_failed
    expect(session.context.userResponse).toBeUndefined();
  });

  it("should transition when handler returns action=transition", async () => {
    const session = createSession({ currentNodeId: "questionnaire-node" });
    const { router, onTransition, mockHandler } = createDelegatingRouter({
      session,
      node: questionnaireNode,
      edges,
      handlerResponse: {
        handled: true,
        action: "transition",
        targetNodeId: "completion-node",
        trigger: "questionnaire_complete",
        reExecute: false,
        timerAction: "none",
      },
    });

    const event: JourneyEvent = {
      type: "message",
      userId: "user-1",
      sessionId: "session-1",
      timestamp: new Date().toISOString(),
      payload: { text: "final answer" },
    };

    await router.handle(event);

    expect(mockHandler.handleEvent).toHaveBeenCalled();
    expect(onTransition).toHaveBeenCalledWith("completion-node", "questionnaire_complete", undefined);
  });

  it("should fall through to normal routing when handler returns handled=false", async () => {
    const session = createSession({ currentNodeId: "questionnaire-node" });
    const timerEdges: JourneyEdgeData[] = [
      { id: "edge-1", source: "questionnaire-node", target: "timeout-node", edgeType: "timer" },
    ];
    const { router, onTransition, mockHandler, timerService } = createDelegatingRouter({
      session,
      node: questionnaireNode,
      edges: timerEdges,
      handlerResponse: null, // Handler returns null = not handled
    });

    // Mock timer lookup for the timeout event
    timerService.getEdgeForTimer.mockReturnValue("edge-1");

    const event: JourneyEvent = {
      type: "timeout",
      userId: "user-1",
      sessionId: "session-1",
      timestamp: new Date().toISOString(),
      payload: { timerId: "timer-1" },
    };

    await router.handle(event);

    // Handler was called but didn't handle it
    expect(mockHandler.handleEvent).toHaveBeenCalled();

    // Normal routing should take over -> transition via timer edge
    expect(onTransition).toHaveBeenCalledWith("timeout-node", "timeout", undefined);
  });

  it("should cancel timers when handler returns timerAction=all", async () => {
    const session = createSession({ currentNodeId: "agent-node" });
    const { router, timerService, mockHandler } = createDelegatingRouter({
      session,
      node: agentNode,
      edges: [{ id: "edge-1", source: "agent-node", target: "next", edgeType: "default" }],
      handlerResponse: {
        handled: true,
        action: "continue",
        reExecute: true,
        timerAction: "all", // Cancel all timers
      },
    });

    const event: JourneyEvent = {
      type: "message",
      userId: "user-1",
      sessionId: "session-1",
      timestamp: new Date().toISOString(),
      payload: { text: "user message" },
    };

    await router.handle(event);

    expect(mockHandler.handleEvent).toHaveBeenCalled();
    expect(timerService.cancelTimersForNode).toHaveBeenCalledWith("agent-node");
  });

  it("should skip handler delegation for nodes without handleEvent", async () => {
    const session = createSession({ currentNodeId: "message-node" });
    const { router, onTransition, mockHandler } = createDelegatingRouter({
      session,
      node: messageNode,
      edges: [{ id: "edge-1", source: "message-node", target: "next", edgeType: "default" }],
      handlerResponse: null,
    });

    const event: JourneyEvent = {
      type: "message",
      userId: "user-1",
      sessionId: "session-1",
      timestamp: new Date().toISOString(),
      payload: { text: "hello" },
    };

    await router.handle(event);

    // Handler should NOT be called for message nodes (getHandler returns null)
    expect(mockHandler.handleEvent).not.toHaveBeenCalled();

    // Normal routing should proceed
    expect(onTransition).toHaveBeenCalledWith("next", "message", undefined);
  });

  it("should log delegation result when handler consumes event", async () => {
    const session = createSession({ currentNodeId: "questionnaire-node" });
    const { router, log, mockHandler } = createDelegatingRouter({
      session,
      node: questionnaireNode,
      edges,
      handlerResponse: {
        handled: true,
        action: "continue",
        reExecute: true,
        timerAction: "none",
      },
    });

    const event: JourneyEvent = {
      type: "message",
      userId: "user-1",
      sessionId: "session-1",
      timestamp: new Date().toISOString(),
      payload: { text: "test" },
    };

    await router.handle(event);

    expect(mockHandler.handleEvent).toHaveBeenCalled();
    expect(log.debug).toHaveBeenCalledWith(
      expect.objectContaining({
        nodeId: "questionnaire-node",
        nodeType: "questionnaire",
        action: "continue",
        reExecute: true,
      }),
      "router:handlerDelegation:handled"
    );
  });
});
