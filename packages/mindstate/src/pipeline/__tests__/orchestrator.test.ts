/**
 * Pipeline Orchestrator Integration Tests
 *
 * Tests the full 8-step pipeline flow using mock mode.
 * These tests verify real-world scenarios end-to-end.
 */

import { describe, it, expect, beforeEach } from "vitest";
import type { StateParameter, SystemAgent, MainAgent } from "@journey/schemas";
import type { PipelineContext, Message } from "../../types";
import { executePipeline, isPipelineError } from "../orchestrator";

// =============================================================================
// TEST FIXTURES - Realistic mindstate configuration
// =============================================================================

const mockMainAgent: MainAgent = {
  id: "main-agent",
  name: "Dr. Companion",
  role: "Primary Assistant",
  promptSource: "inline",
  systemPrompt: "You are a helpful companion.",
  llmConfig: { model: "mock" }, // Uses mock mode
};

const mockSystemAgents: SystemAgent[] = [
  {
    id: "emotional_agent",
    name: "Emotion Analyzer",
    role: "Emotional State Tracker",
    promptSource: "inline",
    systemPrompt: "Analyze emotional cues.",
    llmConfig: { model: "mock" },
  },
  {
    id: "cognitive_agent",
    name: "Cognitive Analyst",
    role: "Mental Load Tracker",
    promptSource: "inline",
    systemPrompt: "Track cognitive load.",
    llmConfig: { model: "mock" },
  },
];

function createStateParameters(): StateParameter[] {
  return [
    {
      id: "mood",
      name: "Mood",
      category: "Emotional",
      description: "Current emotional mood level",
      scaleType: "NUMERIC",
      min: 0,
      max: 10,
      currentValue: 5,
      responsibleAgentId: "emotional_agent",
      history: [],
    },
    {
      id: "stress",
      name: "Stress Level",
      category: "Mental",
      description: "Current stress level",
      scaleType: "NUMERIC",
      min: 0,
      max: 10,
      currentValue: 3,
      responsibleAgentId: "emotional_agent",
      updatePolicy: { hysteresis: 0.3 }, // 30% threshold - requires change >= 3
      history: [],
    },
    {
      id: "cognitive_load",
      name: "Cognitive Load",
      category: "Cognitive",
      description: "Mental processing burden",
      scaleType: "NUMERIC",
      min: 0,
      max: 10,
      currentValue: 4,
      responsibleAgentId: "cognitive_agent",
      history: [],
    },
    {
      id: "expertise",
      name: "Topic Familiarity",
      category: "Informational",
      description: "User's knowledge level",
      scaleType: "CATEGORICAL",
      options: ["Novice", "Beginner", "Intermediate", "Advanced", "Expert"],
      currentValue: "Intermediate",
      responsibleAgentId: "cognitive_agent",
      history: [],
    },
  ];
}

function createPipelineContext(overrides: Partial<PipelineContext> = {}): PipelineContext {
  return {
    userState: createStateParameters(),
    systemAgents: mockSystemAgents,
    mainAgent: mockMainAgent,
    messages: [],
    ...overrides,
  };
}

// =============================================================================
// INTEGRATION TESTS
// =============================================================================

describe("executePipeline (integration)", () => {
  describe("full pipeline flow with mock mode", () => {
    it("should process message through all 8 steps and return valid result", async () => {
      const context = createPipelineContext();

      const result = await executePipeline({
        userMessage: "I'm feeling a bit stressed today",
        context,
      });

      // Verify result structure
      expect(result.userMessage).toBeDefined();
      expect(result.userMessage.content).toBe("I'm feeling a bit stressed today");
      expect(result.userMessage.role).toBe("user");

      expect(result.assistantMessage).toBeDefined();
      expect(result.assistantMessage.role).toBe("assistant");
      expect(result.assistantMessage.content).toBeTruthy();

      expect(result.updatedState).toHaveLength(4);
      expect(result.newInsights).toBeDefined();
      expect(Array.isArray(result.newInsights)).toBe(true);

      // Verify metrics
      expect(result.metrics).toBeDefined();
      expect(result.metrics.durationMs).toBeGreaterThan(0);
      expect(result.metrics.agentCount).toBe(2);
      expect(result.metrics.parameterCount).toBe(4);
    });

    it("should track state changes in result", async () => {
      const context = createPipelineContext();

      const result = await executePipeline({
        userMessage: "Hello, how are you?",
        context,
      });

      // Mock mode makes deterministic changes (alternating +1/-1)
      // Changes array tracks what was updated
      expect(result.changes).toBeDefined();
      expect(Array.isArray(result.changes)).toBe(true);

      // Each change should have required fields
      for (const change of result.changes) {
        expect(change.parameterId).toBeDefined();
        expect(change.parameterName).toBeDefined();
        expect(change.oldValue).toBeDefined();
        expect(change.newValue).toBeDefined();
        expect(change.reasoning).toBeDefined();
      }
    });

    it("should update history for changed parameters", async () => {
      const context = createPipelineContext();
      const originalHistoryLength = context.userState[0].history.length;

      const result = await executePipeline({
        userMessage: "I need help with something",
        context,
      });

      // Find the mood parameter in updated state
      const updatedMood = result.updatedState.find((p) => p.id === "mood");
      expect(updatedMood).toBeDefined();

      // If mood was changed, history should grow
      const moodChange = result.changes.find((c) => c.parameterId === "mood");
      if (moodChange) {
        expect(updatedMood!.history.length).toBeGreaterThan(originalHistoryLength);
        expect(updatedMood!.history[updatedMood!.history.length - 1].value).toBe(moodChange.newValue);
      }
    });
  });

  describe("hysteresis filtering in real pipeline", () => {
    it("should skip changes that fail hysteresis threshold", async () => {
      // Create state with high hysteresis on stress (requires 30% change = 3 points)
      const stateParams = createStateParameters();
      const stressParam = stateParams.find((p) => p.id === "stress")!;
      stressParam.currentValue = 5; // Middle of range

      const context = createPipelineContext({ userState: stateParams });

      const result = await executePipeline({
        userMessage: "Test message",
        context,
      });

      // In mock mode, stress gets -1 change (index 1, odd = -1)
      // 5 -> 4 = delta of 1, ratio = 0.1, which is < 0.3 hysteresis
      // So stress should NOT be in changes (filtered by hysteresis)
      const stressChange = result.changes.find((c) => c.parameterId === "stress");

      // Stress should be blocked by hysteresis (change too small)
      expect(stressChange).toBeUndefined();

      // But other params without hysteresis should change
      const moodChange = result.changes.find((c) => c.parameterId === "mood");
      expect(moodChange).toBeDefined();
    });
  });

  describe("categorical parameters in real pipeline", () => {
    it("should update categorical parameters regardless of hysteresis", async () => {
      const context = createPipelineContext();

      const result = await executePipeline({
        userMessage: "I'm an expert in this topic",
        context,
      });

      // Categorical params (expertise) bypass hysteresis
      // In mock mode, it gets set to first option
      const expertiseUpdate = result.updatedState.find((p) => p.id === "expertise");
      expect(expertiseUpdate).toBeDefined();
      expect(typeof expertiseUpdate!.currentValue).toBe("string");
    });
  });

  describe("error handling", () => {
    it("should provide isPipelineError type guard", () => {
      const pipelineError = {
        step: "dispatch",
        error: new Error("Test error"),
        partial: { metrics: { durationMs: 100, agentCount: 0, parameterCount: 0, changesCount: 0 } },
      };

      expect(isPipelineError(pipelineError)).toBe(true);
      expect(isPipelineError(new Error("regular error"))).toBe(false);
      expect(isPipelineError(null)).toBe(false);
      expect(isPipelineError("string")).toBe(false);
    });
  });

  describe("pipeline hooks", () => {
    it("should call lifecycle hooks during execution", async () => {
      const stepsStarted: string[] = [];
      const stepsCompleted: string[] = [];

      const context = createPipelineContext();

      await executePipeline(
        { userMessage: "Test", context },
        {
          hooks: {
            onStepStart: (step) => stepsStarted.push(step),
            onStepComplete: (step) => stepsCompleted.push(step),
          },
        }
      );

      // All 8 steps should be tracked
      const expectedSteps = ["ingest", "context", "workload", "dispatch", "aggregate", "state-update", "insights", "response"];
      expect(stepsStarted).toEqual(expectedSteps);
      expect(stepsCompleted).toEqual(expectedSteps);
    });
  });
});
