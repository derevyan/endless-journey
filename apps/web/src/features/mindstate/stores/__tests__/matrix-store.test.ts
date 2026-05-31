/**
 * Matrix Store - Unit Tests
 *
 * Tests for matrix view UI state management, selectors, and event bus integration.
 *
 * Run with: pnpm test:frontend apps/web/src/features/mindstate/stores/__tests__/matrix-store.test.ts
 */

import { describe, expect, it, beforeEach, afterEach } from "vitest";

import { storeEventBus } from "@/stores/store-event-bus";
import {
  matrixStore,
  matrixActions,
  matrixSelectors,
  cleanupMatrixStoreSubscriptions,
} from "../matrix-store";

describe("matrix-store", () => {
  beforeEach(() => {
    matrixActions.reset();
  });

  afterEach(() => {
    matrixActions.reset();
  });

  // ===========================================================================
  // UI State - Hover Actions
  // ===========================================================================

  describe("hover state", () => {
    it("sets hovered agent id", () => {
      matrixActions.setHoveredAgent("agent-1");

      expect(matrixStore.state.ui.hoveredAgentId).toBe("agent-1");
    });

    it("clears hovered agent when set to null", () => {
      matrixActions.setHoveredAgent("agent-1");
      matrixActions.setHoveredAgent(null);

      expect(matrixStore.state.ui.hoveredAgentId).toBeNull();
    });

    it("sets hovered parameter id", () => {
      matrixActions.setHoveredParameter("param-1");

      expect(matrixStore.state.ui.hoveredParameterId).toBe("param-1");
    });

    it("clears hovered parameter when set to null", () => {
      matrixActions.setHoveredParameter("param-1");
      matrixActions.setHoveredParameter(null);

      expect(matrixStore.state.ui.hoveredParameterId).toBeNull();
    });

    it("tracks agent and parameter hover independently", () => {
      matrixActions.setHoveredAgent("agent-1");
      matrixActions.setHoveredParameter("param-1");

      expect(matrixStore.state.ui.hoveredAgentId).toBe("agent-1");
      expect(matrixStore.state.ui.hoveredParameterId).toBe("param-1");

      matrixActions.setHoveredAgent(null);

      expect(matrixStore.state.ui.hoveredAgentId).toBeNull();
      expect(matrixStore.state.ui.hoveredParameterId).toBe("param-1");
    });
  });

  // ===========================================================================
  // Selectors
  // ===========================================================================

  describe("selectors", () => {
    it("hoveredAgentId returns current hovered agent", () => {
      matrixActions.setHoveredAgent("agent-2");

      expect(matrixSelectors.hoveredAgentId(matrixStore.state)).toBe("agent-2");
    });

    it("hoveredAgentId returns null when none hovered", () => {
      expect(matrixSelectors.hoveredAgentId(matrixStore.state)).toBeNull();
    });

    it("hoveredParameterId returns current hovered parameter", () => {
      matrixActions.setHoveredParameter("param-2");

      expect(matrixSelectors.hoveredParameterId(matrixStore.state)).toBe("param-2");
    });

    it("hoveredParameterId returns null when none hovered", () => {
      expect(matrixSelectors.hoveredParameterId(matrixStore.state)).toBeNull();
    });
  });

  // ===========================================================================
  // Reset Action
  // ===========================================================================

  describe("reset", () => {
    it("clears all UI state to initial values", () => {
      // Set some state
      matrixActions.setHoveredAgent("agent-1");
      matrixActions.setHoveredParameter("param-1");

      expect(matrixStore.state.ui.hoveredAgentId).toBe("agent-1");
      expect(matrixStore.state.ui.hoveredParameterId).toBe("param-1");

      // Reset
      matrixActions.reset();

      expect(matrixStore.state.ui.hoveredAgentId).toBeNull();
      expect(matrixStore.state.ui.hoveredParameterId).toBeNull();
    });
  });

  // ===========================================================================
  // Event Bus Integration
  // ===========================================================================

  describe("event bus integration", () => {
    it("resets on mindstate:builder:reset event", () => {
      matrixActions.setHoveredAgent("agent-1");
      matrixActions.setHoveredParameter("param-1");

      storeEventBus.emit({
        type: "mindstate:builder:reset",
        payload: {},
      });

      expect(matrixStore.state.ui.hoveredAgentId).toBeNull();
      expect(matrixStore.state.ui.hoveredParameterId).toBeNull();
    });

    it("resets on user:loggedOut event", () => {
      matrixActions.setHoveredAgent("agent-1");
      matrixActions.setHoveredParameter("param-1");

      storeEventBus.emit({
        type: "user:loggedOut",
        payload: {},
      });

      expect(matrixStore.state.ui.hoveredAgentId).toBeNull();
      expect(matrixStore.state.ui.hoveredParameterId).toBeNull();
    });
  });

  // ===========================================================================
  // Cleanup Function
  // ===========================================================================

  describe("cleanupMatrixStoreSubscriptions", () => {
    it("is callable without error", () => {
      // This verifies the cleanup function exists and can be called
      // Actual subscription cleanup is tested through HMR flow
      expect(() => cleanupMatrixStoreSubscriptions()).not.toThrow();
    });
  });
});
