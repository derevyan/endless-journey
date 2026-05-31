/**
 * Drift Prevention Tests
 *
 * These tests ensure that related schemas and constants stay in sync.
 * They catch duplication drift between:
 * - InteractionEventTypes object and InteractionEventTypeSchema
 * - JourneyStatusValues and NodeMetadataSchema.status
 * - GuardVariableConditionSchema validation behavior
 */

import { describe, expect, it } from "vitest";

import { JourneyStatusValues } from "../common/status";
import { InteractionEventTypes, InteractionEventTypeValues } from "../events/event-types";
import { InteractionEventTypeSchema } from "../events/core";
import { GuardVariableConditionSchema, GuardVariableOperatorValues } from "../journey";
import { NodeMetadataSchema } from "../nodes/base";

describe("drift-prevention", () => {
  // ==========================================================================
  // INTERACTION EVENT TYPES
  // ==========================================================================

  describe("InteractionEventTypes alignment", () => {
    it("InteractionEventTypeValues should contain all InteractionEventTypes values", () => {
      const objectValues = Object.values(InteractionEventTypes);
      const arrayValues = InteractionEventTypeValues;

      expect(arrayValues).toEqual(expect.arrayContaining(objectValues));
      expect(objectValues).toEqual(expect.arrayContaining([...arrayValues]));
    });

    it("InteractionEventTypeSchema should accept all InteractionEventTypes values", () => {
      for (const eventType of Object.values(InteractionEventTypes)) {
        const result = InteractionEventTypeSchema.safeParse(eventType);
        expect(result.success, `Schema should accept "${eventType}"`).toBe(true);
      }
    });

    it("InteractionEventTypeSchema should reject invalid event types", () => {
      const result = InteractionEventTypeSchema.safeParse("invalid.event.type");
      expect(result.success).toBe(false);
    });
  });

  // ==========================================================================
  // JOURNEY STATUS
  // ==========================================================================

  describe("JourneyStatus alignment", () => {
    it("NodeMetadataSchema.status should accept all JourneyStatusValues", () => {
      for (const status of JourneyStatusValues) {
        const result = NodeMetadataSchema.shape.status.safeParse(status);
        expect(result.success, `NodeMetadataSchema.status should accept "${status}"`).toBe(true);
      }
    });

    it("NodeMetadataSchema.status should reject invalid status values", () => {
      const result = NodeMetadataSchema.shape.status.safeParse("invalid-status");
      expect(result.success).toBe(false);
    });

    it("JourneyStatusValues should match NodeMetadataSchema.status options", () => {
      // Get the options from the zod enum
      const schemaOptions = NodeMetadataSchema.shape.status.options;
      expect([...JourneyStatusValues].sort()).toEqual([...schemaOptions].sort());
    });
  });

  // ==========================================================================
  // GUARD VARIABLE CONDITIONS
  // ==========================================================================

  describe("GuardVariableConditionSchema validation", () => {
    const comparisonOperators = ["equals", "notEquals", "gt", "gte", "lt", "lte", "contains"] as const;

    it("should require value for comparison operators", () => {
      for (const operator of comparisonOperators) {
        // With value - should pass
        const withValue = GuardVariableConditionSchema.safeParse({
          key: "test",
          operator,
          value: "test-value",
        });
        expect(withValue.success, `"${operator}" with value should pass`).toBe(true);

        // Without value - should fail
        const withoutValue = GuardVariableConditionSchema.safeParse({
          key: "test",
          operator,
        });
        expect(withoutValue.success, `"${operator}" without value should fail`).toBe(false);
      }
    });

    it("should allow optional value for exists operator", () => {
      // With value
      const withValue = GuardVariableConditionSchema.safeParse({
        key: "test",
        operator: "exists",
        value: true,
      });
      expect(withValue.success).toBe(true);

      // Without value
      const withoutValue = GuardVariableConditionSchema.safeParse({
        key: "test",
        operator: "exists",
      });
      expect(withoutValue.success).toBe(true);
    });

    it("should cover all operators in GuardVariableOperatorValues", () => {
      const testedOperators = [...comparisonOperators, "exists"];
      expect(testedOperators.sort()).toEqual([...GuardVariableOperatorValues].sort());
    });
  });
});
