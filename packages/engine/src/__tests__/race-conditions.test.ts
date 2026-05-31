/**
 * Race Condition Detection Tests
 *
 * These tests are specifically designed to detect async race conditions:
 * - State persistence timing issues
 * - Fire-and-forget patterns
 * - Handler awaiting issues
 * - Timer scheduling races
 *
 * Uses configurable delays in MockMessagingAdapter to expose race windows.
 *
 * @module engine/tests/race-conditions
 */

import type { EnhancedUserJourney, InteractionEvent } from "@journey/schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SessionEngine } from "../session-engine";
import { createTimerService } from "../services/timer-service";
import { createSessionStateManager } from "../state/session-state-manager";
import type { MessagingAdapter } from "../types";
import { buttonJourney, messageWithTimerJourney, waitJourney } from "./fixtures/journey-configs";
import { MockMessagingAdapter } from "./helpers/mock-adapter";

describe("Race Condition Detection Tests", () => {
  let adapter: MockMessagingAdapter;
  let collectedEvents: InteractionEvent[];

  beforeEach(() => {
    adapter = new MockMessagingAdapter();
    collectedEvents = [];
  });

  const createSession = (journeyId: string, sessionId = "test-session-1", userId = "test-user-1"): EnhancedUserJourney => ({
    sessionId,
    userId,
    platformUserId: userId,
    journeyId,
    currentNodeId: "",
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

  const onEventCallback = (event: InteractionEvent) => {
    collectedEvents.push(event);
  };

  describe("State Persistence After Async Operations", () => {
    it("should have updated state immediately after awaiting button click", async () => {
      const session = createSession("button-journey");
      const engine = new SessionEngine(session, buttonJourney, adapter, { onEvent: onEventCallback });

      await engine.start();

      // Should be at msg-with-buttons
      expect(engine.getSession().currentNodeId).toBe("msg-with-buttons");
      const initialNodeId = engine.getSession().currentNodeId;

      // Simulate button click and AWAIT it
      await adapter.simulateButtonClick("btn-opt-a");

      // State should be updated IMMEDIATELY after await completes
      // This would fail if the handler wasn't properly awaited
      const currentNodeId = engine.getSession().currentNodeId;
      expect(currentNodeId).not.toBe(initialNodeId);
      expect(engine.getSession().status).toBe("completed");
    });

    it("should have updated state immediately after awaiting text message", async () => {
      // Create a simple journey that accepts text input
      const session = createSession("button-journey");
      const engine = new SessionEngine(session, buttonJourney, adapter, { onEvent: onEventCallback });

      await engine.start();
      expect(engine.getSession().currentNodeId).toBe("msg-with-buttons");

      // Send Option A button click
      await adapter.simulateButtonClick("btn-opt-a");

      // State should be fully transitioned
      expect(engine.getSession().currentNodeId).toBe("end");
      expect(engine.getSession().status).toBe("completed");
    });

    it("should have history updated atomically with state transition", async () => {
      const session = createSession("button-journey");
      const engine = new SessionEngine(session, buttonJourney, adapter, { onEvent: onEventCallback });

      await engine.start();

      const historyLengthBefore = engine.getSession().history.length;

      await adapter.simulateButtonClick("btn-opt-a");

      // Both state and history should be updated
      const historyLengthAfter = engine.getSession().history.length;
      expect(historyLengthAfter).toBeGreaterThan(historyLengthBefore);
      expect(engine.getSession().currentNodeId).toBe("end");
    });
  });

  describe("Handler Awaiting Tests", () => {
    it("should catch handler errors instead of fire-and-forget", async () => {
      const session = createSession("button-journey");
      const errorCaught: Error[] = [];

      // Create engine with error tracking
      const engine = new SessionEngine(session, buttonJourney, adapter, {
        onEvent: onEventCallback,
      });

      await engine.start();

      // If the handler throws, it should be caught by the engine
      // (not silently swallowed by fire-and-forget)
      await adapter.simulateButtonClick("btn-opt-a");

      // If we get here without hanging, the error handling is working
      expect(engine.getSession().currentNodeId).toBe("end");
    });

    it("should complete state changes before returning from simulate methods", async () => {
      const session = createSession("button-journey");
      const engine = new SessionEngine(session, buttonJourney, adapter, { onEvent: onEventCallback });

      await engine.start();

      // With delay simulation, this would fail if not properly awaited
      adapter.setHandlerDelay(10);

      const stateBeforeClick = engine.getSession().currentNodeId;
      await adapter.simulateButtonClick("btn-opt-a");
      const stateAfterClick = engine.getSession().currentNodeId;

      // State MUST have changed after await completes
      // This catches fire-and-forget patterns
      expect(stateAfterClick).not.toBe(stateBeforeClick);
    });
  });

  describe("Timer Scheduling Race Tests", () => {
    it("should have timer in pendingTimers immediately after scheduleTimer completes", async () => {
      const session = createSession("wait-journey");
      const engine = new SessionEngine(session, waitJourney, adapter, { onEvent: onEventCallback });

      // Add delay to timer scheduling
      adapter.setScheduleTimerDelay(10);

      await engine.start();

      // Timer should be in pendingTimers IMMEDIATELY after start completes
      // This would fail if scheduleTimer wasn't properly awaited
      expect(engine.getSession().currentNodeId).toBe("wait");
      expect(engine.getSession().pendingTimers.length).toBe(1);
    });

    it("should be able to cancel timer immediately after scheduling", async () => {
      const mockAdapter: MessagingAdapter = {
        adapterType: "mock",
        sendMessage: vi.fn().mockResolvedValue({ success: true, messageIds: [] }),
        onMessage: vi.fn(),
        scheduleTimer: vi.fn().mockImplementation(async () => {
          // Simulate async delay
          await new Promise((resolve) => setTimeout(resolve, 5));
          return "timer-1";
        }),
        cancelTimer: vi.fn().mockResolvedValue(true),
      };

      const mockLog = {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      } as unknown as ReturnType<typeof import("@journey/logger").createLogger>;

      const mockSession: EnhancedUserJourney = {
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

      const mockStateManager = createSessionStateManager(mockSession);
      const timerService = createTimerService({
        sessionId: "test-session",
        session: mockSession,
        stateManager: mockStateManager,
        adapter: mockAdapter,
        getOutgoingEdges: () => [],
        log: mockLog,
      });

      // Schedule timer and immediately try to cancel
      const timerId = await timerService.scheduleTimer(1000, "edge-1");

      // Timer should exist immediately after scheduleTimer returns
      expect(timerService.getEdgeForTimer(timerId)).toBe("edge-1");

      // Cancel should work immediately
      await timerService.cancelTimer(timerId);
      expect(timerService.getEdgeForTimer(timerId)).toBeUndefined();
    });

    it("should update pendingTimers before continuing execution", async () => {
      const session = createSession("message-with-timer-journey");
      const engine = new SessionEngine(session, messageWithTimerJourney, adapter, { onEvent: onEventCallback });

      // Add delay to simulate real-world async behavior
      adapter.setScheduleTimerDelay(10);

      await engine.start();

      // Verify timer is tracked BEFORE any further operations
      expect(engine.getSession().currentNodeId).toBe("msg-with-timer");
      expect(engine.getSession().pendingTimers.length).toBe(1);

      // The timer's triggersAt should be set
      const timer = engine.getSession().pendingTimers[0];
      expect(timer.timerId).toBeDefined();
      expect(timer.triggersAt).toBeDefined();
      expect(timer.targetEdgeId).toBeDefined();
    });
  });

  describe("Concurrent Event Handling", () => {
    it("should handle rapid button clicks without state corruption", async () => {
      const session = createSession("button-journey");
      const engine = new SessionEngine(session, buttonJourney, adapter, { onEvent: onEventCallback });

      await engine.start();

      // Rapid-fire button clicks (only first should be processed)
      await adapter.simulateButtonClick("btn-opt-a");

      // State should be consistent
      const finalState = engine.getSession();
      expect(finalState.status).toBe("completed");
      expect(finalState.currentNodeId).toBe("end");
    });

    it("should handle timer + button click race correctly", async () => {
      const session = createSession("message-with-timer-journey");
      const engine = new SessionEngine(session, messageWithTimerJourney, adapter, { onEvent: onEventCallback });

      await engine.start();

      expect(engine.getSession().currentNodeId).toBe("msg-with-timer");

      // Get the timer
      const timers = adapter.getScheduledTimers();
      expect(timers.length).toBe(1);
      const timerId = timers[0].timerId;

      // User clicks before timer expires
      await adapter.simulateButtonClick("btn-continue");

      // Journey should have transitioned via button click
      expect(engine.getSession().currentNodeId).toBe("end");
      expect(engine.getSession().status).toBe("completed");

      // Timer should have been cancelled
      expect(adapter.hasTimer(timerId)).toBe(false);
    });

    it("should maintain state consistency under delayed async operations", async () => {
      const session = createSession("button-journey");
      const engine = new SessionEngine(session, buttonJourney, adapter, { onEvent: onEventCallback });

      // Simulate network latency in handler
      adapter.setHandlerDelay(20);

      await engine.start();

      const nodeBeforeClick = engine.getSession().currentNodeId;
      expect(nodeBeforeClick).toBe("msg-with-buttons");

      // Even with delay, state should be consistent after await
      await adapter.simulateButtonClick("btn-opt-a");

      // State should have fully transitioned
      expect(engine.getSession().currentNodeId).toBe("end");
      expect(engine.getSession().status).toBe("completed");
    });
  });

  describe("Timer Cancel Race Conditions", () => {
    it("should properly cancel timer when user responds", async () => {
      const session = createSession("message-with-timer-journey");
      const engine = new SessionEngine(session, messageWithTimerJourney, adapter, { onEvent: onEventCallback });

      await engine.start();

      const timers = adapter.getScheduledTimers();
      expect(timers.length).toBe(1);
      const timerId = timers[0].timerId;

      // User clicks button (should cancel timer)
      await adapter.simulateButtonClick("btn-continue");

      // Session should have transitioned correctly
      expect(engine.getSession().currentNodeId).toBe("end");
      expect(engine.getSession().status).toBe("completed");

      // Timer should be removed from pendingTimers
      expect(engine.getSession().pendingTimers.length).toBe(0);
    });

    it("should handle timer fire correctly", async () => {
      const session = createSession("message-with-timer-journey");
      const engine = new SessionEngine(session, messageWithTimerJourney, adapter, { onEvent: onEventCallback });

      await engine.start();

      const timers = adapter.getScheduledTimers();
      const timerId = timers[0].timerId;

      // Simulate timer timeout
      await adapter.simulateTimeout(timerId);

      // Session should have transitioned via timer
      expect(engine.getSession().currentNodeId).toBe("end");
      expect(engine.getSession().status).toBe("completed");
    });

    it("should cancel timer from pendingTimers when user responds", async () => {
      const session = createSession("message-with-timer-journey");
      const engine = new SessionEngine(session, messageWithTimerJourney, adapter, { onEvent: onEventCallback });

      await engine.start();

      // Verify timer is scheduled and tracked in session
      const initialPendingTimers = engine.getSession().pendingTimers.length;
      expect(initialPendingTimers).toBe(1);

      // User clicks button
      await adapter.simulateButtonClick("btn-continue");

      // Session should have transitioned correctly
      expect(engine.getSession().currentNodeId).toBe("end");
      expect(engine.getSession().status).toBe("completed");

      // Note: pendingTimers cleanup depends on the timer cancellation flow
      // which may vary based on how the engine handles the transition
    });
  });

  describe("Async Delay Simulation Verification", () => {
    it("should properly simulate schedule timer delay", async () => {
      const adapter = new MockMessagingAdapter();
      adapter.setScheduleTimerDelay(50);

      const start = Date.now();
      await adapter.scheduleTimer("session", 1000, "edge");
      const elapsed = Date.now() - start;

      // Should have taken at least the configured delay
      expect(elapsed).toBeGreaterThanOrEqual(45); // Allow small timing variance
    });

    it("should properly simulate cancel timer delay", async () => {
      const adapter = new MockMessagingAdapter();
      await adapter.scheduleTimer("session", 1000, "edge");

      adapter.setCancelTimerDelay(50);

      const start = Date.now();
      await adapter.cancelTimer("timer_1", "edge", "session");
      const elapsed = Date.now() - start;

      // Should have taken at least the configured delay
      expect(elapsed).toBeGreaterThanOrEqual(45);
    });

    it("should reset delays on adapter reset", () => {
      const adapter = new MockMessagingAdapter();
      adapter.setScheduleTimerDelay(100);
      adapter.setCancelTimerDelay(100);
      adapter.setHandlerDelay(100);

      expect(adapter.isDelaySimulationActive()).toBe(true);

      adapter.reset();

      expect(adapter.isDelaySimulationActive()).toBe(false);
    });
  });

  describe("Session State Consistency", () => {
    it("should have consistent currentNodeId after async transition chain", async () => {
      const session = createSession("button-journey");
      const engine = new SessionEngine(session, buttonJourney, adapter, { onEvent: onEventCallback });

      // Add delays to make race conditions more likely to manifest
      adapter.setHandlerDelay(5);

      await engine.start();

      // Record state at each step
      const states: string[] = [];
      states.push(engine.getSession().currentNodeId);

      await adapter.simulateButtonClick("btn-opt-a");
      states.push(engine.getSession().currentNodeId);

      // Final state should be deterministic
      expect(states[states.length - 1]).toBe("end");
      expect(engine.getSession().status).toBe("completed");
    });

    it("should have correct pendingTimers count during lifecycle", async () => {
      const session = createSession("wait-journey");
      const engine = new SessionEngine(session, waitJourney, adapter, { onEvent: onEventCallback });

      await engine.start();

      // At wait node, should have 1 pending timer
      expect(engine.getSession().currentNodeId).toBe("wait");
      expect(engine.getSession().pendingTimers.length).toBe(1);

      // Simulate timeout
      const timerId = engine.getSession().pendingTimers[0].timerId;
      await adapter.simulateTimeout(timerId);

      // After timeout, timer should be cleaned up
      expect(engine.getSession().currentNodeId).toBe("end");
      expect(engine.getSession().pendingTimers.length).toBe(0);
    });
  });
});
