/**
 * Dispatch Step Tests
 *
 * Tests for parallel agent dispatch with partial failure handling.
 * Focus on resilience scenarios that matter in production.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { StateParameter, SystemAgent } from "@journey/schemas";
import type { WorkloadOutput } from "../../../types";
import { dispatchAgents } from "../dispatch";

// Mock the agent service
vi.mock("../../../llm/agent-service", () => ({
  updateAgentStateBatch: vi.fn(),
}));

import { updateAgentStateBatch } from "../../../llm/agent-service";

// =============================================================================
// TEST FIXTURES
// =============================================================================

const mockAgents: SystemAgent[] = [
  {
    id: "agent-1",
    name: "Agent One",
    role: "Test Agent",
    promptSource: "inline",
    systemPrompt: "You are a test agent",
    llmConfig: { model: "mock" },
  },
  {
    id: "agent-2",
    name: "Agent Two",
    role: "Test Agent",
    promptSource: "inline",
    systemPrompt: "You are a test agent",
    llmConfig: { model: "mock" },
  },
];

function createParameter(id: string, agentId: string): StateParameter {
  return {
    id,
    name: `Param ${id}`,
    category: "Test",
    description: "Test parameter",
    scaleType: "NUMERIC",
    min: 0,
    max: 10,
    currentValue: 5,
    responsibleAgentId: agentId,
    history: [],
  };
}

function createWorkload(agentParams: Map<string, StateParameter[]>): WorkloadOutput {
  return {
    agentWorkload: agentParams,
    agentCount: agentParams.size,
  };
}

// =============================================================================
// TESTS: Resilience scenarios
// =============================================================================

describe("dispatchAgents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("partial failures - critical for production resilience", () => {
    it("should return partial success when one agent fails (network error)", async () => {
      // Simulates: Agent 1 responds, Agent 2 has network timeout
      vi.mocked(updateAgentStateBatch)
        .mockResolvedValueOnce({
          analysis: ["User shows signs of stress"],
          updates: [{ id: "p1", newValue: 7, reasoning: "Elevated stress indicators", agentId: "agent-1" }],
        })
        .mockRejectedValueOnce(new Error("Network timeout after 30s"));

      const workload = createWorkload(
        new Map([
          ["agent-1", [createParameter("p1", "agent-1")]],
          ["agent-2", [createParameter("p2", "agent-2")]],
        ])
      );

      const result = await dispatchAgents(workload, mockAgents, "I'm really stressed", "context");

      // Should still have results from Agent 1
      expect(result.batchResults).toHaveLength(1);
      expect(result.batchResults[0].updates[0].newValue).toBe(7);

      // Should track the failure
      expect(result.failedAgents).toHaveLength(1);
      expect(result.partialSuccess).toBe(true);

      // Failure should include debugging info
      expect(result.failedAgents?.[0]).toMatchObject({
        agentId: "agent-2",
        agentName: "Agent Two",
        affectedParams: ["p2"],
      });
    });

    it("should include all affected parameters when agent fails", async () => {
      // Agent responsible for multiple parameters fails
      vi.mocked(updateAgentStateBatch).mockRejectedValue(new Error("LLM rate limit"));

      const workload = createWorkload(
        new Map([
          [
            "agent-1",
            [
              createParameter("mood", "agent-1"),
              createParameter("stress", "agent-1"),
              createParameter("energy", "agent-1"),
            ],
          ],
        ])
      );

      const result = await dispatchAgents(workload, mockAgents, "test", "context");

      // All 3 parameters should be listed as affected
      expect(result.failedAgents?.[0].affectedParams).toEqual(["mood", "stress", "energy"]);
    });
  });

  describe("complete failures - graceful degradation", () => {
    it("should return empty results when all agents fail", async () => {
      // Simulates: LLM service completely down
      vi.mocked(updateAgentStateBatch).mockRejectedValue(new Error("Service unavailable"));

      const workload = createWorkload(
        new Map([
          ["agent-1", [createParameter("p1", "agent-1")]],
          ["agent-2", [createParameter("p2", "agent-2")]],
        ])
      );

      const result = await dispatchAgents(workload, mockAgents, "test", "context");

      // No results, but also no crash
      expect(result.batchResults).toHaveLength(0);
      expect(result.failedAgents).toHaveLength(2);
      expect(result.partialSuccess).toBe(false); // Complete failure, not partial
    });

    it("should convert non-Error failures to Error objects", async () => {
      // Some libraries throw strings or other non-Error types
      vi.mocked(updateAgentStateBatch).mockRejectedValue("API key invalid");

      const workload = createWorkload(new Map([["agent-1", [createParameter("p1", "agent-1")]]]));

      const result = await dispatchAgents(workload, mockAgents, "test", "context");

      // Should be normalized to Error
      expect(result.failedAgents?.[0].error).toBeInstanceOf(Error);
      expect(result.failedAgents?.[0].error.message).toBe("API key invalid");
    });
  });

  describe("configuration validation", () => {
    it("should skip workload entries for non-existent agents", async () => {
      // Simulates: Config has agent ID that doesn't exist in agent list
      vi.mocked(updateAgentStateBatch).mockResolvedValue({
        analysis: ["OK"],
        updates: [],
      });

      const workload = createWorkload(
        new Map([
          ["agent-1", [createParameter("p1", "agent-1")]],
          ["deleted-agent", [createParameter("p2", "deleted-agent")]], // Agent was deleted
        ])
      );

      const result = await dispatchAgents(workload, mockAgents, "test", "context");

      // Only agent-1 should be called
      expect(updateAgentStateBatch).toHaveBeenCalledTimes(1);
      expect(result.batchResults).toHaveLength(1);
      // No failure recorded - just silently skipped
    });
  });
});
