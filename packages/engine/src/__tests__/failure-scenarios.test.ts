/**
 * Failure Scenarios Tests
 *
 * Tests for various failure conditions to ensure the engine handles errors gracefully:
 * - Send message failures (network errors, rate limits, user blocked bot)
 * - Resume vs new session detection edge cases
 * - Session state corruption recovery
 */

import type { EnhancedUserJourney, InteractionEvent } from "@journey/schemas";
import { beforeEach, describe, expect, it } from "vitest";
import { SessionEngine } from "../session-engine";
import { buttonJourney, linearJourney, messageWithTimerJourney } from "./fixtures/journey-configs";
import { MockMessagingAdapter } from "./helpers/mock-adapter";

describe("Failure Scenarios", () => {
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
    currentNodeId: "", // Empty string, engine will find start node
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

  describe("Message Send Failures with MockMessagingAdapter", () => {
    it("should handle permanent send failure - session stays on current node", async () => {
      const session = createSession("button-journey");
      const engine = new SessionEngine(session, buttonJourney, adapter, { onEvent: onEventCallback });

      // Make all messages fail permanently
      adapter.mockSendMessageFail("Network unreachable", 0);

      await engine.start();

      // Session should be stuck on start node (message failed)
      expect(engine.getSession().currentNodeId).toBe("start");
      expect(engine.getSession().status).toBe("active");
      // No messages should be recorded since send failed
      expect(adapter.getSentMessages().length).toBe(0);
    });

    it("should handle transient failure - recovers after N failures via internal retry", async () => {
      const session = createSession("linear-journey");
      const engine = new SessionEngine(session, linearJourney, adapter, { onEvent: onEventCallback });

      // Fail first 2 attempts, then succeed
      // Note: Engine has internal retry logic (3 attempts), so if we fail 2 times,
      // the 3rd internal retry will succeed
      adapter.mockSendMessageFail("Temporary network error", 2);

      // Engine's internal retry will fail twice, then succeed on 3rd attempt
      await engine.start();

      // After internal retries, message should have been sent successfully
      expect(adapter.getSentMessages().length).toBeGreaterThan(0);
    });

    it("should fail when all internal retries are exhausted", async () => {
      const session = createSession("button-journey");
      const engine = new SessionEngine(session, buttonJourney, adapter, { onEvent: onEventCallback });

      // Fail more times than internal retry count (engine retries 3 times)
      adapter.mockSendMessageFail("Persistent network error", 5);

      await engine.start();

      // Should fail - all 3 internal retries exhausted
      expect(adapter.getSentMessages().length).toBe(0);
      expect(engine.getSession().currentNodeId).toBe("start");
    });

    it("should not schedule timer when message send fails", async () => {
      const session = createSession("message-with-timer-journey");
      const engine = new SessionEngine(session, messageWithTimerJourney, adapter, { onEvent: onEventCallback });

      // Make messages fail
      adapter.mockSendMessageFail("Rate limit exceeded");

      await engine.start();

      // No timers should be scheduled because message failed
      expect(adapter.getScheduledTimers().length).toBe(0);
    });

    it("should allow recovery after failure is cleared", async () => {
      // Use a fresh session each time to avoid resume detection
      const session1 = createSession("button-journey");

      // First engine - starts with failure
      const engine1 = new SessionEngine(session1, buttonJourney, adapter, { onEvent: onEventCallback });
      adapter.mockSendMessageFail("Server unavailable");
      await engine1.start();
      expect(adapter.getSentMessages().length).toBe(0);

      // Second attempt - clear failure and create fresh session
      adapter.clearMessages();
      adapter.mockSendMessageSucceed();

      const session2 = createSession("button-journey");
      const engine2 = new SessionEngine(session2, buttonJourney, adapter, { onEvent: onEventCallback });
      await engine2.start();

      // Should succeed now
      expect(adapter.getSentMessages().length).toBeGreaterThan(0);
      expect(engine2.getSession().currentNodeId).toBe("msg-with-buttons");
    });

    it("should track failure simulation state correctly", () => {
      expect(adapter.isFailureSimulationActive()).toBe(false);

      adapter.mockSendMessageFail("Test error");
      expect(adapter.isFailureSimulationActive()).toBe(true);

      adapter.mockSendMessageSucceed();
      expect(adapter.isFailureSimulationActive()).toBe(false);
    });

    it("should reset failure state on adapter reset", () => {
      adapter.mockSendMessageFail("Test error");
      expect(adapter.isFailureSimulationActive()).toBe(true);

      adapter.reset();
      expect(adapter.isFailureSimulationActive()).toBe(false);
    });
  });

  describe("Session Resume Detection", () => {
    it("should correctly identify new session (no history)", async () => {
      const session = createSession("button-journey");
      session.currentNodeId = ""; // Empty = new session
      session.history = [];

      const engine = new SessionEngine(session, buttonJourney, adapter, { onEvent: onEventCallback });
      await engine.start();

      // New session should execute start node
      expect(adapter.getSentMessages().length).toBeGreaterThan(0);
      expect(adapter.getSentMessages()[0].message.content).toBe("Welcome! Choose an option:");
    });

    it("should correctly identify resumed session (has history)", async () => {
      const session = createSession("button-journey");
      session.currentNodeId = "msg-with-buttons";
      session.history = [
        {
          id: "evt_1",
          timestamp: new Date().toISOString(),
          type: "engine.transition",
          nodeId: "start",
          payload: { from: null, to: "start", trigger: "start" },
        },
      ];
      session.hasStarted = true;

      const engine = new SessionEngine(session, buttonJourney, adapter, { onEvent: onEventCallback });
      await engine.start();

      // Resumed session should NOT re-execute current node
      expect(adapter.getSentMessages().length).toBe(0);
    });

    it("should not be tricked by startedAt being set (old resume detection bug)", async () => {
      // This tests the bug where resume was detected using startedAt,
      // which was always set by session factory from DB's createdAt
      const session = createSession("button-journey");
      session.currentNodeId = ""; // Empty = new session
      session.history = []; // Empty history = NEW session
      session.startedAt = new Date().toISOString(); // startedAt is always set

      const engine = new SessionEngine(session, buttonJourney, adapter, { onEvent: onEventCallback });
      await engine.start();

      // Should be treated as NEW session, not resume
      expect(adapter.getSentMessages().length).toBeGreaterThan(0);
    });

    it("should handle session with currentNodeId but no history (edge case)", async () => {
      // Edge case: somehow currentNodeId is set but history is empty
      // This shouldn't happen normally, but we should handle it gracefully
      const session = createSession("button-journey");
      session.currentNodeId = "msg-with-buttons";
      session.history = []; // Empty history = NEW session behavior

      const engine = new SessionEngine(session, buttonJourney, adapter, { onEvent: onEventCallback });
      await engine.start();

      // With history.length === 0, should be treated as new session
      // Will execute from currentNodeId (msg-with-buttons)
      expect(adapter.getSentMessages().length).toBeGreaterThan(0);
    });

    it("should not treat updatedAt drift as resume without hasStarted", async () => {
      const session = createSession("button-journey");
      session.currentNodeId = "msg-with-buttons";
      session.history = [];
      session.startedAt = new Date("2025-01-01T00:00:00.000Z").toISOString();
      session.updatedAt = new Date("2025-01-02T00:00:00.000Z").toISOString();

      const engine = new SessionEngine(session, buttonJourney, adapter, { onEvent: onEventCallback });
      await engine.start();

      // Without hasStarted, treat as new session and re-execute
      expect(adapter.getSentMessages().length).toBeGreaterThan(0);
    });
  });

  describe("Journey State After User Deletion", () => {
    it("should start fresh journey after user data is deleted", async () => {
      // Simulates: User deleted, session table row recreated
      const session = createSession("button-journey");
      // Fresh session state (what gets created after user deletion)
      session.currentNodeId = ""; // Empty = new session
      session.history = [];
      session.context = {};
      session.tags = [];
      session.nodeOutputs = {};

      const engine = new SessionEngine(session, buttonJourney, adapter, { onEvent: onEventCallback });
      await engine.start();

      // User should see the welcome message
      const messages = adapter.getSentMessages();
      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0].message.content).toBe("Welcome! Choose an option:");

      // Session should be waiting at button node
      expect(engine.getSession().currentNodeId).toBe("msg-with-buttons");
      expect(engine.getSession().status).toBe("active");
    });
  });

  describe("Error Recovery Patterns", () => {
    it("should remain in valid state after handler execution fails", async () => {
      const session = createSession("button-journey");
      const engine = new SessionEngine(session, buttonJourney, adapter, { onEvent: onEventCallback });

      // Start normally
      await engine.start();
      expect(engine.getSession().status).toBe("active");

      // Simulate failure on next message
      adapter.mockSendMessageFail("Connection lost");

      // Simulate button click that should fail to send next message
      adapter.simulateButtonClick("Option A");

      // Give time for async processing
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Session should still be in valid state
      expect(engine.getSession().status).toBe("active");
    });
  });
});
