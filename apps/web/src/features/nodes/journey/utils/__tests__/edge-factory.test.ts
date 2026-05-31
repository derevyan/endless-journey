import { describe, expect, it } from "vitest";

import { EdgeTypeEnum, type JourneyEdge } from "@/features/nodes/journey/react-flow-types";
import { createEdge } from "../edge-factory";

describe("edge-factory", () => {
  describe("createEdge", () => {
    it("should create edge with generated ID", () => {
      const existingEdges: JourneyEdge[] = [];
      const edge = createEdge("node-1", "node-2", existingEdges);

      expect(edge.id).toBe("e1");
      expect(edge.source).toBe("node-1");
      expect(edge.target).toBe("node-2");
    });

    it("should create edge with unique ID avoiding existing IDs", () => {
      const existingEdges: JourneyEdge[] = [{ id: "e1", source: "node-1", target: "node-2", edgeType: EdgeTypeEnum.DEFAULT }];
      const edge = createEdge("node-2", "node-3", existingEdges);

      expect(edge.id).toBe("e2");
    });

    it("should create edge with sourceHandle when provided", () => {
      const edge = createEdge("node-1", "node-2", [], undefined, EdgeTypeEnum.DEFAULT, "handle-1");
      expect(edge.sourceHandle).toBe("handle-1");
    });

    it("should set animated to false by default (animation controlled by UI settings)", () => {
      const edge = createEdge("node-1", "node-2", [], undefined, EdgeTypeEnum.DEFAULT);
      expect(edge.animated).toBe(false);
    });

    it("should set animated to false for timer edge type", () => {
      const edge = createEdge("node-1", "node-2", [], undefined, EdgeTypeEnum.TIMER);
      expect(edge.animated).toBe(false);
    });

    it("should set animated to false for dropoff edge type", () => {
      const edge = createEdge("node-1", "node-2", [], undefined, EdgeTypeEnum.DROPOFF);
      expect(edge.animated).toBe(false);
    });

    it("should apply success style for success edge type", () => {
      const edge = createEdge("node-1", "node-2", [], undefined, EdgeTypeEnum.SUCCESS);
      expect(edge.style?.stroke).toBe("#22c55e"); // Green color
    });

    it("should apply timer style with dashed stroke for timer edge type", () => {
      const edge = createEdge("node-1", "node-2", [], undefined, EdgeTypeEnum.TIMER);
      expect(edge.style?.stroke).toBe("#f97316"); // Orange color
      expect(edge.style?.strokeDasharray).toBeDefined();
    });
  });
});
