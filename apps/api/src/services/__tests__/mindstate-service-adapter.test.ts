/**
 * Mindstate Service Adapter - Unit Tests
 *
 * Tests the adapter that wraps API mindstate services to match
 * the engine's MindstateService interface.
 *
 * Run with: pnpm vitest run src/services/__tests__/mindstate-service-adapter.test.ts
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { createMindstateServiceAdapter } from "../mindstate-service-adapter";
import { createNoOpApiMindstateService } from "@journey/schemas";
import type { AgentInsight, ClientMindstate, IApiMindstateService, PipelineMetrics, StateChange } from "@journey/schemas";

const baseService = createNoOpApiMindstateService();
const mockService = {
  ...baseService,
  getOrCreateClientMindstate: vi.fn(),
  analyzeMessage: vi.fn(),
  getParameterValue: vi.fn(),
  getParameterValues: vi.fn(),
} satisfies IApiMindstateService;

const mockGetOrCreateClientMindstate = vi.mocked(mockService.getOrCreateClientMindstate);
const mockAnalyzeMessage = vi.mocked(mockService.analyzeMessage);
const mockGetParameterValue = vi.mocked(mockService.getParameterValue);
const mockGetParameterValues = vi.mocked(mockService.getParameterValues);

// =============================================================================
// MOCK FACTORIES
// =============================================================================

function createMockClientMindstate(overrides: Partial<ClientMindstate> = {}): ClientMindstate {
  return {
    id: "mindstate-1",
    clientId: "client-test",
    definitionId: "def-1",
    stateParameters: [],
    systemAgents: [],
    agentInsights: [],
    lastAnalyzedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function createMockStateChange(overrides: Partial<StateChange> = {}): StateChange {
  return {
    parameterId: "param-1",
    parameterName: "interest_level",
    previousValue: 5,
    newValue: 8,
    reasoning: "User expressed enthusiasm",
    agentId: "agent-1",
    ...overrides,
  };
}

function createMockPipelineMetrics(overrides: Partial<PipelineMetrics> = {}): PipelineMetrics {
  return {
    durationMs: 150,
    agentCount: 3,
    parameterCount: 5,
    changesCount: 1,
    ...overrides,
  };
}

function createMockAgentInsight(overrides: Partial<AgentInsight> = {}): AgentInsight {
  return {
    id: "insight-1",
    agentId: "agent-1",
    agentName: "Interest Agent",
    messageId: "msg-1",
    timestamp: Date.now(),
    analysis: ["User shows high engagement"],
    updatesMade: [{ id: "param-1", name: "interest_level" }],
    ...overrides,
  };
}

describe("mindstate-service-adapter", () => {
  const TEST_ORG_ID = "org-test-123";
  const TEST_CLIENT_ID = "client-test-456";
  const TEST_MINDSTATE_KEY = "engagement";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===========================================================================
  // Factory Creation
  // ===========================================================================

  describe("createMindstateServiceAdapter", () => {
    it("should create adapter scoped to organization", () => {
      const adapter = createMindstateServiceAdapter(mockService, TEST_ORG_ID);

      expect(adapter).toBeDefined();
      expect(adapter.getOrCreateMindstate).toBeDefined();
      expect(adapter.analyzeMessage).toBeDefined();
      expect(adapter.getParameterValue).toBeDefined();
      expect(adapter.getMultipleParameterValues).toBeDefined();
      expect(adapter.setParameterValue).toBeDefined();
    });

    it("should call service methods with expected arguments", async () => {
      const adapter = createMindstateServiceAdapter(mockService, TEST_ORG_ID);

      mockGetOrCreateClientMindstate.mockResolvedValue(createMockClientMindstate());

      await adapter.getOrCreateMindstate(TEST_CLIENT_ID, TEST_MINDSTATE_KEY);

      expect(mockGetOrCreateClientMindstate).toHaveBeenCalledWith(TEST_CLIENT_ID, TEST_MINDSTATE_KEY);
    });
  });

  // ===========================================================================
  // getOrCreateMindstate
  // ===========================================================================

  describe("getOrCreateMindstate", () => {
    it("should delegate to underlying service with correct args", async () => {
      const adapter = createMindstateServiceAdapter(mockService, TEST_ORG_ID);
      const mockResult = createMockClientMindstate({
        clientId: TEST_CLIENT_ID,
      });

      mockGetOrCreateClientMindstate.mockResolvedValue(mockResult);

      const result = await adapter.getOrCreateMindstate(TEST_CLIENT_ID, TEST_MINDSTATE_KEY);

      expect(mockGetOrCreateClientMindstate).toHaveBeenCalledWith(TEST_CLIENT_ID, TEST_MINDSTATE_KEY);
      expect(result).toEqual(mockResult);
    });

    it("should log and rethrow on error", async () => {
      const adapter = createMindstateServiceAdapter(mockService, TEST_ORG_ID);
      const testError = new Error("Database connection failed");

      mockGetOrCreateClientMindstate.mockRejectedValue(testError);

      await expect(adapter.getOrCreateMindstate(TEST_CLIENT_ID, TEST_MINDSTATE_KEY)).rejects.toThrow(
        "Database connection failed"
      );
    });
  });

  // ===========================================================================
  // analyzeMessage
  // ===========================================================================

  describe("analyzeMessage", () => {
    it("should map API result to engine interface", async () => {
      const adapter = createMindstateServiceAdapter(mockService, TEST_ORG_ID);
      const mockApiResult = {
        mindstateId: "mindstate-1",
        changes: [createMockStateChange()],
        newInsights: [createMockAgentInsight()],
        metrics: createMockPipelineMetrics(),
        responseMessage: "Analysis complete",
      };

      mockAnalyzeMessage.mockResolvedValue(mockApiResult);

      const result = await adapter.analyzeMessage("mindstate-1", "I love this product!", "session-123");

      expect(mockAnalyzeMessage).toHaveBeenCalledWith("mindstate-1", "I love this product!", "message", "session-123");

      // Verify engine interface mapping
      expect(result).toEqual({
        updatedState: [], // Engine tracks state internally
        changes: mockApiResult.changes,
        metrics: mockApiResult.metrics,
      });
    });

    it("should include changes and metrics in result", async () => {
      const adapter = createMindstateServiceAdapter(mockService, TEST_ORG_ID);
      const mockApiResult = {
        mindstateId: "mindstate-1",
        changes: [createMockStateChange({ parameterName: "mood", newValue: "happy" })],
        newInsights: [],
        metrics: createMockPipelineMetrics({ durationMs: 200 }),
      };

      mockAnalyzeMessage.mockResolvedValue(mockApiResult);

      const result = await adapter.analyzeMessage("mindstate-1", "Great day!", undefined);

      expect(result.changes).toHaveLength(1);
      expect(result.changes[0].parameterName).toBe("mood");
      expect(result.metrics?.durationMs).toBe(200);
    });

    it("should handle missing optional fields", async () => {
      const adapter = createMindstateServiceAdapter(mockService, TEST_ORG_ID);
      const mockApiResult = {
        mindstateId: "mindstate-1",
        changes: [],
        newInsights: [],
        metrics: createMockPipelineMetrics({ changesCount: 0 }),
      };

      mockAnalyzeMessage.mockResolvedValue(mockApiResult);

      const result = await adapter.analyzeMessage("mindstate-1", "Hello", undefined);

      expect(result.changes).toEqual([]);
      expect(result.metrics).toBeDefined();
    });

    it("should log and rethrow on error", async () => {
      const adapter = createMindstateServiceAdapter(mockService, TEST_ORG_ID);
      const testError = new Error("LLM service unavailable");

      mockAnalyzeMessage.mockRejectedValue(testError);

      await expect(adapter.analyzeMessage("mindstate-1", "test", "session-1")).rejects.toThrow(
        "LLM service unavailable"
      );
    });
  });

  // ===========================================================================
  // getParameterValue
  // ===========================================================================

  describe("getParameterValue", () => {
    it("should return parameter value for existing key", async () => {
      const adapter = createMindstateServiceAdapter(mockService, TEST_ORG_ID);
      const mockValue = 8; // StateParameterValue is number | string | boolean

      mockGetParameterValue.mockResolvedValue(mockValue);

      const result = await adapter.getParameterValue(TEST_CLIENT_ID, TEST_MINDSTATE_KEY, "interest_level");

      expect(mockGetParameterValue).toHaveBeenCalledWith(TEST_CLIENT_ID, TEST_MINDSTATE_KEY, "interest_level");
      expect(result).toEqual(mockValue);
    });

    it("should return null for missing parameter", async () => {
      const adapter = createMindstateServiceAdapter(mockService, TEST_ORG_ID);

      mockGetParameterValue.mockResolvedValue(null);

      const result = await adapter.getParameterValue(TEST_CLIENT_ID, TEST_MINDSTATE_KEY, "nonexistent");

      expect(result).toBeNull();
    });

    it("should log and rethrow on error", async () => {
      const adapter = createMindstateServiceAdapter(mockService, TEST_ORG_ID);
      const testError = new Error("Query failed");

      mockGetParameterValue.mockRejectedValue(testError);

      await expect(
        adapter.getParameterValue(TEST_CLIENT_ID, TEST_MINDSTATE_KEY, "param")
      ).rejects.toThrow("Query failed");
    });

    it("should handle different value types (string)", async () => {
      const adapter = createMindstateServiceAdapter(mockService, TEST_ORG_ID);
      mockGetParameterValue.mockResolvedValue("high");

      const result = await adapter.getParameterValue(TEST_CLIENT_ID, TEST_MINDSTATE_KEY, "satisfaction");
      expect(result).toBe("high");
    });

    it("should handle different value types (boolean)", async () => {
      const adapter = createMindstateServiceAdapter(mockService, TEST_ORG_ID);
      mockGetParameterValue.mockResolvedValue(true);

      const result = await adapter.getParameterValue(TEST_CLIENT_ID, TEST_MINDSTATE_KEY, "is_engaged");
      expect(result).toBe(true);
    });
  });

  // ===========================================================================
  // getMultipleParameterValues
  // ===========================================================================

  describe("getMultipleParameterValues", () => {
    it("should batch query multiple parameters", async () => {
      const adapter = createMindstateServiceAdapter(mockService, TEST_ORG_ID);
      const queries = [
        { mindstateKey: "engagement", parameterName: "interest_level" },
        { mindstateKey: "engagement", parameterName: "satisfaction" },
        { mindstateKey: "preferences", parameterName: "communication_style" },
      ];
      // StateParameterValue is number | string | boolean
      const mockResultMap = new Map<string, number | string | boolean>([
        ["engagement:interest_level", 8],
        ["engagement:satisfaction", "high"],
        ["preferences:communication_style", "formal"],
      ]);

      mockGetParameterValues.mockResolvedValue(mockResultMap);

      const result = await adapter.getMultipleParameterValues(TEST_CLIENT_ID, queries);

      expect(mockGetParameterValues).toHaveBeenCalledWith(TEST_CLIENT_ID, queries);
      expect(result.size).toBe(3);
    });

    it("should return Map with all results", async () => {
      const adapter = createMindstateServiceAdapter(mockService, TEST_ORG_ID);
      const queries = [{ mindstateKey: "test", parameterName: "value" }];
      const mockResultMap = new Map<string, number | string | boolean>([["test:value", 42]]);

      mockGetParameterValues.mockResolvedValue(mockResultMap);

      const result = await adapter.getMultipleParameterValues(TEST_CLIENT_ID, queries);

      expect(result).toBeInstanceOf(Map);
      expect(result.get("test:value")).toBe(42);
    });

    it("should handle empty query array", async () => {
      const adapter = createMindstateServiceAdapter(mockService, TEST_ORG_ID);
      const emptyMap = new Map<string, number | string | boolean>();

      mockGetParameterValues.mockResolvedValue(emptyMap);

      const result = await adapter.getMultipleParameterValues(TEST_CLIENT_ID, []);

      expect(result.size).toBe(0);
    });

    it("should log and rethrow on error", async () => {
      const adapter = createMindstateServiceAdapter(mockService, TEST_ORG_ID);
      const testError = new Error("Batch query failed");

      mockGetParameterValues.mockRejectedValue(testError);

      await expect(
        adapter.getMultipleParameterValues(TEST_CLIENT_ID, [{ mindstateKey: "k", parameterName: "p" }])
      ).rejects.toThrow("Batch query failed");
    });
  });

  // ===========================================================================
  // setParameterValue
  // ===========================================================================

  describe("setParameterValue", () => {
    it("should throw NotImplementedError", async () => {
      const adapter = createMindstateServiceAdapter(mockService, TEST_ORG_ID);

      await expect(
        adapter.setParameterValue(TEST_CLIENT_ID, TEST_MINDSTATE_KEY, "param", 5, "manual update")
      ).rejects.toThrow(/not implemented.*setParameterValue/i);
    });

    it("should include feature name in error message", async () => {
      const adapter = createMindstateServiceAdapter(mockService, TEST_ORG_ID);

      await expect(
        adapter.setParameterValue(TEST_CLIENT_ID, TEST_MINDSTATE_KEY, "param", "value")
      ).rejects.toThrow(/setParameterValue/);
    });
  });
});
