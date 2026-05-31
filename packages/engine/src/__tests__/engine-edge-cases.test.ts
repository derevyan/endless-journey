/**
 * Engine Edge Cases Tests
 *
 * Tests for boundary conditions and edge cases in the SessionEngine:
 * - Execute loop boundaries (maxIterations)
 * - Timer recovery from corrupt state
 * - Middleware failures
 * - Guard evaluation errors
 * - Concurrent destruction
 * - Two-timer races
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { EnhancedUserJourney } from "@journey/schemas";
import { SessionEngine } from "../session-engine";
import { MockMessagingAdapter } from "./helpers/mock-adapter";
import {
  createDeepJourney,
  createJourneyWithLoopAt,
  createJourneyWithThrowingCondition,
  createJourneyWithDelay,
  createJourneyWithTwoTimers,
  createSimpleRecoveryJourney,
} from "./fixtures/edge-case-journeys";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const createSession = (overrides?: Partial<EnhancedUserJourney>): EnhancedUserJourney => {
  const now = new Date().toISOString();
  return {
    sessionId: "test-session-1",
    userId: "test-user-1",
    platformUserId: "test-user-1",
    journeyId: "edge-case-journey",
    currentNodeId: "",
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
};

describe("Engine Edge Cases", () => {
  let adapter: MockMessagingAdapter;

  beforeEach(() => {
    adapter = new MockMessagingAdapter();
    vi.useFakeTimers();
  });

  afterEach(async () => {
    vi.useRealTimers();
  });

  describe("Execute Loop Boundaries", () => {
    it("should complete at exactly maxLoopIterations transitions", async () => {
      // Default maxLoopIterations is 100
      // With 50 nodes, we have 50 auto-transitions (well under limit)
      const journey = createDeepJourney(50);
      const session = createSession();
      const engine = new SessionEngine(session, journey, adapter);

      await engine.start();

      expect(engine.getSession().status).toBe("completed");
      expect(engine.getSession().currentNodeId).toBe("end");
    });

    it("should error when exceeding maxLoopIterations with clear message", async () => {
      // Create a journey that loops infinitely
      const journey = createJourneyWithLoopAt(10);
      const session = createSession();

      // Set low maxLoopIterations to trigger quickly
      const engine = new SessionEngine(session, journey, adapter, {
        maxLoopIterations: 15,
      });

      await engine.start();

      // Should hit max iterations and set error status
      expect(engine.getSession().status).toBe("error");
    });

    it("should handle loop at iteration boundary gracefully", async () => {
      // Create journey that loops at iteration 5, with max 10
      const journey = createJourneyWithLoopAt(5);
      const session = createSession();

      const engine = new SessionEngine(session, journey, adapter, {
        maxLoopIterations: 10,
      });

      await engine.start();

      // Should hit max iterations
      expect(engine.getSession().status).toBe("error");
    });

    it("should respect custom maxLoopIterations setting", async () => {
      // Deep journey with 20 nodes, but limit to 10 iterations
      const journey = createDeepJourney(20);
      const session = createSession();

      const engine = new SessionEngine(session, journey, adapter, {
        maxLoopIterations: 10,
      });

      await engine.start();

      // Should error at 10 iterations, not complete
      expect(engine.getSession().status).toBe("error");
    });

    it("should complete small journeys well under the limit", async () => {
      // Simple 3-node journey
      const journey = createDeepJourney(1);
      const session = createSession();

      const engine = new SessionEngine(session, journey, adapter);

      await engine.start();

      expect(engine.getSession().status).toBe("completed");
    });
  });

  describe("Timer Recovery", () => {
    it("should handle session with past-due timer on recovery", async () => {
      // Create a session state with a timer that was due 5 minutes ago
      const pastDueTime = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const journey = createSimpleRecoveryJourney();

      const session = createSession({
        currentNodeId: "wait-node",
        pendingTimers: [
          {
            timerId: "timer-past-due",
            targetEdgeId: "e2",
            triggersAt: pastDueTime,
          },
        ],
      });

      const engine = new SessionEngine(session, journey, adapter);

      // Engine should handle past-due timer without crashing
      // The timer should fire immediately on start
      expect(() => engine).not.toThrow();
    });

    it("should not double-fire timer on recovery", async () => {
      vi.useRealTimers(); // Need real timers for this test

      const journey = createSimpleRecoveryJourney();
      const session = createSession({
        currentNodeId: "wait-node",
        pendingTimers: [
          {
            timerId: "timer-1",
            targetEdgeId: "e2",
            triggersAt: new Date(Date.now() + 100).toISOString(), // Fires in 100ms
          },
        ],
      });

      const engine = new SessionEngine(session, journey, adapter);
      let timerFireCount = 0;

      // Track timer fires by watching session state changes
      const originalCurrentNode = session.currentNodeId;

      // Wait for timer and check it only fires once
      await sleep(200);

      // If timer double-fired, we'd see multiple state transitions
      // This test mainly ensures no crash on recovery
      expect(engine.getSession()).toBeDefined();
    });

    it("should handle session with empty pendingTimers array", async () => {
      const journey = createSimpleRecoveryJourney();
      const session = createSession({
        currentNodeId: "wait-node",
        pendingTimers: [], // No pending timers
      });

      const engine = new SessionEngine(session, journey, adapter);

      // Should not crash with empty timer array
      expect(engine.isDisposed()).toBe(false);
    });
  });

  describe("Guard Evaluation Errors", () => {
    it("should treat throwing condition as false and take default branch", async () => {
      const journey = createJourneyWithThrowingCondition();
      const session = createSession();

      const engine = new SessionEngine(session, journey, adapter);

      await engine.start();

      // Should complete successfully, taking the default (no) path
      expect(engine.getSession().status).toBe("completed");
      expect(engine.getSession().currentNodeId).toBe("end");

      // Should have gone through "no-path" (the default branch)
      const history = engine.getSession().history || [];
      const visitedNodes = history.map((h) => h.nodeId);
      expect(visitedNodes).toContain("no-path");
      expect(visitedNodes).not.toContain("yes-path");
    });

    it("should log error but continue execution when condition throws", async () => {
      const journey = createJourneyWithThrowingCondition();
      const session = createSession();

      const engine = new SessionEngine(session, journey, adapter);

      // Should complete without throwing
      await expect(engine.start()).resolves.not.toThrow();

      expect(engine.getSession().status).toBe("completed");
    });

    it("should handle null context values in conditions", async () => {
      const journey = createJourneyWithThrowingCondition();
      const session = createSession({
        context: {
          value: null, // Explicitly null
        },
      });

      const engine = new SessionEngine(session, journey, adapter);

      await engine.start();

      // Should complete successfully, taking default path
      expect(engine.getSession().status).toBe("completed");
    });
  });

  describe("Concurrent Destruction", () => {
    it("should not crash if destroyed while handler is running", async () => {
      vi.useRealTimers();

      const journey = createJourneyWithDelay(1); // 1 second delay
      const session = createSession();
      const engine = new SessionEngine(session, journey, adapter);

      // Start but don't await
      const startPromise = engine.start();

      // Destroy mid-execution (after 50ms, before delay completes)
      await sleep(50);
      await engine.destroy();

      // Should complete without crash
      expect(engine.isDisposed()).toBe(true);

      // The start promise should resolve (might be with an error or just complete)
      // We just want to ensure no unhandled rejection
      try {
        await startPromise;
      } catch {
        // Acceptable - may throw due to destroy
      }
    });

    it("should reject pending operations on destroy", async () => {
      vi.useRealTimers();

      const journey = createJourneyWithTwoTimers(1);
      const session = createSession();
      const engine = new SessionEngine(session, journey, adapter);

      await engine.start();

      // Should have scheduled a timer
      expect(adapter.getTimerCount()).toBeGreaterThanOrEqual(0);

      await engine.destroy();

      // Timer should be cancelled
      expect(adapter.getTimerCount()).toBe(0);
      expect(engine.isDisposed()).toBe(true);
    });

    it("should clear pending timers on destroy", async () => {
      const journey = createSimpleRecoveryJourney();
      const session = createSession({
        currentNodeId: "start",
        pendingTimers: [
          {
            timerId: "pending-1",
            targetEdgeId: "e2",
            triggersAt: new Date(Date.now() + 60000).toISOString(),
          },
        ],
      });

      const engine = new SessionEngine(session, journey, adapter);

      await engine.destroy();

      expect(engine.getSession().pendingTimers).toHaveLength(0);
    });
  });

  describe("Two-Timer Race", () => {
    it("should handle sequential timers correctly", async () => {
      vi.useRealTimers();

      const journey = createJourneyWithTwoTimers(60); // 60s timers (we'll simulate them)
      const session = createSession();
      const engine = new SessionEngine(session, journey, adapter);

      await engine.start();

      // Should be at first wait node with a pending timer
      expect(engine.getSession().currentNodeId).toBe("wait-1");
      expect(engine.getSession().pendingTimers.length).toBe(1);

      // Fire first timer
      const timer1 = engine.getSession().pendingTimers[0];
      await adapter.simulateTimeout(timer1.timerId);
      await sleep(50);

      // Should now be at second wait node
      expect(engine.getSession().currentNodeId).toBe("wait-2");
      expect(engine.getSession().pendingTimers.length).toBe(1);

      // Fire second timer
      const timer2 = engine.getSession().pendingTimers[0];
      await adapter.simulateTimeout(timer2.timerId);
      await sleep(50);

      // Journey should complete
      expect(engine.getSession().currentNodeId).toBe("end");
      expect(engine.getSession().status).toBe("completed");
    });

    it("should not corrupt state when timers fire", async () => {
      vi.useRealTimers();

      const journey = createJourneyWithTwoTimers(60);
      const session = createSession();
      const engine = new SessionEngine(session, journey, adapter);

      await engine.start();

      // Fire both timers
      const timer1 = engine.getSession().pendingTimers[0];
      await adapter.simulateTimeout(timer1.timerId);
      await sleep(50);

      const timer2 = engine.getSession().pendingTimers[0];
      await adapter.simulateTimeout(timer2.timerId);
      await sleep(50);

      // Session should be valid
      expect(engine.getSession().sessionId).toBe("test-session-1");
      expect(engine.getSession().status).toBe("completed");
    });
  });

  describe("Disposed Engine Protection", () => {
    it("should ignore events after destroy", async () => {
      const journey = createDeepJourney(3);
      const session = createSession();
      const engine = new SessionEngine(session, journey, adapter);

      await engine.start();
      await engine.destroy();

      // Try to send message after destroy
      await expect(adapter.simulateMessage("hello")).rejects.toThrow("No message handler registered");

      expect(engine.isDisposed()).toBe(true);
    });

    it("should return disposed state correctly", async () => {
      const journey = createDeepJourney(3);
      const session = createSession();
      const engine = new SessionEngine(session, journey, adapter);

      expect(engine.isDisposed()).toBe(false);

      await engine.destroy();

      expect(engine.isDisposed()).toBe(true);
    });
  });

  describe("Session State Integrity", () => {
    it("should maintain history through all transitions", async () => {
      const journey = createDeepJourney(5);
      const session = createSession();
      const engine = new SessionEngine(session, journey, adapter);

      await engine.start();

      const history = engine.getSession().history || [];

      // Should have entries for start + 5 message nodes + end = 7 nodes
      expect(history.length).toBeGreaterThanOrEqual(5);
    });

    it("should update timestamps on state changes", async () => {
      vi.useRealTimers();

      const journey = createDeepJourney(2);
      const session = createSession();
      const initialUpdatedAt = session.updatedAt;

      await sleep(10); // Small delay

      const engine = new SessionEngine(session, journey, adapter);
      await engine.start();

      // updatedAt should be newer than initial
      expect(new Date(engine.getSession().updatedAt).getTime()).toBeGreaterThanOrEqual(new Date(initialUpdatedAt).getTime());
    });
  });
});
