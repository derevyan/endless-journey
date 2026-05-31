/**
 * State Update Step Tests
 *
 * Tests for hysteresis logic and state update application.
 */

import { describe, it, expect } from "vitest";
import type { StateParameter } from "@journey/schemas";
import type { AggregateOutput } from "../../../types";
import { applyStateUpdates } from "../state-update";

// =============================================================================
// TEST FIXTURES
// =============================================================================

/**
 * Create a minimal StateParameter for testing
 */
function createParameter(overrides: Partial<StateParameter> = {}): StateParameter {
  return {
    id: "test-param",
    name: "Test Parameter",
    category: "Test",
    description: "A test parameter",
    scaleType: "NUMERIC",
    min: 0,
    max: 10,
    currentValue: 5,
    responsibleAgentId: "test-agent",
    history: [],
    ...overrides,
  };
}

/**
 * Create a flat update for testing
 */
function createUpdate(
  id: string,
  newValue: string | number | boolean,
  reasoning = "Test reasoning"
): AggregateOutput["flatUpdates"][0] {
  return { id, newValue, reasoning, agentId: "agent-1" };
}

// =============================================================================
// TESTS: HYSTERESIS LOGIC
// =============================================================================

describe("applyStateUpdates", () => {
  describe("basic functionality", () => {
    it("should apply update when no hysteresis policy exists", () => {
      const params: StateParameter[] = [createParameter({ id: "mood", currentValue: 5 })];
      const updates: AggregateOutput["flatUpdates"] = [createUpdate("mood", 6)];

      const result = applyStateUpdates(params, updates);

      expect(result.changes).toHaveLength(1);
      expect(result.changes[0].oldValue).toBe(5);
      expect(result.changes[0].newValue).toBe(6);
      expect(result.updatedState[0].currentValue).toBe(6);
    });

    it("should skip update when value is unchanged", () => {
      const params: StateParameter[] = [createParameter({ id: "mood", currentValue: 5 })];
      const updates: AggregateOutput["flatUpdates"] = [createUpdate("mood", 5)];

      const result = applyStateUpdates(params, updates);

      expect(result.changes).toHaveLength(0);
      expect(result.updatedState[0].currentValue).toBe(5);
    });

    it("should handle parameters without updates", () => {
      const params: StateParameter[] = [
        createParameter({ id: "mood", currentValue: 5 }),
        createParameter({ id: "energy", currentValue: 7 }),
      ];
      const updates: AggregateOutput["flatUpdates"] = [createUpdate("mood", 6)];

      const result = applyStateUpdates(params, updates);

      expect(result.changes).toHaveLength(1);
      expect(result.updatedState[0].currentValue).toBe(6); // mood updated
      expect(result.updatedState[1].currentValue).toBe(7); // energy unchanged
    });

    it("should add update to history", () => {
      const params: StateParameter[] = [createParameter({ id: "mood", currentValue: 5, history: [] })];
      const updates: AggregateOutput["flatUpdates"] = [createUpdate("mood", 7, "User seemed happier")];

      const result = applyStateUpdates(params, updates);

      expect(result.updatedState[0].history).toHaveLength(1);
      expect(result.updatedState[0].history[0].value).toBe(7);
      expect(result.updatedState[0].history[0].reasoning).toBe("User seemed happier");
    });
  });

  describe("hysteresis threshold", () => {
    it("should apply update when change exceeds hysteresis threshold", () => {
      // With 0.2 hysteresis on a 0-10 range, need change >= 2 to exceed threshold
      const params: StateParameter[] = [
        createParameter({
          id: "mood",
          currentValue: 5,
          min: 0,
          max: 10,
          updatePolicy: { hysteresis: 0.2 },
        }),
      ];
      const updates: AggregateOutput["flatUpdates"] = [createUpdate("mood", 7)]; // delta = 2, ratio = 0.2

      const result = applyStateUpdates(params, updates);

      expect(result.changes).toHaveLength(1);
      expect(result.changes[0].newValue).toBe(7);
    });

    it("should skip update when change is below hysteresis threshold", () => {
      // With 0.2 hysteresis on a 0-10 range, change < 2 should be blocked
      const params: StateParameter[] = [
        createParameter({
          id: "mood",
          currentValue: 5,
          min: 0,
          max: 10,
          updatePolicy: { hysteresis: 0.2 },
        }),
      ];
      const updates: AggregateOutput["flatUpdates"] = [createUpdate("mood", 6)]; // delta = 1, ratio = 0.1

      const result = applyStateUpdates(params, updates);

      expect(result.changes).toHaveLength(0);
      expect(result.updatedState[0].currentValue).toBe(5); // unchanged
    });

    it("should allow all updates when hysteresis is 0", () => {
      const params: StateParameter[] = [
        createParameter({
          id: "mood",
          currentValue: 5,
          updatePolicy: { hysteresis: 0 },
        }),
      ];
      const updates: AggregateOutput["flatUpdates"] = [createUpdate("mood", 5.1)]; // tiny change

      const result = applyStateUpdates(params, updates);

      expect(result.changes).toHaveLength(1);
    });

    it("should only allow max-range changes when hysteresis is 1", () => {
      // With hysteresis = 1, only 100% of range change would be allowed
      const params: StateParameter[] = [
        createParameter({
          id: "mood",
          currentValue: 0,
          min: 0,
          max: 10,
          updatePolicy: { hysteresis: 1 },
        }),
      ];

      // 9 point change (90% of range) should be blocked
      const updates1: AggregateOutput["flatUpdates"] = [createUpdate("mood", 9)];
      const result1 = applyStateUpdates(params, updates1);
      expect(result1.changes).toHaveLength(0);

      // 10 point change (100% of range) should be allowed
      const updates2: AggregateOutput["flatUpdates"] = [createUpdate("mood", 10)];
      const result2 = applyStateUpdates(params, updates2);
      expect(result2.changes).toHaveLength(1);
    });
  });

  describe("edge cases - range handling", () => {
    it("should allow update when min equals max (range = 0)", () => {
      // This tests the division by zero fix
      const params: StateParameter[] = [
        createParameter({
          id: "fixed-value",
          currentValue: 5,
          min: 5,
          max: 5, // range = 0!
          updatePolicy: { hysteresis: 0.5 },
        }),
      ];
      const updates: AggregateOutput["flatUpdates"] = [createUpdate("fixed-value", 5)];

      // Should not throw, and since value is same, no change
      const result = applyStateUpdates(params, updates);
      expect(result.changes).toHaveLength(0);
    });

    it("should use defaults (0-10) when min/max not defined", () => {
      // With 0.2 hysteresis on default 0-10 range, need change >= 2
      const params: StateParameter[] = [
        createParameter({
          id: "mood",
          currentValue: 5,
          min: undefined,
          max: undefined,
          updatePolicy: { hysteresis: 0.2 },
        }),
      ];
      // delta = 1, ratio = 0.1 < 0.2 → blocked
      const updates: AggregateOutput["flatUpdates"] = [createUpdate("mood", 6)];

      const result = applyStateUpdates(params, updates);

      expect(result.changes).toHaveLength(0);
    });
  });

  describe("non-numeric parameters", () => {
    it("should always apply updates for CATEGORICAL parameters regardless of hysteresis", () => {
      const params: StateParameter[] = [
        createParameter({
          id: "expertise",
          scaleType: "CATEGORICAL",
          currentValue: "Beginner",
          options: ["Beginner", "Intermediate", "Advanced"],
          updatePolicy: { hysteresis: 0.9 }, // high hysteresis, but should be ignored
        }),
      ];
      const updates: AggregateOutput["flatUpdates"] = [createUpdate("expertise", "Intermediate")];

      const result = applyStateUpdates(params, updates);

      expect(result.changes).toHaveLength(1);
      expect(result.changes[0].newValue).toBe("Intermediate");
    });

    it("should always apply updates for BOOLEAN parameters regardless of hysteresis", () => {
      const params: StateParameter[] = [
        createParameter({
          id: "engaged",
          scaleType: "BOOLEAN",
          currentValue: false,
          updatePolicy: { hysteresis: 0.9 }, // high hysteresis, but should be ignored
        }),
      ];
      const updates: AggregateOutput["flatUpdates"] = [createUpdate("engaged", true)];

      const result = applyStateUpdates(params, updates);

      expect(result.changes).toHaveLength(1);
      expect(result.changes[0].newValue).toBe(true);
    });
  });

  describe("multiple parameters", () => {
    it("should process multiple parameters with different hysteresis settings", () => {
      const params: StateParameter[] = [
        createParameter({
          id: "mood",
          currentValue: 5,
          updatePolicy: { hysteresis: 0.1 }, // 10% threshold
        }),
        createParameter({
          id: "stress",
          currentValue: 5,
          updatePolicy: { hysteresis: 0.3 }, // 30% threshold
        }),
      ];
      const updates: AggregateOutput["flatUpdates"] = [
        createUpdate("mood", 6), // 10% change - should pass 10% threshold
        createUpdate("stress", 6), // 10% change - should fail 30% threshold
      ];

      const result = applyStateUpdates(params, updates);

      expect(result.changes).toHaveLength(1);
      expect(result.changes[0].parameterId).toBe("mood");
    });
  });
});
