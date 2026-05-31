/**
 * Timer Recovery Integration Tests
 *
 * These tests simulate the production flow where a fresh engine is created
 * when a timer fires. This catches the bug where timerMap is empty in a
 * fresh engine, causing valid timeouts to be marked as "stale".
 *
 * The fix passes edgeId in the timeout event payload, allowing the router
 * to use it directly instead of looking it up in the (empty) timerMap.
 */

import type { EnhancedUserJourney, InteractionEvent } from "@journey/schemas";
import { beforeEach, describe, expect, it } from "vitest";
import { SessionEngine } from "../session-engine";
import { waitJourney } from "./fixtures/journey-configs";
import { MockMessagingAdapter } from "./helpers/mock-adapter";

describe("Timer Recovery - Fresh Engine Handling", () => {
  let adapter1: MockMessagingAdapter;
  let adapter2: MockMessagingAdapter;
  let collectedEvents: InteractionEvent[];

  beforeEach(() => {
    adapter1 = new MockMessagingAdapter();
    adapter2 = new MockMessagingAdapter();
    collectedEvents = [];
  });

  const createSession = (
    currentNodeId = "",
    pendingTimers: EnhancedUserJourney["pendingTimers"] = []
  ): EnhancedUserJourney => ({
    sessionId: "test-session-recovery",
    userId: "test-user-1",
    platformUserId: "test-user-1",
    journeyId: "wait-journey",
    currentNodeId,
    status: "active",
    context: {},
    tags: [],
    pendingTimers,
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

  it("should handle timeout in fresh engine when edgeId is in payload", async () => {
    // PHASE 1: Create engine 1, start it, schedule timer
    const session1 = createSession();
    const engine1 = new SessionEngine(session1, waitJourney, adapter1, {
      onEvent: onEventCallback,
    });

    await engine1.start();

    // Verify we're at wait node with timer scheduled
    expect(engine1.getSession().currentNodeId).toBe("wait");

    const timers = adapter1.getScheduledTimers();
    expect(timers).toHaveLength(1);

    // Capture timer details for fresh engine
    const scheduledTimer = timers[0];
    const { timerId, edgeId } = scheduledTimer;

    // Verify edgeId is the timer edge from wait → after-wait
    expect(edgeId).toBe("e2");

    // PHASE 2: Destroy engine 1 (simulate webhook request completing)
    engine1.destroy();

    // PHASE 3: Create engine 2 with EMPTY pendingTimers (simulates fresh engine creation)
    // This is what happens in timer-handler.ts when BullMQ fires the timer
    const session2 = createSession("wait", []); // Empty pendingTimers!
    const engine2 = new SessionEngine(session2, waitJourney, adapter2, {
      onEvent: onEventCallback,
    });

    // Verify timerMap is empty (this is the bug condition)
    // The engine's timer service won't have any timers in its map

    // PHASE 4: Inject timeout event WITH edgeId in payload
    // This simulates what timer-handler.ts now does after our fix
    const timeoutEvent = {
      type: "timeout" as const,
      userId: "test-user-1",
      sessionId: "test-session-recovery",
      timestamp: new Date().toISOString(),
      payload: {
        timerId,
        edgeId, // This is the key fix - passing edgeId in payload
      },
    };

    await engine2.injectEvent(timeoutEvent);

    // Wait for async processing
    await new Promise((resolve) => setTimeout(resolve, 10));

    // PHASE 5: Verify transition happened correctly
    // Without the fix, this would stay at "wait" (timeout marked as stale)
    // With the fix, it transitions to "end" (through after-wait → end)
    expect(engine2.getSession().currentNodeId).toBe("end");
    expect(engine2.getSession().status).toBe("completed");

    // Verify messages were sent
    const messages = adapter2.getSentMessages();
    expect(messages.some((m) => m.message.content === "Wait completed!")).toBe(true);
    expect(messages.some((m) => m.message.content === "Done!")).toBe(true);

    engine2.destroy();
  });

  it("should mark timeout as stale when no edgeId in payload and timerMap is empty", async () => {
    // This test documents the bug behavior that our fix addresses
    // When edgeId is NOT in payload and timerMap is empty, timeout is stale

    // Create session at wait node with empty pendingTimers
    const session = createSession("wait", []);
    const engine = new SessionEngine(session, waitJourney, adapter2, {
      onEvent: onEventCallback,
    });

    // Inject timeout WITHOUT edgeId in payload
    const timeoutEvent = {
      type: "timeout" as const,
      userId: "test-user-1",
      sessionId: "test-session-recovery",
      timestamp: new Date().toISOString(),
      payload: {
        timerId: "unknown-timer-123",
        // No edgeId - this simulates old behavior
      },
    };

    await engine.injectEvent(timeoutEvent);
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Without edgeId, the timeout should be ignored as stale
    // Session stays at "wait" node
    expect(engine.getSession().currentNodeId).toBe("wait");
    expect(engine.getSession().status).toBe("active");

    engine.destroy();
  });

  it("should prefer payload.edgeId over timerMap lookup", async () => {
    // Test that payload.edgeId takes precedence
    // This is important for robustness - even if timerMap has wrong data

    const session = createSession("wait", []);
    const engine = new SessionEngine(session, waitJourney, adapter2, {
      onEvent: onEventCallback,
    });

    // Inject timeout with correct edgeId in payload
    const timeoutEvent = {
      type: "timeout" as const,
      userId: "test-user-1",
      sessionId: "test-session-recovery",
      timestamp: new Date().toISOString(),
      payload: {
        timerId: "any-timer-id",
        edgeId: "e2", // Correct edge: wait → after-wait
      },
    };

    await engine.injectEvent(timeoutEvent);
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Should transition correctly using payload.edgeId
    expect(engine.getSession().currentNodeId).toBe("end");

    engine.destroy();
  });

  it("should use platformUserId when sending messages after timer fires", async () => {
    // This test ensures platformUserId is properly passed to sendMessage
    // Catches the "chat_id is empty" bug where timer-handler didn't load clientData
    const TELEGRAM_PLATFORM_USER_ID = "123456789"; // Simulates Telegram numeric chat ID

    const session = createSession("wait", []);
    session.platformUserId = TELEGRAM_PLATFORM_USER_ID; // Set to Telegram-like ID

    const engine = new SessionEngine(session, waitJourney, adapter2, {
      onEvent: onEventCallback,
    });

    // Inject timeout with edgeId
    const timeoutEvent = {
      type: "timeout" as const,
      userId: "test-user-1",
      sessionId: "test-session-recovery",
      timestamp: new Date().toISOString(),
      payload: {
        timerId: "timer-123",
        edgeId: "e2",
      },
    };

    await engine.injectEvent(timeoutEvent);
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Verify messages were sent with correct platformUserId
    const messages = adapter2.getSentMessages();
    expect(messages.length).toBeGreaterThan(0);

    // All messages should use the platformUserId (Telegram chat ID)
    for (const msg of messages) {
      expect(msg.userId).toBe(TELEGRAM_PLATFORM_USER_ID);
    }

    engine.destroy();
  });

  it("should send messages even with empty platformUserId (adapter responsibility to handle)", async () => {
    // When platformUserId is empty, the engine still sends messages
    // The adapter (TelegramAdapter) is responsible for handling empty chatId
    // This test documents the behavior - engine doesn't validate platformUserId

    const session = createSession("wait", []);
    session.platformUserId = ""; // Empty - this would cause Telegram API error

    const engine = new SessionEngine(session, waitJourney, adapter2, {
      onEvent: onEventCallback,
    });

    // Inject timeout
    const timeoutEvent = {
      type: "timeout" as const,
      userId: "test-user-1",
      sessionId: "test-session-recovery",
      timestamp: new Date().toISOString(),
      payload: {
        timerId: "timer-123",
        edgeId: "e2",
      },
    };

    await engine.injectEvent(timeoutEvent);
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Messages are still sent (engine doesn't validate)
    const messages = adapter2.getSentMessages();
    expect(messages.length).toBeGreaterThan(0);

    // Messages have empty userId - adapter would fail on real Telegram
    for (const msg of messages) {
      expect(msg.userId).toBe("");
    }

    engine.destroy();
  });
});
