import { describe, expect, it } from "vitest";

import { EdgeTypeEnum, NodeTypeEnum, type JourneyEdge, type JourneyNode } from "@/features/nodes/journey/react-flow-types";
import { generateEdgeId, generateNodeId, getConnectedEdges } from "../node-utils";

// Test helpers
const createTestNode = (id: string, type = NodeTypeEnum.MESSAGE): JourneyNode => ({
  id,
  type: "custom",
  position: { x: 0, y: 0 },
  data: { type, label: `Node ${id}`, content: "Test content" },
});

const createTestEdge = (id: string, source: string, target: string): JourneyEdge => ({
  id,
  source,
  target,
  edgeType: EdgeTypeEnum.DEFAULT,
});

describe("node-utils", () => {
  describe("generateNodeId", () => {
    it("should generate node-1 for empty array", () => {
      const id = generateNodeId([]);
      expect(id).toBe("node-1");
    });

    it("should generate unique ID avoiding existing IDs", () => {
      const existingNodes: JourneyNode[] = [createTestNode("node-1"), createTestNode("node-2")];
      const id = generateNodeId(existingNodes);
      expect(id).toBe("node-3");
    });

    it("should fill gaps in existing IDs", () => {
      const existingNodes: JourneyNode[] = [createTestNode("node-2"), createTestNode("node-3")];
      const id = generateNodeId(existingNodes);
      expect(id).toBe("node-1");
    });
  });

  describe("generateEdgeId", () => {
    it("should generate e1 for empty array", () => {
      const id = generateEdgeId([]);
      expect(id).toBe("e1");
    });

    it("should generate unique ID avoiding existing IDs", () => {
      const existingEdges: JourneyEdge[] = [createTestEdge("e1", "node-1", "node-2"), createTestEdge("e2", "node-2", "node-3")];
      const id = generateEdgeId(existingEdges);
      expect(id).toBe("e3");
    });

    it("should fill gaps in existing IDs", () => {
      const existingEdges: JourneyEdge[] = [createTestEdge("e2", "node-1", "node-2"), createTestEdge("e3", "node-2", "node-3")];
      const id = generateEdgeId(existingEdges);
      expect(id).toBe("e1");
    });
  });

  describe("getConnectedEdges", () => {
    it("should return all edges connected to a node", () => {
      const edges: JourneyEdge[] = [
        createTestEdge("e1", "node-1", "node-2"),
        createTestEdge("e2", "node-2", "node-3"),
        createTestEdge("e3", "node-4", "node-2"),
      ];
      const connected = getConnectedEdges(edges, "node-2");
      expect(connected).toHaveLength(3);
    });

    it("should return empty array if no edges connected", () => {
      const edges: JourneyEdge[] = [createTestEdge("e1", "node-1", "node-2")];
      const connected = getConnectedEdges(edges, "node-99");
      expect(connected).toHaveLength(0);
    });

    it("should include both incoming and outgoing edges", () => {
      const edges: JourneyEdge[] = [
        createTestEdge("e1", "node-1", "node-2"), // node-2 is target (incoming)
        createTestEdge("e2", "node-2", "node-3"), // node-2 is source (outgoing)
      ];
      const connected = getConnectedEdges(edges, "node-2");
      expect(connected).toHaveLength(2);
      expect(connected.map((e) => e.id)).toContain("e1");
      expect(connected.map((e) => e.id)).toContain("e2");
    });
  });

});
