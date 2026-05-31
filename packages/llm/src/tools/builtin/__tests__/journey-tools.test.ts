/**
 * Journey Tools Tests
 *
 * Tests for journey routing tools:
 * - start_journey tool (allowlist validation, session transfer)
 * - list_journeys tool (filtered by allowlist)
 * - get_active_journeys tool (user's active sessions)
 * - buildJourneyTools builder function
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createStartJourneyTool,
  createListJourneysTool,
  createGetActiveJourneysTool,
  buildJourneyTools,
} from "../journey-tools";
import type { BuiltinToolContext } from "../types";
import type { IJourneyService, SharedServiceContext } from "@journey/schemas";

// Helper type for tool results in tests (AgentTool.execute returns unknown)
type ToolResult = Record<string, unknown>;

// =============================================================================
// MOCK FACTORIES
// =============================================================================

function createMockJourneyService(): IJourneyService {
  return {
    startUserInJourney: vi.fn().mockResolvedValue({
      success: true,
      sessionId: "new-session-123",
      previousSessionId: "old-session-456",
    }),
    getUserActiveJourneys: vi.fn().mockResolvedValue([
      {
        sessionId: "session-1",
        journeyId: "journey-onboarding",
        journeyName: "Onboarding Flow",
        status: "active" as const,
        currentNodeId: "step-3",
        startedAt: new Date("2024-01-15T10:00:00Z"),
      },
      {
        sessionId: "session-2",
        journeyId: "journey-support",
        journeyName: "Support Chat",
        status: "paused" as const,
        currentNodeId: "waiting",
        startedAt: new Date("2024-01-10T08:00:00Z"),
      },
    ]),
    listJourneys: vi.fn().mockResolvedValue([
      { id: "journey-sales", slug: "sales", name: "Sales Flow", description: "Sales process", status: "active" as const },
      { id: "journey-support", slug: "support", name: "Support Chat", description: "Customer support", status: "active" as const },
    ]),
    endUserSession: vi.fn().mockResolvedValue(true),
    getJourneyInfo: vi.fn().mockResolvedValue({
      id: "journey-sales",
      slug: "sales",
      name: "Sales Flow",
      description: "Sales process",
      status: "active" as const,
    }),
    hasUserCompletedJourney: vi.fn().mockResolvedValue(false),
  };
}

function createMockServices(journey?: IJourneyService): SharedServiceContext {
  return {
    variable: {
      getValue: vi.fn(),
      setValue: vi.fn(),
      getAll: vi.fn(),
      executeOperation: vi.fn(),
      executeAction: vi.fn(),
      delete: vi.fn(),
      exists: vi.fn(),
    },
    template: {
      substitute: vi.fn((template: string) => template),
      resolve: vi.fn(),
      hasVariables: vi.fn(),
      extractVariables: vi.fn(),
    },
    messenger: {
      sendMessage: vi.fn(),
      sendButtons: vi.fn(),
      sendMedia: vi.fn(),
    },
    journey,
    has: (service) => service === "journey" ? !!journey : false,
  };
}

function createMockContext(journey?: IJourneyService): BuiltinToolContext {
  return {
    nodeId: "test-agent-node",
    services: createMockServices(journey),
    session: {
      sessionId: "current-session",
      journeyId: "current-journey",
      userId: "test-user-123",
      currentNodeId: "test-agent-node",
    },
    clientData: { id: "client-123" },
    log: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  };
}

// =============================================================================
// TESTS
// =============================================================================

describe("Journey Tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("buildJourneyTools", () => {
    it("returns all tools when all are enabled and journey service exists", () => {
      const journeyService = createMockJourneyService();
      const context = createMockContext(journeyService);

      const tools = buildJourneyTools(context, {
        startJourney: true,
        listJourneys: true,
        getActiveJourneys: true,
      });

      expect(tools).toHaveLength(3);
      expect(tools.map((t) => t.name).sort()).toEqual([
        "get_active_journeys",
        "list_journeys",
        "start_journey",
      ]);
    });

    it("returns only enabled tools", () => {
      const journeyService = createMockJourneyService();
      const context = createMockContext(journeyService);

      const tools = buildJourneyTools(context, {
        startJourney: true,
        listJourneys: false,
        getActiveJourneys: false,
      });

      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe("start_journey");
    });

    it("returns empty array when no journey service is provided", () => {
      const context = createMockContext(undefined);

      const tools = buildJourneyTools(context, {
        startJourney: true,
        listJourneys: true,
        getActiveJourneys: true,
      });

      expect(tools).toHaveLength(0);
    });

    it("returns empty array when all tools are disabled", () => {
      const journeyService = createMockJourneyService();
      const context = createMockContext(journeyService);

      const tools = buildJourneyTools(context, {
        startJourney: false,
        listJourneys: false,
        getActiveJourneys: false,
      });

      expect(tools).toHaveLength(0);
    });
  });

  describe("start_journey tool", () => {
    it("successfully routes user to new journey", async () => {
      const journeyService = createMockJourneyService();
      const context = createMockContext(journeyService);
      const tool = createStartJourneyTool(context);

      const result = (await tool.execute({
        journeyId: "journey-sales",
        reason: "User wants to buy something",
        preserveContext: true,
      })) as ToolResult;

      expect(result.success).toBe(true);
      expect(result.newSessionId).toBe("new-session-123");
      expect(result.previousSessionId).toBe("old-session-456");
      expect(journeyService.startUserInJourney).toHaveBeenCalledWith(
        "test-user-123",
        "journey-sales",
        {
          preserveContext: true,
          currentSessionAction: "pause",
          reason: "User wants to buy something",
        }
      );
    });

    it("returns error when journey not in allowlist", async () => {
      const journeyService = createMockJourneyService();
      vi.mocked(journeyService.startUserInJourney).mockResolvedValueOnce({
        success: false,
        error: "not_in_allowlist",
        errorMessage: "Journey journey-blocked is not in the transfer allowlist",
      });
      const context = createMockContext(journeyService);
      const tool = createStartJourneyTool(context);

      const result = (await tool.execute({
        journeyId: "journey-blocked",
      })) as ToolResult;

      expect(result.success).toBe(false);
      expect(result.error).toBe("not_in_allowlist");
      expect(result.message).toContain("not in the transfer allowlist");
    });

    it("returns error when target journey not found", async () => {
      const journeyService = createMockJourneyService();
      vi.mocked(journeyService.startUserInJourney).mockResolvedValueOnce({
        success: false,
        error: "journey_not_found",
        errorMessage: "Journey journey-missing not found",
      });
      const context = createMockContext(journeyService);
      const tool = createStartJourneyTool(context);

      const result = (await tool.execute({
        journeyId: "journey-missing",
      })) as ToolResult;

      expect(result.success).toBe(false);
      expect(result.error).toBe("journey_not_found");
    });

    it("returns error when journey service not available", async () => {
      const context = createMockContext(undefined);
      const tool = createStartJourneyTool(context);

      const result = (await tool.execute({
        journeyId: "journey-sales",
      })) as ToolResult;

      expect(result.success).toBe(false);
      expect(result.error).toContain("not available");
      expect(context.log.warn).toHaveBeenCalled();
    });

    it("handles service errors gracefully", async () => {
      const journeyService = createMockJourneyService();
      vi.mocked(journeyService.startUserInJourney).mockRejectedValueOnce(
        new Error("Database connection failed")
      );
      const context = createMockContext(journeyService);
      const tool = createStartJourneyTool(context);

      const result = (await tool.execute({
        journeyId: "journey-sales",
      })) as ToolResult;

      expect(result.success).toBe(false);
      expect(result.error).toBe("routing_failed");
      expect(result.message).toContain("Database connection failed");
      expect(context.log.error).toHaveBeenCalled();
    });

    it("defaults preserveContext to true", async () => {
      const journeyService = createMockJourneyService();
      const context = createMockContext(journeyService);
      const tool = createStartJourneyTool(context);

      await tool.execute({ journeyId: "journey-sales" });

      expect(journeyService.startUserInJourney).toHaveBeenCalledWith(
        "test-user-123",
        "journey-sales",
        expect.objectContaining({ preserveContext: true })
      );
    });
  });

  describe("list_journeys tool", () => {
    it("returns available journeys from service", async () => {
      const journeyService = createMockJourneyService();
      const context = createMockContext(journeyService);
      const tool = createListJourneysTool(context);

      const result = (await tool.execute({})) as ToolResult;

      expect(result.count).toBe(2);
      expect((result.journeys as unknown[]).length).toBe(2);
      expect((result.journeys as Record<string, unknown>[])[0].name).toBe("Sales Flow");
      expect(journeyService.listJourneys).toHaveBeenCalledWith({
        allowlistOnly: true,
        search: undefined,
        limit: 20,
      });
    });

    it("filters journeys by search term", async () => {
      const journeyService = createMockJourneyService();
      const context = createMockContext(journeyService);
      const tool = createListJourneysTool(context);

      await tool.execute({ search: "sales" });

      expect(journeyService.listJourneys).toHaveBeenCalledWith({
        allowlistOnly: true,
        search: "sales",
        limit: 20,
      });
    });

    it("returns empty message when no journeys in allowlist", async () => {
      const journeyService = createMockJourneyService();
      vi.mocked(journeyService.listJourneys).mockResolvedValueOnce([]);
      const context = createMockContext(journeyService);
      const tool = createListJourneysTool(context);

      const result = (await tool.execute({})) as ToolResult;

      expect(result.count).toBe(0);
      expect(result.journeys).toEqual([]);
      expect(result.message).toContain("allowlist");
    });

    it("returns error when journey service not available", async () => {
      const context = createMockContext(undefined);
      const tool = createListJourneysTool(context);

      const result = (await tool.execute({})) as ToolResult;

      expect(result.journeys).toEqual([]);
      expect(result.message).toContain("not available");
    });

    it("handles service errors gracefully", async () => {
      const journeyService = createMockJourneyService();
      vi.mocked(journeyService.listJourneys).mockRejectedValueOnce(
        new Error("Query failed")
      );
      const context = createMockContext(journeyService);
      const tool = createListJourneysTool(context);

      const result = (await tool.execute({})) as ToolResult;

      expect(result.journeys).toEqual([]);
      expect(result.error).toBe("Failed to list journeys");
      expect(context.log.error).toHaveBeenCalled();
    });
  });

  describe("get_active_journeys tool", () => {
    it("returns user active and paused sessions", async () => {
      const journeyService = createMockJourneyService();
      const context = createMockContext(journeyService);
      const tool = createGetActiveJourneysTool(context);

      const result = (await tool.execute({})) as ToolResult;

      expect(result.count).toBe(2);
      expect(result.currentJourneyId).toBe("current-journey");
      const sessions = result.sessions as Record<string, unknown>[];
      expect(sessions.length).toBe(2);
      expect(sessions[0].journeyName).toBe("Onboarding Flow");
      expect(sessions[0].status).toBe("active");
      expect(sessions[1].status).toBe("paused");
      expect(journeyService.getUserActiveJourneys).toHaveBeenCalledWith("test-user-123");
    });

    it("marks current journey in results", async () => {
      const journeyService = createMockJourneyService();
      vi.mocked(journeyService.getUserActiveJourneys).mockResolvedValueOnce([
        {
          sessionId: "session-current",
          journeyId: "current-journey", // Matches context.session.journeyId
          journeyName: "Current Flow",
          status: "active" as const,
          currentNodeId: "node-1",
          startedAt: new Date(),
        },
      ]);
      const context = createMockContext(journeyService);
      const tool = createGetActiveJourneysTool(context);

      const result = (await tool.execute({})) as ToolResult;

      expect((result.sessions as Record<string, unknown>[])[0].isCurrent).toBe(true);
    });

    it("returns error when journey service not available", async () => {
      const context = createMockContext(undefined);
      const tool = createGetActiveJourneysTool(context);

      const result = (await tool.execute({})) as ToolResult;

      expect(result.sessions).toEqual([]);
      expect(result.message).toContain("not available");
    });

    it("handles service errors gracefully", async () => {
      const journeyService = createMockJourneyService();
      vi.mocked(journeyService.getUserActiveJourneys).mockRejectedValueOnce(
        new Error("Query failed")
      );
      const context = createMockContext(journeyService);
      const tool = createGetActiveJourneysTool(context);

      const result = (await tool.execute({})) as ToolResult;

      expect(result.sessions).toEqual([]);
      expect(result.error).toBe("Failed to get active journeys");
      expect(context.log.error).toHaveBeenCalled();
    });
  });

  describe("tool metadata", () => {
    it("start_journey has correct capabilities", () => {
      const journeyService = createMockJourneyService();
      const context = createMockContext(journeyService);
      const tool = createStartJourneyTool(context);

      expect(tool.name).toBe("start_journey");
      expect(tool.capabilities?.actions).toContain("startJourney");
      expect(tool.capabilities?.actions).toContain("routeUser");
    });

    it("list_journeys has correct capabilities", () => {
      const journeyService = createMockJourneyService();
      const context = createMockContext(journeyService);
      const tool = createListJourneysTool(context);

      expect(tool.name).toBe("list_journeys");
      expect(tool.capabilities?.actions).toContain("listJourneys");
    });

    it("get_active_journeys has correct capabilities", () => {
      const journeyService = createMockJourneyService();
      const context = createMockContext(journeyService);
      const tool = createGetActiveJourneysTool(context);

      expect(tool.name).toBe("get_active_journeys");
      expect(tool.capabilities?.actions).toContain("getActiveJourneys");
    });
  });
});
