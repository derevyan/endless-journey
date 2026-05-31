/**
 * Insights Step Tests
 *
 * Ensures insights reflect only applied changes when provided.
 */

import { describe, it, expect } from "vitest";
import type { StateParameter, SystemAgent } from "@journey/schemas";
import type { AgentBatchResult, StateUpdateOutput } from "../../../types";
import { generateInsights } from "../insights";

function createAgent(overrides: Partial<SystemAgent> = {}): SystemAgent {
  return {
    id: "agent-1",
    name: "Agent One",
    role: "Test Agent",
    promptSource: "inline",
    systemPrompt: "Test prompt",
    ...overrides,
  };
}

function createParameter(overrides: Partial<StateParameter> = {}): StateParameter {
  return {
    id: "param-1",
    name: "Param One",
    category: "Test",
    description: "Test parameter",
    scaleType: "NUMERIC",
    min: 0,
    max: 10,
    currentValue: 5,
    responsibleAgentId: "agent-1",
    history: [],
    ...overrides,
  };
}

describe("generateInsights", () => {
  it("should include only applied changes when changes are provided", () => {
    const userState: StateParameter[] = [
      createParameter({ id: "mood", name: "Mood", currentValue: 5 }),
      createParameter({ id: "stress", name: "Stress", currentValue: 5 }),
    ];

    const batchResults: AgentBatchResult[] = [
      {
        agent: createAgent(),
        analysis: ["Observed changes"],
        updates: [
          { id: "mood", newValue: 7, reasoning: "User sounded happier", agentId: "agent-1" },
          { id: "stress", newValue: 6, reasoning: "User sounded tense", agentId: "agent-1" },
        ],
      },
    ];

    const changes: StateUpdateOutput["changes"] = [
      {
        parameterId: "mood",
        parameterName: "Mood",
        oldValue: 5,
        newValue: 7,
        reasoning: "User sounded happier",
        agentId: "agent-1",
      },
    ];

    const result = generateInsights(batchResults, userState, "msg-1", changes);

    expect(result.insights).toHaveLength(1);
    expect(result.insights[0].updatesMade).toEqual([{ id: "mood", name: "Mood" }]);
  });

  it("should fall back to value comparison when changes are not provided", () => {
    const userState: StateParameter[] = [
      createParameter({ id: "mood", name: "Mood", currentValue: 5 }),
      createParameter({ id: "stress", name: "Stress", currentValue: 5 }),
    ];

    const batchResults: AgentBatchResult[] = [
      {
        agent: createAgent(),
        analysis: ["Observed changes"],
        updates: [
          { id: "mood", newValue: 5, reasoning: "No change", agentId: "agent-1" },
          { id: "stress", newValue: 6, reasoning: "User sounded tense", agentId: "agent-1" },
        ],
      },
    ];

    const result = generateInsights(batchResults, userState, "msg-1");

    expect(result.insights[0].updatesMade).toEqual([{ id: "stress", name: "Stress" }]);
  });
});
