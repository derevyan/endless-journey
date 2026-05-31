/**
 * Journey Validation Tests
 *
 * Tests for journey structure validation:
 * - Start/end node validation
 * - Edge reference validation
 * - Node reachability
 * - Cycle detection
 * - Branch coverage
 * - Timer edge validation
 *
 * @module engine/tests/validation
 */

import { describe, it, expect } from "vitest";
import type { JourneyConfig } from "@journey/schemas";
import {
  validateJourneyStructure,
  isValidJourney,
  getJourneyErrors,
  formatValidationResult,
  buildGraph,
  findOrphanNodes,
  findDeadEndNodes,
  detectJourneyCycles,
  hasDangerousCycle,
} from "../validation";
import {
  generateValidJourney,
  generateLinearJourney,
  generateBranchingJourney,
  generateInvalidJourney,
  generateEdgeCaseJourney,
  setGeneratorSeed,
} from "./generators";
import {
  linearJourney,
  buttonJourney,
  conditionJourney,
  messageWithTimerJourney,
  waitJourney,
  webhookJourney,
  noStartNodeJourney,
} from "./fixtures/journey-configs";

// Set seed for reproducible tests
setGeneratorSeed(12345);

describe("Journey Validation", () => {
  describe("validateJourneyStructure", () => {
    describe("valid journeys", () => {
      it("should validate simple linear journey", () => {
        const result = validateJourneyStructure(linearJourney);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it("should validate button journey", () => {
        const result = validateJourneyStructure(buttonJourney);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it("should validate condition journey", () => {
        const result = validateJourneyStructure(conditionJourney);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it("should validate wait journey", () => {
        const result = validateJourneyStructure(waitJourney);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it("should validate webhook journey", () => {
        const result = validateJourneyStructure(webhookJourney);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it("should validate message with timer journey", () => {
        const result = validateJourneyStructure(messageWithTimerJourney);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it("should validate generated valid journey", () => {
        const journey = generateValidJourney({ seed: 1 });
        const result = validateJourneyStructure(journey);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it("should validate minimal journey", () => {
        const journey = generateEdgeCaseJourney("minimal", 1);
        const result = validateJourneyStructure(journey);
        expect(result.valid).toBe(true);
      });

    });

    describe("invalid journeys", () => {
      it("should detect missing start node", () => {
        const result = validateJourneyStructure(noStartNodeJourney);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.code === "NO_START_NODE")).toBe(true);
      });

      it("should detect missing start using generator", () => {
        const journey = generateInvalidJourney("no_start", 1);
        const result = validateJourneyStructure(journey);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.code === "NO_START_NODE")).toBe(true);
      });

      it("should detect missing end node", () => {
        const journey = generateInvalidJourney("no_end", 1);
        const result = validateJourneyStructure(journey);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.code === "NO_END_NODE")).toBe(true);
      });

      it("should detect multiple start nodes", () => {
        const journey = generateInvalidJourney("multiple_starts", 1);
        const result = validateJourneyStructure(journey);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.code === "MULTIPLE_START_NODES")).toBe(true);
      });

      it("should detect dangling edge (invalid source)", () => {
        const journey = generateInvalidJourney("dangling_edge", 1);
        const result = validateJourneyStructure(journey);
        expect(result.valid).toBe(false);
        expect(
          result.errors.some(
            (e) => e.code === "DANGLING_EDGE_SOURCE" || e.code === "DANGLING_EDGE_TARGET"
          )
        ).toBe(true);
      });

      it("should detect orphan nodes", () => {
        const journey = generateInvalidJourney("orphan_node", 1);
        const result = validateJourneyStructure(journey);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.code === "ORPHAN_NODE")).toBe(true);
      });

      it("should detect auto-transition cycle", () => {
        const journey = generateInvalidJourney("auto_cycle", 1);
        const result = validateJourneyStructure(journey);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.code === "AUTO_TRANSITION_CYCLE")).toBe(true);
      });

      it("should detect missing condition branch edge", () => {
        const journey = generateInvalidJourney("missing_branch_edge", 1);
        const result = validateJourneyStructure(journey);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.code === "MISSING_CONDITION_BRANCH_EDGE")).toBe(true);
      });

      it("should detect missing timer edge", () => {
        const journey = generateInvalidJourney("missing_timer_edge", 1);
        const result = validateJourneyStructure(journey);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.code === "MISSING_TIMER_EDGE")).toBe(true);
      });

      it("should detect duplicate node IDs", () => {
        const journey = generateInvalidJourney("duplicate_node_id", 1);
        const result = validateJourneyStructure(journey);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.code === "DUPLICATE_NODE_ID")).toBe(true);
      });

      it("should detect duplicate edge IDs", () => {
        const journey = generateInvalidJourney("duplicate_edge_id", 1);
        const result = validateJourneyStructure(journey);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.code === "DUPLICATE_EDGE_ID")).toBe(true);
      });

      it("should detect reserved node_ prefix in node label", () => {
        // Journey with node labeled "node_internal" - collides with node output namespace
        const meta = { createdAt: "2025-01-01T00:00:00Z", updatedAt: "2025-01-01T00:00:00Z", version: "1.0.0", status: "active" as const };
        const journey: JourneyConfig = {
          nodes: [
            { id: "start", type: "custom" as const, position: { x: 0, y: 0 }, data: { type: "start" as const, schemaVersion: 1, label: "Start", content: "Hi" }, metadata: meta },
            { id: "msg", type: "custom" as const, position: { x: 0, y: 100 }, data: { type: "message", schemaVersion: 2, contentFormat: "text", label: "node_internal", content: "Test" }, metadata: meta },
            { id: "end", type: "custom" as const, position: { x: 0, y: 200 }, data: { type: "end" as const, schemaVersion: 1, label: "End" }, metadata: meta },
          ],
          edges: [
            { id: "e1", source: "start", target: "msg" },
            { id: "e2", source: "msg", target: "end" },
          ],
        };

        const result = validateJourneyStructure(journey);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.code === "RESERVED_NODE_LABEL_PREFIX")).toBe(true);

        const error = result.errors.find((e) => e.code === "RESERVED_NODE_LABEL_PREFIX");
        expect(error?.details?.reservedPrefix).toBe("node_");
      });
    });

    describe("warnings", () => {
      it("should warn about empty message content", () => {
        const journey = generateEdgeCaseJourney("empty_content", 1);
        const result = validateJourneyStructure(journey);
        expect(result.warnings.some((w) => w.code === "EMPTY_MESSAGE_CONTENT")).toBe(true);
      });

      it("should warn about missing default branch in condition", () => {
        const journey = generateBranchingJourney(3, { seed: 100 });
        // Manually remove the default flag
        const conditionNode = journey.nodes.find((n) => n.data.type === "condition");
        if (conditionNode && conditionNode.data.type === "condition") {
          conditionNode.data.branches = conditionNode.data.branches?.map((b) => ({
            ...b,
            isDefault: undefined,
          }));
        }
        const result = validateJourneyStructure(journey);
        expect(result.warnings.some((w) => w.code === "MISSING_DEFAULT_BRANCH")).toBe(true);
      });
    });

    describe("summary statistics", () => {
      it("should include correct node counts", () => {
        const result = validateJourneyStructure(linearJourney);
        expect(result.summary.totalNodes).toBe(3);
        expect(result.summary.totalEdges).toBe(2);
      });

      it("should detect timers", () => {
        const result = validateJourneyStructure(messageWithTimerJourney);
        expect(result.summary.hasTimers).toBe(true);
      });

      it("should detect conditions", () => {
        const result = validateJourneyStructure(conditionJourney);
        expect(result.summary.hasConditions).toBe(true);
      });

      it("should detect webhooks", () => {
        const result = validateJourneyStructure(webhookJourney);
        expect(result.summary.hasWebhooks).toBe(true);
      });

      it("should count node types correctly", () => {
        const result = validateJourneyStructure(conditionJourney);
        expect(result.summary.nodeTypes.start).toBe(1);
        expect(result.summary.nodeTypes.condition).toBe(1);
        expect(result.summary.nodeTypes.message).toBe(2);
        expect(result.summary.nodeTypes.end).toBe(1);
      });
    });
  });

  describe("isValidJourney", () => {
    it("should return true for valid journey", () => {
      expect(isValidJourney(linearJourney)).toBe(true);
    });

    it("should return false for invalid journey", () => {
      expect(isValidJourney(noStartNodeJourney)).toBe(false);
    });
  });

  describe("getJourneyErrors", () => {
    it("should return empty array for valid journey", () => {
      const errors = getJourneyErrors(linearJourney);
      expect(errors).toHaveLength(0);
    });

    it("should return errors for invalid journey", () => {
      const errors = getJourneyErrors(noStartNodeJourney);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe("formatValidationResult", () => {
    it("should format valid result", () => {
      const result = validateJourneyStructure(linearJourney);
      const formatted = formatValidationResult(result);
      expect(formatted).toContain("✅ Journey is valid");
    });

    it("should format invalid result with errors", () => {
      const result = validateJourneyStructure(noStartNodeJourney);
      const formatted = formatValidationResult(result);
      expect(formatted).toContain("❌ Journey has validation errors");
      expect(formatted).toContain("NO_START_NODE");
    });
  });
});

describe("Graph Utilities", () => {
  describe("buildGraph", () => {
    it("should build graph from journey config", () => {
      const graph = buildGraph(linearJourney);
      expect(graph.nodes.size).toBe(3);
      expect(graph.startNodeId).toBe("start");
      expect(graph.endNodeIds).toContain("end");
    });

    it("should index edges correctly", () => {
      const graph = buildGraph(linearJourney);
      const startEdges = graph.outEdges.get("start") || [];
      expect(startEdges.length).toBe(1);
      expect(startEdges[0].target).toBe("msg-1");
    });
  });

  describe("findOrphanNodes", () => {
    it("should find no orphans in valid journey", () => {
      const graph = buildGraph(linearJourney);
      const orphans = findOrphanNodes(graph);
      expect(orphans).toHaveLength(0);
    });

    it("should find orphan in invalid journey", () => {
      const journey = generateInvalidJourney("orphan_node", 1);
      const graph = buildGraph(journey);
      const orphans = findOrphanNodes(graph);
      expect(orphans.length).toBeGreaterThan(0);
    });
  });

  describe("findDeadEndNodes", () => {
    it("should find no dead ends in valid journey", () => {
      const graph = buildGraph(linearJourney);
      const deadEnds = findDeadEndNodes(graph);
      expect(deadEnds).toHaveLength(0);
    });
  });

  describe("detectJourneyCycles", () => {
    it("should find no cycles in linear journey", () => {
      const graph = buildGraph(linearJourney);
      const cycles = detectJourneyCycles(graph);
      expect(cycles).toHaveLength(0);
    });

    it("should detect auto-transition cycle", () => {
      const journey = generateInvalidJourney("auto_cycle", 1);
      const graph = buildGraph(journey);
      const cycles = detectJourneyCycles(graph);
      expect(cycles.length).toBeGreaterThan(0);
      expect(cycles.some((c) => c.isAutoTransitionCycle)).toBe(true);
    });
  });

  describe("hasDangerousCycle", () => {
    it("should return false for valid journey", () => {
      const graph = buildGraph(linearJourney);
      expect(hasDangerousCycle(graph)).toBe(false);
    });

    it("should return true for journey with auto-cycle", () => {
      const journey = generateInvalidJourney("auto_cycle", 1);
      const graph = buildGraph(journey);
      expect(hasDangerousCycle(graph)).toBe(true);
    });
  });
});

describe("Edge Case Journeys", () => {
  it("minimal journey should be valid", () => {
    const journey = generateEdgeCaseJourney("minimal", 1);
    expect(isValidJourney(journey)).toBe(true);
    expect(journey.nodes.length).toBe(2); // Only start and end
  });

  it("long linear journey should be valid", () => {
    const journey = generateEdgeCaseJourney("linear_long", 1);
    expect(isValidJourney(journey)).toBe(true);
    expect(journey.nodes.length).toBeGreaterThan(50);
  });

  it("wide branching journey should be valid", () => {
    const journey = generateEdgeCaseJourney("wide_branch", 1);
    expect(isValidJourney(journey)).toBe(true);
  });

  it("all-auto journey should be valid", () => {
    const journey = generateEdgeCaseJourney("all_auto", 1);
    expect(isValidJourney(journey)).toBe(true);
  });

  it("all-interactive journey should be valid", () => {
    const journey = generateEdgeCaseJourney("all_interactive", 1);
    expect(isValidJourney(journey)).toBe(true);
  });

  it("max buttons journey should be valid", () => {
    const journey = generateEdgeCaseJourney("max_buttons", 1);
    expect(isValidJourney(journey)).toBe(true);
    // Find the message node and check button count
    const msgNode = journey.nodes.find((n) => n.data.type === "message");
    expect(msgNode?.data.type === "message" && msgNode.data.buttons?.length).toBe(10);
  });

  it("long timer journey should be valid", () => {
    const journey = generateEdgeCaseJourney("long_timer", 1);
    expect(isValidJourney(journey)).toBe(true);
    // Find the wait node and check duration
    const waitNode = journey.nodes.find((n) => n.data.type === "wait");
    expect(waitNode?.data.type === "wait" && waitNode.data.duration.seconds).toBe(86400);
  });

  it("many webhooks journey should be valid", () => {
    const journey = generateEdgeCaseJourney("many_webhooks", 1);
    expect(isValidJourney(journey)).toBe(true);
    const webhookCount = journey.nodes.filter((n) => n.data.type === "webhook").length;
    expect(webhookCount).toBe(10);
  });
});

describe("Generated Journey Validation", () => {
  it("should generate multiple valid journeys", () => {
    for (let i = 0; i < 20; i++) {
      const journey = generateValidJourney({ seed: i * 100 });
      const result = validateJourneyStructure(journey);
      expect(result.valid).toBe(true);
    }
  });

  it("should generate valid linear journeys of various sizes", () => {
    for (const size of [1, 5, 10, 20, 50]) {
      const journey = generateLinearJourney(size, { seed: size });
      expect(isValidJourney(journey)).toBe(true);
      expect(journey.nodes.length).toBe(size + 2); // +2 for start and end
    }
  });

  it("should generate valid branching journeys", () => {
    for (const branches of [2, 3, 5, 8]) {
      const journey = generateBranchingJourney(branches, { seed: branches });
      expect(isValidJourney(journey)).toBe(true);
    }
  });
});
