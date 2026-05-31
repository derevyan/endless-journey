/**
 * Session Cache & Lock Integration Tests
 *
 * Tests Redis-based session caching and distributed locking.
 * Requires Redis to be running.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import type { EnhancedUserJourney } from "@journey/schemas";
import { getRedisConnection } from "../lib/redis";
import {
  getCachedSession,
  setCachedSession,
  updateCachedSession,
  deleteCachedSession,
  invalidateJourneySessions,
} from "../services/session-cache-service";
import {
  acquireSessionLock,
  releaseSessionLock,
  isSessionLocked,
} from "../services/session-lock-service";

// Test data
const createMockSession = (overrides: Partial<EnhancedUserJourney> = {}): EnhancedUserJourney => ({
  sessionId: `test-session-${Date.now()}`,
  userId: "test-user-123",
  platformUserId: "test-user-123",
  journeyId: "test-journey-456",
  currentNodeId: "node-1",
  status: "active",
  context: { foo: "bar" },
  tags: ["test"],
  pendingTimers: [],
  pendingPluginFollowUps: [],
  nodeOutputs: {},
  startedAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  completedAt: null,
    hasStarted: false,
  history: [],
  ...overrides,
});

describe("Session Cache Service", () => {
  const testSessionId = `cache-test-${Date.now()}`;
  const testJourneyId = `journey-test-${Date.now()}`;

  afterEach(async () => {
    // Cleanup test keys
    const redis = getRedisConnection();
    const keys = await redis.keys("session:*test*");
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  });

  it("should cache and retrieve session state", async () => {
    const session = createMockSession({ sessionId: testSessionId });

    await setCachedSession(testSessionId, testJourneyId, session);

    const cached = await getCachedSession(testSessionId);

    expect(cached).not.toBeNull();
    expect(cached?.sessionId).toBe(testSessionId);
    expect(cached?.journeyId).toBe(testJourneyId);
    expect(cached?.session.currentNodeId).toBe("node-1");
    expect(cached?.session.context).toEqual({ foo: "bar" });
  });

  it("should return null for non-existent session", async () => {
    const cached = await getCachedSession("non-existent-session");
    expect(cached).toBeNull();
  });

  it("should update cached session and increment version", async () => {
    const session = createMockSession({ sessionId: testSessionId });
    await setCachedSession(testSessionId, testJourneyId, session);

    // Update session
    const updatedSession = { ...session, currentNodeId: "node-2" };
    await updateCachedSession(testSessionId, updatedSession);

    const cached = await getCachedSession(testSessionId);

    expect(cached?.session.currentNodeId).toBe("node-2");
    expect(cached?.version).toBe(2);
  });

  it("should delete cached session", async () => {
    const session = createMockSession({ sessionId: testSessionId });
    await setCachedSession(testSessionId, testJourneyId, session);

    const deleted = await deleteCachedSession(testSessionId);
    expect(deleted).toBe(true);

    const cached = await getCachedSession(testSessionId);
    expect(cached).toBeNull();
  });

  it("should invalidate all sessions for a journey", async () => {
    // Create multiple sessions for same journey
    const session1 = createMockSession({ sessionId: `${testSessionId}-1` });
    const session2 = createMockSession({ sessionId: `${testSessionId}-2` });

    await setCachedSession(`${testSessionId}-1`, testJourneyId, session1);
    await setCachedSession(`${testSessionId}-2`, testJourneyId, session2);

    const invalidatedCount = await invalidateJourneySessions(testJourneyId);

    expect(invalidatedCount).toBe(2);
    expect(await getCachedSession(`${testSessionId}-1`)).toBeNull();
    expect(await getCachedSession(`${testSessionId}-2`)).toBeNull();
  });
});

describe("Session Lock Service", () => {
  const testSessionId = `lock-test-${Date.now()}`;

  afterEach(async () => {
    // Cleanup test locks
    const redis = getRedisConnection();
    const keys = await redis.keys("lock:session:*test*");
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  });

  it("should acquire and release lock", async () => {
    const lock = await acquireSessionLock(testSessionId);

    expect(lock).not.toBeNull();
    expect(lock?.sessionId).toBe(testSessionId);
    expect(await isSessionLocked(testSessionId)).toBe(true);

    const released = await releaseSessionLock(lock!);
    expect(released).toBe(true);
    expect(await isSessionLocked(testSessionId)).toBe(false);
  });

  it("should fail to acquire lock when already held", async () => {
    const lock1 = await acquireSessionLock(testSessionId);
    expect(lock1).not.toBeNull();

    // Try to acquire same lock with noWait
    const lock2 = await acquireSessionLock(testSessionId, { noWait: true });
    expect(lock2).toBeNull();

    // Cleanup
    await releaseSessionLock(lock1!);
  });

  it("should allow different sessions to be locked concurrently", async () => {
    const lock1 = await acquireSessionLock(`${testSessionId}-1`);
    const lock2 = await acquireSessionLock(`${testSessionId}-2`);

    expect(lock1).not.toBeNull();
    expect(lock2).not.toBeNull();

    // Cleanup
    await releaseSessionLock(lock1!);
    await releaseSessionLock(lock2!);
  });

  it("should not release lock if not owner", async () => {
    const lock = await acquireSessionLock(testSessionId);
    expect(lock).not.toBeNull();

    // Create fake lock with different lockId
    const fakeLock = { ...lock!, lockId: "fake-lock-id" };
    const released = await releaseSessionLock(fakeLock);

    expect(released).toBe(false);
    expect(await isSessionLocked(testSessionId)).toBe(true);

    // Cleanup with real lock
    await releaseSessionLock(lock!);
  });
});

/**
 * Session State Preservation Tests
 *
 * Regression tests for bug where stateful handler state (nodeOutputs) was lost
 * during cache reconstruction. This ensures agent/questionnaire state persists.
 *
 * Related fix: session-engine-factory.ts now accepts and uses cached state fields
 */
describe("Session State Preservation (nodeOutputs)", () => {
  const testSessionId = `state-test-${Date.now()}`;
  const testJourneyId = `journey-state-test-${Date.now()}`;

  afterEach(async () => {
    const redis = getRedisConnection();
    const keys = await redis.keys("session:*state-test*");
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  });

  it("should preserve agent state (nodeOutputs) through cache round-trip", async () => {
    // Simulate agent node state - workflowInitialized should persist across messages
    const agentState = {
      workflowInitialized: true,
      initialGreetingSent: true,
      timerId: "timer-123",
      messageCount: 5,
    };

    const session = createMockSession({
      sessionId: testSessionId,
      currentNodeId: "agent-node-1",
      nodeOutputs: {
        // State key format used by engine: __state_{nodeId}
        "__state_agent-node-1": {
          nodeId: "agent-node-1",
          nodeLabel: "AI Agent",
          nodeType: "agent",
          executedAt: new Date().toISOString(),
          data: agentState,
        },
      },
    });

    // Cache the session (as telegram-webhook does after processing)
    await setCachedSession(testSessionId, testJourneyId, session);

    // Retrieve from cache (as telegram-webhook does on next message)
    const cached = await getCachedSession(testSessionId);

    // Verify nodeOutputs survived caching - this is the critical assertion
    expect(cached).not.toBeNull();
    expect(cached!.session.nodeOutputs).toBeDefined();
    expect(cached!.session.nodeOutputs["__state_agent-node-1"]).toBeDefined();
    expect(cached!.session.nodeOutputs["__state_agent-node-1"].data).toEqual(agentState);

    // Specifically verify the key fields that caused the bug
    const agentData = cached!.session.nodeOutputs["__state_agent-node-1"].data as typeof agentState;
    expect(agentData.workflowInitialized).toBe(true);
    expect(agentData.initialGreetingSent).toBe(true);
  });

  it("should preserve questionnaire state through cache round-trip", async () => {
    // Simulate questionnaire node state - currentIndex and responses should persist
    const questionnaireState = {
      currentIndex: 2,
      responses: [
        { questionId: "q1", text: "Apple", selectedAt: new Date().toISOString() },
        { questionId: "q2", text: "Blue", selectedAt: new Date().toISOString() },
      ],
      questionOrder: ["q1", "q2", "q3", "q4"],
      formStartedAt: new Date().toISOString(),
    };

    const session = createMockSession({
      sessionId: testSessionId,
      currentNodeId: "questionnaire-node-1",
      nodeOutputs: {
        "__state_questionnaire-node-1": {
          nodeId: "questionnaire-node-1",
          nodeLabel: "Survey",
          nodeType: "questionnaire",
          executedAt: new Date().toISOString(),
          data: questionnaireState,
        },
      },
    });

    await setCachedSession(testSessionId, testJourneyId, session);
    const cached = await getCachedSession(testSessionId);

    expect(cached).not.toBeNull();
    expect(cached!.session.nodeOutputs["__state_questionnaire-node-1"].data).toEqual(questionnaireState);
    const qData = cached!.session.nodeOutputs["__state_questionnaire-node-1"].data as typeof questionnaireState;
    expect(qData.currentIndex).toBe(2);
    expect(qData.responses).toHaveLength(2);
  });

  it("should preserve pendingTimers through cache round-trip", async () => {
    const session = createMockSession({
      sessionId: testSessionId,
      pendingTimers: [
        {
          timerId: "bullmq-timer-123",
          triggersAt: new Date(Date.now() + 60000).toISOString(),
          targetEdgeId: "edge-1",
        },
      ],
    });

    await setCachedSession(testSessionId, testJourneyId, session);
    const cached = await getCachedSession(testSessionId);

    expect(cached!.session.pendingTimers).toHaveLength(1);
    expect(cached!.session.pendingTimers[0].timerId).toBe("bullmq-timer-123");
  });

  it("should preserve history through cache round-trip", async () => {
    const session = createMockSession({
      sessionId: testSessionId,
      history: [
        {
          id: "evt-1",
          type: "user.message",
          nodeId: "node-1",
          timestamp: new Date().toISOString(),
          payload: { text: "Hello" },
        },
        {
          id: "evt-2",
          type: "engine.message",
          nodeId: "node-1",
          timestamp: new Date().toISOString(),
          payload: { text: "Hi there!" },
        },
      ],
    });

    await setCachedSession(testSessionId, testJourneyId, session);
    const cached = await getCachedSession(testSessionId);

    expect(cached!.session.history).toHaveLength(2);
    expect(cached!.session.history[0].type).toBe("user.message");
    expect(cached!.session.history[1].type).toBe("engine.message");
  });
});
