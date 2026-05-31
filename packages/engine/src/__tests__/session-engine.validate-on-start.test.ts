import { describe, expect, it, vi } from "vitest";
import type { EnhancedUserJourney, JourneyConfig } from "@journey/schemas";
import { SessionEngine } from "../session-engine";
import { MockMessagingAdapter } from "./helpers/mock-adapter";
import type { SessionEngineConfig } from "../types";

const createSession = (overrides?: Partial<EnhancedUserJourney>): EnhancedUserJourney => {
  const now = new Date().toISOString();
  return {
    sessionId: "session-1",
    userId: "user-1",
    platformUserId: "user-1",
    journeyId: "invalid-journey",
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

const createLoggerStub = () =>
  ({
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn(),
  }) as unknown as ReturnType<typeof import("@journey/logger").createLogger>;

const journeyWithOrphanNode: JourneyConfig = {
  nodes: [
    {
      id: "start",
      type: "custom",
      position: { x: 0, y: 0 },
      data: { type: "start", label: "Start", content: "Welcome" },
    },
    {
      id: "end",
      type: "custom",
      position: { x: 0, y: 100 },
      data: { type: "end", label: "End", content: "Done" },
    },
    {
      id: "orphan",
      type: "custom",
      position: { x: 100, y: 100 },
      data: { type: "message", label: "Orphan", content: "Unused" },
    },
  ],
  edges: [
    {
      id: "edge-start-end",
      source: "start",
      target: "end",
      edgeType: "default",
      label: "Auto transition",
    },
  ],
} as JourneyConfig;

describe("SessionEngine validateOnStart", () => {
  it("throws in strict mode when validation errors exist", async () => {
    const adapter = new MockMessagingAdapter();
    const session = createSession();

    const config: SessionEngineConfig = {
      validateOnStart: { strict: true },
      logger: createLoggerStub(),
    };

    const engine = new SessionEngine(session, journeyWithOrphanNode, adapter, config);

    await expect(engine.start()).rejects.toThrow("Journey validation failed");
  });

  it("logs validation errors and continues when non-strict", async () => {
    const adapter = new MockMessagingAdapter();
    const session = createSession();
    const logger = createLoggerStub();

    const config: SessionEngineConfig = {
      validateOnStart: true,
      logger,
    };

    const engine = new SessionEngine(session, journeyWithOrphanNode, adapter, config);

    await engine.start();

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ code: "ORPHAN_NODE" }),
      "engine:validation:error"
    );
    expect(engine.getSession().status).toBe("completed");
  });
});
