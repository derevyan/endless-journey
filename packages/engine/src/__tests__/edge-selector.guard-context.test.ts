import { describe, expect, it, vi } from "vitest";
import { EventTypes, type EnhancedUserJourney, type JourneyEdgeData, type JourneyNodeData } from "@journey/schemas";
import { EdgeSelector } from "../services/edge-selector";
import { createSessionStateManager } from "../state/session-state-manager";
import type { EngineServices, ExecutionContext } from "../types";
import { createStateMethods } from "../utils";

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

const createNode = (): JourneyNodeData =>
  ({
    id: "node-1",
    type: "custom",
    position: { x: 0, y: 0 },
    data: { type: "message", label: "Node", content: "Hi" },
  }) as JourneyNodeData;

const createServices = (options: {
  journeyVars?: Record<string, unknown>;
  globalVars?: Record<string, unknown>;
  userVars?: Record<string, unknown>;
  eventLogger?: EngineServices["eventLogger"];
}): EngineServices => {
  const {
    journeyVars = {},
    globalVars = {},
    userVars = {},
    eventLogger = { logEvent: vi.fn() },
  } = options;

  const variable = {
    executeAction: vi.fn(),
    getAll: vi.fn(async (scope: "journey" | "global" | "user") => {
      if (scope === "journey") return journeyVars;
      if (scope === "global") return globalVars;
      return userVars;
    }),
  };

  return {
    messenger: { sendMessage: vi.fn() },
    timer: {
      scheduleTimer: vi.fn(),
      cancelTimer: vi.fn(),
      cancelTimersForNode: vi.fn(),
      getEdgeForTimer: vi.fn(),
      markTimerFired: vi.fn(),
      clearAll: vi.fn(),
      // Plugin follow-up methods
      schedulePluginFollowUpTimer: vi.fn(),
      getPluginFollowUpContext: vi.fn(),
      hasPluginFollowUp: vi.fn(),
      markPluginFollowUpFired: vi.fn(),
      cancelPluginFollowUpsForNode: vi.fn(),
      cancelAllPluginFollowUps: vi.fn(),
      shouldCancelPluginFollowUpsOnResponse: vi.fn(),
      getPluginFollowUpResponseBehavior: vi.fn().mockReturnValue(null),
    },
    eventLogger,
    conditionEvaluator: { evaluate: vi.fn() },
    webhookExecutor: { execute: vi.fn(), executeRequest: vi.fn() },
    template: { substitute: vi.fn((t: string) => t) },
    tag: { executeTagAction: vi.fn(), getTags: vi.fn() },
    variable,
    conversationHistory: {
      buildFromEvents: vi.fn().mockReturnValue([]),
      getLastUserMessage: vi.fn().mockReturnValue(""),
      hasRecentUserMessage: vi.fn().mockReturnValue(false),
    },
    expression: {
      evaluate: vi.fn(),
      isTruthy: vi.fn(),
      validate: vi.fn(),
    },
    has: () => false,
  } as EngineServices;
};

const createContext = (options: {
  session?: EnhancedUserJourney;
  node?: JourneyNodeData;
  edges: JourneyEdgeData[];
  services: EngineServices;
}): ExecutionContext => {
  const session = options.session ?? createSession();
  const node = options.node ?? createNode();
  const stateManager = createSessionStateManager(session);

  return {
    session,
    stateManager,
    node,
    journey: { nodes: [node], edges: options.edges },
    outgoingEdges: options.edges,
    services: options.services,
    log: {
      trace: vi.fn(),
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      fatal: vi.fn(),
      child: vi.fn(),
    } as unknown as ExecutionContext["log"],
    clientData: { id: session.userId, platform: "telegram" },
    ...createStateMethods(session, node.id, node.data.type, stateManager),
  };
};

describe("EdgeSelector.analyzeRequirements", () => {
  it("detects when guards need full context (vars.*)", () => {
    const edges: JourneyEdgeData[] = [
      {
        id: "edge-1",
        source: "node-1",
        target: "node-2",
        edgeType: "default",
        guard: { type: "expression", expression: "vars.journey.score > 10" },
      },
    ];

    const requirements = EdgeSelector.analyzeRequirements(edges);

    expect(requirements.needsFullContext).toBe(true);
    expect(requirements.needsVars).toBe(true);
  });

  it("detects when guards need full context (nodes.*)", () => {
    const edges: JourneyEdgeData[] = [
      {
        id: "edge-1",
        source: "node-1",
        target: "node-2",
        edgeType: "default",
        guard: { type: "expression", expression: "nodes.Profile.status == 'active'" },
      },
    ];

    const requirements = EdgeSelector.analyzeRequirements(edges);

    expect(requirements.needsFullContext).toBe(true);
    expect(requirements.needsNodes).toBe(true);
  });

  it("detects when guards need full context (mindstate.*)", () => {
    const edges: JourneyEdgeData[] = [
      {
        id: "edge-1",
        source: "node-1",
        target: "node-2",
        edgeType: "default",
        guard: { type: "expression", expression: "mindstate.sentiment == 'positive'" },
      },
    ];

    const requirements = EdgeSelector.analyzeRequirements(edges);

    expect(requirements.needsFullContext).toBe(true);
    expect(requirements.needsMindstate).toBe(true);
  });

  it("returns false for basic context guards (flat session context, tags, user.*)", () => {
    const edges: JourneyEdgeData[] = [
      {
        id: "edge-1",
        source: "node-1",
        target: "node-2",
        edgeType: "default",
        // Flat access to session context - does NOT trigger full context
        guard: { type: "expression", expression: "userResponse.value == 'yes'" },
      },
      {
        id: "edge-2",
        source: "node-1",
        target: "node-3",
        edgeType: "default",
        guard: { type: "tag", tag: { tag: "vip", operator: "has" as const } },
      },
    ];

    const requirements = EdgeSelector.analyzeRequirements(edges);

    expect(requirements.needsFullContext).toBe(false);
    expect(requirements.needsVars).toBe(false);
    expect(requirements.needsNodes).toBe(false);
    expect(requirements.needsMindstate).toBe(false);
  });

  it("returns false when edges have no guards", () => {
    const edges: JourneyEdgeData[] = [
      { id: "edge-1", source: "node-1", target: "node-2", edgeType: "default" },
      { id: "edge-2", source: "node-1", target: "node-3", edgeType: "default" },
    ];

    const requirements = EdgeSelector.analyzeRequirements(edges);

    expect(requirements.needsFullContext).toBe(false);
  });
});

describe("EdgeSelector.withAutoContext", () => {
  it("uses basic context for guards that only reference session context (flat access)", async () => {
    const edges: JourneyEdgeData[] = [
      {
        id: "edge-1",
        source: "node-1",
        target: "node-2",
        edgeType: "default",
        // Basic context spreads session.context at top level for flat access
        guard: { type: "expression", expression: "userResponse.value == 'yes'" },
      },
    ];

    const session = createSession({ context: { userResponse: { value: "yes", type: "text" } } });
    const services = createServices({});
    const context = createContext({ session, edges, services });

    const selector = await EdgeSelector.from(context).withAutoContext(edges);
    const result = selector.select(edges);

    // Variable service should NOT be called for basic context
    expect(services.variable.getAll).not.toHaveBeenCalled();
    expect(result.passableEdges).toHaveLength(1);
    expect(result.passableEdges[0].id).toBe("edge-1");
  });

  it("uses full context for guards that reference vars.*", async () => {
    const edges: JourneyEdgeData[] = [
      {
        id: "edge-1",
        source: "node-1",
        target: "node-2",
        edgeType: "default",
        guard: { type: "expression", expression: "vars.journey.score >= 10" },
      },
    ];

    const services = createServices({ journeyVars: { score: 42 } });
    const context = createContext({ edges, services });

    const selector = await EdgeSelector.from(context).withAutoContext(edges);
    const result = selector.select(edges);

    // Variable service SHOULD be called for full context
    expect(services.variable.getAll).toHaveBeenCalledWith("journey");
    expect(result.passableEdges).toHaveLength(1);
    expect(result.passableEdges[0].id).toBe("edge-1");
  });
});

describe("Edge selector guard context", () => {
  it("evaluates expression guards against vars.* and nodes.*", async () => {
    const session = createSession({
      nodeOutputs: {
        Profile: {
          nodeId: "node-profile",
          nodeLabel: "Profile",
          nodeType: "webhook",
          executedAt: new Date().toISOString(),
          data: { status: "active" },
        },
      },
    });

    const edges: JourneyEdgeData[] = [
      {
        id: "edge-score",
        source: "node-1",
        target: "node-score",
        edgeType: "default",
        guard: { type: "expression", expression: "vars.journey.score >= 10" },
      },
      {
        id: "edge-profile",
        source: "node-1",
        target: "node-profile",
        edgeType: "default",
        guard: { type: "expression", expression: "nodes.Profile.status == 'active'" },
      },
    ];

    const services = createServices({ journeyVars: { score: 42 } });
    const context = createContext({ session, edges, services });

    const selector = await EdgeSelector.from(context).withFullContext();
    const result = selector.select(edges);

    expect(result.passableEdges.map((edge) => edge.id)).toEqual(["edge-score", "edge-profile"]);
    expect((services.variable.getAll as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith("journey");
    expect((services.variable.getAll as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith("global");
    expect((services.variable.getAll as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith("user");
  });

  it("returns fallback edge when it has no guard (passes Phase 1)", async () => {
    // Note: Edges without guards pass by default in filterByGuards.
    // A fallback edge with no guard will pass Phase 1, so no fallback event is emitted.
    const edges: JourneyEdgeData[] = [
      {
        id: "edge-pro",
        source: "node-1",
        target: "node-pro",
        edgeType: "default",
        guard: { type: "expression", expression: "vars.journey.plan == 'pro'" },
      },
      {
        id: "edge-vip",
        source: "node-1",
        target: "node-vip",
        edgeType: "default",
        guard: { type: "expression", expression: "vars.user.tier == 'vip'" },
      },
      {
        id: "edge-fallback",
        source: "node-1",
        target: "node-fallback",
        edgeType: "default",
        fallback: true,
      },
    ];

    const eventLogger = { logEvent: vi.fn() };
    const services = createServices({
      journeyVars: { plan: "free" },
      userVars: { tier: "basic" },
      eventLogger,
    });
    const context = createContext({ edges, services });

    const selector = await EdgeSelector.from(context).withFullContext();
    const result = selector.selectTwoPhase(edges);

    // The fallback edge has no guard, so it passes Phase 1
    expect(result.guardPassableEdges).toHaveLength(1);
    expect(result.guardPassableEdges[0].id).toBe("edge-fallback");
    // passableEdges equals guardPassableEdges since Phase 1 succeeded
    expect(result.passableEdges).toHaveLength(1);
    expect(result.passableEdges[0].id).toBe("edge-fallback");
  });

  it("emits fallback event when all edges have guards and all fail", async () => {
    // For fallback event to fire, ALL edges must have guards that fail
    const edges: JourneyEdgeData[] = [
      {
        id: "edge-pro",
        source: "node-1",
        target: "node-pro",
        edgeType: "default",
        guard: { type: "expression", expression: "vars.journey.plan == 'pro'" },
      },
      {
        id: "edge-vip",
        source: "node-1",
        target: "node-vip",
        edgeType: "default",
        guard: { type: "expression", expression: "vars.user.tier == 'vip'" },
      },
      {
        id: "edge-fallback",
        source: "node-1",
        target: "node-fallback",
        edgeType: "default",
        fallback: true,
        // Fallback with a guard that always fails - fallback is still used via findFallbackEdge
        guard: { type: "expression", expression: "false" },
      },
    ];

    const eventLogger = { logEvent: vi.fn() };
    const services = createServices({
      journeyVars: { plan: "free" },
      userVars: { tier: "basic" },
      eventLogger,
    });
    const context = createContext({ edges, services });

    const selector = await EdgeSelector.from(context).withFullContext();
    const result = selector.selectTwoPhase(edges);

    // All edges have guards that fail, so Phase 1 returns 0
    expect(result.guardPassableEdges).toHaveLength(0);
    // Phase 2 applies fallback logic
    expect(result.passableEdges).toHaveLength(1);
    expect(result.passableEdges[0].id).toBe("edge-fallback");
    expect(eventLogger.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: EventTypes.LLM_GUARD_FALLBACK,
        payload: expect.objectContaining({ fallbackEdgeId: "edge-fallback" }),
      })
    );
  });
});
