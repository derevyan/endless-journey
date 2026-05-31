/**
 * Session Runtime State Persistence Tests
 */

import type { createLogger } from "@journey/logger";
import type { EnhancedUserJourney } from "@journey/schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { finalizeSession } from "../state-persistence";

const updateSession = vi.fn();
const setCachedSession = vi.fn();
const updateCachedSession = vi.fn();
const clearSessionEngine = vi.fn();
const saveOutputs = vi.fn();
const clearOutputs = vi.fn();

const createTestLogger = (): ReturnType<typeof createLogger> => {
  const logger = {
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn(),
  } as ReturnType<typeof createLogger>;

  logger.child = vi.fn(() => logger);

  return logger;
};

vi.mock("../../create-services", () => ({
  createServicesForSystem: () => ({
    channel: {
      updateSession: (...args: unknown[]) => updateSession(...args),
    },
  }),
}));

vi.mock("../../session-cache-service", () => ({
  setCachedSession: (...args: unknown[]) => setCachedSession(...args),
  updateCachedSession: (...args: unknown[]) => updateCachedSession(...args),
  clearSessionEngine: (...args: unknown[]) => clearSessionEngine(...args),
  getCachedSession: vi.fn(),
}));

vi.mock("@journey/engine-integrations", () => ({
  createNodeOutputsStore: () => ({
    saveOutputs: (...args: unknown[]) => saveOutputs(...args),
    loadOutputs: vi.fn(),
    clearOutputs: (...args: unknown[]) => clearOutputs(...args),
  }),
}));

describe("session-runtime state persistence", () => {
  beforeEach(() => {
    updateSession.mockClear();
    setCachedSession.mockClear();
    updateCachedSession.mockClear();
    clearSessionEngine.mockClear();
    saveOutputs.mockClear();
    clearOutputs.mockClear();
  });

  it("sets cache and persists node outputs for active sessions", async () => {
    const session: EnhancedUserJourney = {
      sessionId: "session-1",
      userId: "client-1",
      platformUserId: "",
      journeyId: "journey-1",
      currentNodeId: "node-1",
      status: "active",
      context: {},
      tags: [],
      pendingTimers: [],
      pendingPluginFollowUps: [],
      nodeOutputs: {
        "node-1": {
          nodeId: "node-1",
          nodeLabel: "node-1",
          nodeType: "start",
          executedAt: new Date().toISOString(),
          data: { status: "ok" },
        },
      },
      activeButtons: [],
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedAt: null,
    hasStarted: false,
      history: [],
    };

    const logger = createTestLogger();

    await finalizeSession({
      sessionId: session.sessionId,
      session,
      logger,
      cacheMode: "set",
    });

    expect(updateSession).toHaveBeenCalled();
    expect(setCachedSession).toHaveBeenCalledWith(session.sessionId, session.journeyId, session);
    expect(updateCachedSession).not.toHaveBeenCalled();
    expect(saveOutputs).toHaveBeenCalled();
    expect(clearSessionEngine).not.toHaveBeenCalled();
  });
});
