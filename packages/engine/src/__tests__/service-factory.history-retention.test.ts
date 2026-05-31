import { describe, expect, it, vi } from "vitest";
import { EventTypes, type EnhancedUserJourney, type InteractionEvent } from "@journey/schemas";
import { ServiceFactory } from "../services/service-factory";
import { createSessionStateManager } from "../state/session-state-manager";
import { MockMessagingAdapter } from "./helpers/mock-adapter";
import type { SessionEngineConfig } from "../types";

const createSession = (overrides?: Partial<EnhancedUserJourney>): EnhancedUserJourney => {
  const now = new Date().toISOString();
  return {
    sessionId: "session-1",
    userId: "user-1",
    platformUserId: "user-1",
    journeyId: "journey-1",
    currentNodeId: "node-1",
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

describe("ServiceFactory history retention", () => {
  it("trims history to maxEvents and calls onTrim", () => {
    const session = createSession();
    const stateManager = createSessionStateManager(session);
    const adapter = new MockMessagingAdapter();
    const onTrim = vi.fn();

    const config: SessionEngineConfig = {
      historyRetention: { maxEvents: 2, onTrim },
    };

    const factory = new ServiceFactory(session, stateManager, adapter, config, createLoggerStub());
    const services = factory.createServices(() => []);

    services.eventLogger.logEvent({
      type: EventTypes.ENGINE_MESSAGE,
      nodeId: "node-1",
      payload: { content: "one" },
    });
    services.eventLogger.logEvent({
      type: EventTypes.ENGINE_MESSAGE,
      nodeId: "node-1",
      payload: { content: "two" },
    });
    services.eventLogger.logEvent({
      type: EventTypes.ENGINE_MESSAGE,
      nodeId: "node-1",
      payload: { content: "three" },
    });

    expect(session.history).toHaveLength(2);
    expect(onTrim).toHaveBeenCalledTimes(1);

    const trimArgs = onTrim.mock.calls[0][0] as { removed: InteractionEvent[]; retained: InteractionEvent[] };
    expect(trimArgs.removed).toHaveLength(1);
    expect(trimArgs.retained).toHaveLength(2);
  });

  it("trims history by maxAgeMs", () => {
    const oldTimestamp = new Date(Date.now() - 60_000).toISOString();
    const recentTimestamp = new Date(Date.now() - 1_000).toISOString();

    const session = createSession({
      history: [
        {
          id: "evt-old",
          timestamp: oldTimestamp,
          type: EventTypes.ENGINE_MESSAGE,
          nodeId: "node-1",
          payload: { content: "old" },
        },
        {
          id: "evt-recent",
          timestamp: recentTimestamp,
          type: EventTypes.ENGINE_MESSAGE,
          nodeId: "node-1",
          payload: { content: "recent" },
        },
      ],
    });

    const stateManager = createSessionStateManager(session);
    const adapter = new MockMessagingAdapter();
    const config: SessionEngineConfig = {
      historyRetention: { maxAgeMs: 5_000 },
    };

    const factory = new ServiceFactory(session, stateManager, adapter, config, createLoggerStub());
    const services = factory.createServices(() => []);

    services.eventLogger.logEvent({
      type: EventTypes.ENGINE_MESSAGE,
      nodeId: "node-1",
      payload: { content: "new" },
    });

    const hasOld = session.history.some((event) => event.id === "evt-old");
    expect(hasOld).toBe(false);
  });
});
