/**
 * Event Handler Tests
 *
 * Tests for event pattern matching.
 */

import { describe, expect, it } from "vitest";

import { matchesEventPattern } from "../types";

describe("matchesEventPattern", () => {
  describe("namespace wildcard", () => {
    it("should match events with namespace wildcard", () => {
      expect(matchesEventPattern("crm.stage.changed", "crm.*")).toBe(true);
      expect(matchesEventPattern("crm.pipeline.created", "crm.*")).toBe(true);
      expect(matchesEventPattern("crm.client.updated", "crm.*")).toBe(true);
    });

    it("should not match events outside namespace", () => {
      expect(matchesEventPattern("journey.created", "crm.*")).toBe(false);
      expect(matchesEventPattern("tag.assigned", "crm.*")).toBe(false);
    });

    it("should not match partial namespace", () => {
      // "crm" without the dot should not match "crm.*"
      expect(matchesEventPattern("crm", "crm.*")).toBe(false);
    });

    it("should handle deeper namespaces", () => {
      expect(matchesEventPattern("journey.session.started", "journey.*")).toBe(true);
      expect(matchesEventPattern("journey.session.completed", "journey.*")).toBe(true);
    });
  });

});
