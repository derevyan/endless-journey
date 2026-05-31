import { describe, expect, it, vi } from "vitest";
import type { EnhancedUserJourney } from "@journey/schemas";
import { SessionEngine } from "../session-engine";
import { MockMessagingAdapter } from "./helpers/mock-adapter";
import { messageWithTimerJourney } from "./fixtures/journey-configs";

const createSession = (overrides?: Partial<EnhancedUserJourney>): EnhancedUserJourney => {
  const now = new Date().toISOString();
  return {
    sessionId: "session-1",
    userId: "user-1",
    platformUserId: "user-1",
    journeyId: "message-with-timer-journey",
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

describe("SessionEngine destroy", () => {
  it("cancels timers, clears pending state, and detaches adapter", async () => {
    const adapter = new MockMessagingAdapter();
    const session = createSession();
    const engine = new SessionEngine(session, messageWithTimerJourney, adapter);

    await engine.start();

    await vi.waitFor(() => {
      expect(adapter.getTimerCount()).toBe(1);
      expect(engine.getSession().pendingTimers).toHaveLength(1);
    });

    await engine.destroy();

    expect(engine.isDisposed()).toBe(true);
    expect(adapter.getTimerCount()).toBe(0);
    expect(engine.getSession().pendingTimers).toHaveLength(0);

    await expect(adapter.simulateMessage("hello")).rejects.toThrow("No message handler registered");
  });
});
