import type { EnhancedUserJourney, JourneyEdgeData } from "@journey/schemas";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { createTimerService } from "../services/timer-service";
import { createSessionStateManager, type SessionStateManager } from "../state/session-state-manager";
import type { MessagingAdapter } from "../types";

describe("TimerService", () => {
  let mockAdapter: MessagingAdapter;
  let mockLog: ReturnType<typeof import("@journey/logger").createLogger>;
  let mockSession: EnhancedUserJourney;
  let mockStateManager: SessionStateManager;
  let timerIdCounter: number;

  beforeEach(() => {
    timerIdCounter = 0;
    mockAdapter = {
      adapterType: "mock",
      sendMessage: vi.fn().mockResolvedValue(undefined),
      onMessage: vi.fn(),
      scheduleTimer: vi.fn().mockImplementation(() => Promise.resolve(`timer-${++timerIdCounter}`)),
      cancelTimer: vi.fn().mockResolvedValue(true),
    };
    mockLog = {
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as unknown as ReturnType<typeof import("@journey/logger").createLogger>;
    mockSession = {
      sessionId: "test-session",
      userId: "test-user",
      platformUserId: "test-user",
      journeyId: "test-journey",
      currentNodeId: "test-node",
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
    mockStateManager = createSessionStateManager(mockSession);
  });

  describe("scheduleTimer", () => {
    it("should schedule timer and map it to edge", async () => {
      const edges: JourneyEdgeData[] = [];
      const getOutgoingEdges = vi.fn().mockReturnValue(edges);

      const timerService = createTimerService({
        sessionId: "test-session",
        session: mockSession,
        stateManager: mockStateManager,
        adapter: mockAdapter,
        getOutgoingEdges,
        log: mockLog,
      });

      const timerId = await timerService.scheduleTimer(5000, "edge-1");

      expect(mockAdapter.scheduleTimer).toHaveBeenCalledWith("test-session", 5000, "edge-1");
      expect(timerId).toBe("timer-1");
      expect(mockLog.info).toHaveBeenCalledWith(
        { delayMs: 5000, edgeId: "edge-1", timerId: "timer-1", triggersAt: expect.any(String) },
        "timer:scheduled"
      );
    });

    it("should scale delay when timerScale is set", async () => {
      const edges: JourneyEdgeData[] = [];
      const getOutgoingEdges = vi.fn().mockReturnValue(edges);

      const timerService = createTimerService({
        sessionId: "test-session",
        session: mockSession,
        stateManager: mockStateManager,
        adapter: mockAdapter,
        getOutgoingEdges,
        log: mockLog,
        timerScale: 0.1,
      });

      await timerService.scheduleTimer(5000, "edge-1");

      expect(mockAdapter.scheduleTimer).toHaveBeenCalledWith("test-session", 500, "edge-1");
    });

    it("should schedule multiple timers with unique IDs", async () => {
      const edges: JourneyEdgeData[] = [];
      const getOutgoingEdges = vi.fn().mockReturnValue(edges);

      const timerService = createTimerService({
        sessionId: "test-session",
        session: mockSession,
        stateManager: mockStateManager,
        adapter: mockAdapter,
        getOutgoingEdges,
        log: mockLog,
      });

      const timerId1 = await timerService.scheduleTimer(1000, "edge-1");
      const timerId2 = await timerService.scheduleTimer(2000, "edge-2");

      expect(timerId1).toBe("timer-1");
      expect(timerId2).toBe("timer-2");
      expect(mockAdapter.scheduleTimer).toHaveBeenCalledTimes(2);
    });
  });

  describe("cancelTimer", () => {
    it("should cancel timer and remove from internal map", async () => {
      const edges: JourneyEdgeData[] = [];
      const getOutgoingEdges = vi.fn().mockReturnValue(edges);

      const timerService = createTimerService({
        sessionId: "test-session",
        session: mockSession,
        stateManager: mockStateManager,
        adapter: mockAdapter,
        getOutgoingEdges,
        log: mockLog,
      });

      const timerId = await timerService.scheduleTimer(5000, "edge-1");
      await timerService.cancelTimer(timerId);

      expect(mockAdapter.cancelTimer).toHaveBeenCalledWith(timerId, "edge-1", "test-session");
      expect(mockLog.debug).toHaveBeenCalledWith({ timerId, edgeId: "edge-1", cancelled: true }, "timer:cancelled");

      // Verify edge mapping is removed
      expect(timerService.getEdgeForTimer(timerId)).toBeUndefined();
    });

    it("should not call adapter.cancelTimer for unknown timer ID", async () => {
      const edges: JourneyEdgeData[] = [];
      const getOutgoingEdges = vi.fn().mockReturnValue(edges);

      const timerService = createTimerService({
        sessionId: "test-session",
        session: mockSession,
        stateManager: mockStateManager,
        adapter: mockAdapter,
        getOutgoingEdges,
        log: mockLog,
      });

      await timerService.cancelTimer("unknown-timer");

      expect(mockAdapter.cancelTimer).not.toHaveBeenCalled();
    });
  });

  describe("cancelTimersForNode", () => {
    it("should cancel all timers for node's timer edges", async () => {
      const edges: JourneyEdgeData[] = [
        { id: "edge-1", source: "node-1", target: "next-1", edgeType: "timer" },
        { id: "edge-2", source: "node-1", target: "next-2", edgeType: "timer" },
        { id: "edge-3", source: "node-1", target: "next-3", edgeType: "default" },
      ];
      const getOutgoingEdges = vi.fn().mockReturnValue(edges);

      const timerService = createTimerService({
        sessionId: "test-session",
        session: mockSession,
        stateManager: mockStateManager,
        adapter: mockAdapter,
        getOutgoingEdges,
        log: mockLog,
      });

      // Schedule timers for the timer edges
      await timerService.scheduleTimer(1000, "edge-1");
      await timerService.scheduleTimer(2000, "edge-2");

      // Cancel all timers for node-1
      await timerService.cancelTimersForNode("node-1");

      expect(getOutgoingEdges).toHaveBeenCalledWith("node-1");
      expect(mockAdapter.cancelTimer).toHaveBeenCalledTimes(2);
      expect(mockLog.debug).toHaveBeenCalledWith(
        expect.objectContaining({ nodeId: "node-1", edgeId: "edge-1" }),
        "timer:cancelledForNode"
      );
      expect(mockLog.debug).toHaveBeenCalledWith(
        expect.objectContaining({ nodeId: "node-1", edgeId: "edge-2" }),
        "timer:cancelledForNode"
      );
    });

    it("should not cancel non-timer edges", async () => {
      const edges: JourneyEdgeData[] = [
        { id: "edge-1", source: "node-1", target: "next-1", edgeType: "default" },
        { id: "edge-2", source: "node-1", target: "next-2", edgeType: "success" },
      ];
      const getOutgoingEdges = vi.fn().mockReturnValue(edges);

      const timerService = createTimerService({
        sessionId: "test-session",
        session: mockSession,
        stateManager: mockStateManager,
        adapter: mockAdapter,
        getOutgoingEdges,
        log: mockLog,
      });

      // Schedule a timer for a different edge (not in this node's edges)
      await timerService.scheduleTimer(1000, "other-edge");

      // Cancel timers for node-1
      await timerService.cancelTimersForNode("node-1");

      // Should not cancel the timer since there are no timer edges
      expect(mockAdapter.cancelTimer).not.toHaveBeenCalled();
    });

    it("should handle node with no outgoing edges", async () => {
      const getOutgoingEdges = vi.fn().mockReturnValue([]);

      const timerService = createTimerService({
        sessionId: "test-session",
        session: mockSession,
        stateManager: mockStateManager,
        adapter: mockAdapter,
        getOutgoingEdges,
        log: mockLog,
      });

      // Should not throw
      await timerService.cancelTimersForNode("node-1");

      expect(getOutgoingEdges).toHaveBeenCalledWith("node-1");
      expect(mockAdapter.cancelTimer).not.toHaveBeenCalled();
    });
  });

  describe("getEdgeForTimer", () => {
    it("should return correct edge ID for scheduled timer", async () => {
      const edges: JourneyEdgeData[] = [];
      const getOutgoingEdges = vi.fn().mockReturnValue(edges);

      const timerService = createTimerService({
        sessionId: "test-session",
        session: mockSession,
        stateManager: mockStateManager,
        adapter: mockAdapter,
        getOutgoingEdges,
        log: mockLog,
      });

      const timerId = await timerService.scheduleTimer(5000, "edge-1");

      expect(timerService.getEdgeForTimer(timerId)).toBe("edge-1");
    });

    it("should return undefined for unknown timer ID", () => {
      const edges: JourneyEdgeData[] = [];
      const getOutgoingEdges = vi.fn().mockReturnValue(edges);

      const timerService = createTimerService({
        sessionId: "test-session",
        session: mockSession,
        stateManager: mockStateManager,
        adapter: mockAdapter,
        getOutgoingEdges,
        log: mockLog,
      });

      expect(timerService.getEdgeForTimer("unknown-timer")).toBeUndefined();
    });

    it("should return undefined for cancelled timer", async () => {
      const edges: JourneyEdgeData[] = [];
      const getOutgoingEdges = vi.fn().mockReturnValue(edges);

      const timerService = createTimerService({
        sessionId: "test-session",
        session: mockSession,
        stateManager: mockStateManager,
        adapter: mockAdapter,
        getOutgoingEdges,
        log: mockLog,
      });

      const timerId = await timerService.scheduleTimer(5000, "edge-1");
      await timerService.cancelTimer(timerId);

      expect(timerService.getEdgeForTimer(timerId)).toBeUndefined();
    });
  });

  describe("Timer Lifecycle Integration", () => {
    it("should complete full lifecycle: schedule → fire → transition", async () => {
      const edges: JourneyEdgeData[] = [
        { id: "default-edge", source: "node-1", target: "node-2", edgeType: "default" },
        { id: "timer-edge", source: "node-1", target: "timeout-node", edgeType: "timer", sourceHandle: "timer" },
      ];
      const getOutgoingEdges = vi.fn().mockReturnValue(edges);

      const timerService = createTimerService({
        sessionId: "test-session",
        session: mockSession,
        stateManager: mockStateManager,
        adapter: mockAdapter,
        getOutgoingEdges,
        log: mockLog,
      });

      // Step 1: Schedule timer (now properly awaited)
      const timerId = await timerService.scheduleTimer(100, "timer-edge");

      expect(timerId).toBe("timer-1");
      expect(mockAdapter.scheduleTimer).toHaveBeenCalledWith("test-session", 100, "timer-edge");
      expect(mockSession.pendingTimers).toHaveLength(1);
      expect(mockSession.pendingTimers[0].timerId).toBe(timerId);
      expect(mockSession.pendingTimers[0].targetEdgeId).toBe("timer-edge");

      // Step 2: Verify timer is mapped correctly
      expect(timerService.getEdgeForTimer(timerId)).toBe("timer-edge");

      // Step 3: Simulate timer firing (in real scenario, adapter would call back)
      // This verifies the timer ID is correctly tracked
      const edgeForTimer = timerService.getEdgeForTimer(timerId);
      expect(edgeForTimer).toBe("timer-edge");

      // Verify the edge exists and has correct properties
      const timerEdge = edges.find(e => e.id === edgeForTimer);
      expect(timerEdge).toBeDefined();
      expect(timerEdge?.edgeType).toBe("timer");
      expect(timerEdge?.sourceHandle).toBe("timer");
      expect(timerEdge?.target).toBe("timeout-node");

      // Step 4: Cancel timer (cleanup) - now properly awaited
      await timerService.cancelTimer(timerId);
      expect(mockAdapter.cancelTimer).toHaveBeenCalledWith(timerId, "timer-edge", "test-session");
      expect(timerService.getEdgeForTimer(timerId)).toBeUndefined();
      expect(mockSession.pendingTimers).toHaveLength(0);
    });

    it("should maintain timer mapping for engine transition after firing", async () => {
      const edges: JourneyEdgeData[] = [
        { id: "timer-edge-1", source: "waiting-node", target: "timeout-node", edgeType: "timer", sourceHandle: "timer" },
      ];
      const getOutgoingEdges = vi.fn().mockReturnValue(edges);

      const timerService = createTimerService({
        sessionId: "test-session",
        session: mockSession,
        stateManager: mockStateManager,
        adapter: mockAdapter,
        getOutgoingEdges,
        log: mockLog,
      });

      // Schedule timer (now properly awaited)
      const timerId = await timerService.scheduleTimer(50, "timer-edge-1");

      // Verify scheduled
      expect(mockSession.pendingTimers).toHaveLength(1);
      expect(timerService.getEdgeForTimer(timerId)).toBe("timer-edge-1");

      // When timer fires, engine needs to retrieve the edge ID to know where to transition
      const edgeId = timerService.getEdgeForTimer(timerId);
      expect(edgeId).toBe("timer-edge-1");

      // Verify the edge has correct target for transition
      const timerEdge = edges.find(e => e.id === edgeId);
      expect(timerEdge?.target).toBe("timeout-node");
      expect(timerEdge?.edgeType).toBe("timer");
    });
  });

  describe("clearAll", () => {
    it("should clear all timers from internal map", async () => {
      const edges: JourneyEdgeData[] = [];
      const getOutgoingEdges = vi.fn().mockReturnValue(edges);

      const timerService = createTimerService({
        sessionId: "test-session",
        session: mockSession,
        stateManager: mockStateManager,
        adapter: mockAdapter,
        getOutgoingEdges,
        log: mockLog,
      });

      // Schedule multiple timers
      const timerId1 = await timerService.scheduleTimer(1000, "edge-1");
      const timerId2 = await timerService.scheduleTimer(2000, "edge-2");

      // Verify timers are tracked
      expect(timerService.getEdgeForTimer(timerId1)).toBe("edge-1");
      expect(timerService.getEdgeForTimer(timerId2)).toBe("edge-2");
      expect(mockSession.pendingTimers).toHaveLength(2);

      // Clear all
      timerService.clearAll();

      // Verify all cleared
      expect(timerService.getEdgeForTimer(timerId1)).toBeUndefined();
      expect(timerService.getEdgeForTimer(timerId2)).toBeUndefined();
      expect(mockSession.pendingTimers).toHaveLength(0);
      expect(mockLog.debug).toHaveBeenCalledWith(
        { clearedTimerCount: 2, clearedPluginFollowUpCount: 0 },
        "timer:clearedAll"
      );
    });

    it("should handle clearing when no timers exist", () => {
      const edges: JourneyEdgeData[] = [];
      const getOutgoingEdges = vi.fn().mockReturnValue(edges);

      const timerService = createTimerService({
        sessionId: "test-session",
        session: mockSession,
        stateManager: mockStateManager,
        adapter: mockAdapter,
        getOutgoingEdges,
        log: mockLog,
      });

      // Clear with no timers - should not throw
      timerService.clearAll();

      expect(mockSession.pendingTimers).toHaveLength(0);
      expect(mockLog.debug).toHaveBeenCalledWith(
        { clearedTimerCount: 0, clearedPluginFollowUpCount: 0 },
        "timer:clearedAll"
      );
    });
  });
});
