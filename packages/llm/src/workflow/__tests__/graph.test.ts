/**
 * Graph Utilities Tests
 *
 * Tests for adjacency map building and node traversal.
 */

import { describe, it, expect } from "vitest";
import { buildAdjacencyMap, findNode, findNodeByType } from "../graph";
import type { WorkflowNode, WorkflowEdge } from "@journey/schemas";

describe("buildAdjacencyMap", () => {
  const nodes: WorkflowNode[] = [
    { id: "start", type: "start", position: { x: 0, y: 0 }, data: {} },
    { id: "guard-1", type: "guard", position: { x: 100, y: 0 }, data: { workers: ["safety"] } },
    { id: "agent-1", type: "agent", position: { x: 200, y: 0 }, data: { systemPrompt: "test", llm: { provider: "openai", model: "gpt-4" } } },
    { id: "if-1", type: "if_else", position: { x: 300, y: 0 }, data: { conditionType: "expression", condition: { left: "x", operator: "===", right: true } } },
    { id: "agent-yes", type: "agent", position: { x: 400, y: -50 }, data: { systemPrompt: "yes", llm: { provider: "openai", model: "gpt-4" } } },
    { id: "agent-no", type: "agent", position: { x: 400, y: 50 }, data: { systemPrompt: "no", llm: { provider: "openai", model: "gpt-4" } } },
    { id: "end", type: "end", position: { x: 500, y: 0 }, data: {} },
  ];

  const edges: WorkflowEdge[] = [
    { id: "e1", source: "start", target: "guard-1" },
    { id: "e2", source: "guard-1", target: "agent-1", sourceHandle: "passed" },
    { id: "e3", source: "agent-1", target: "if-1" },
    { id: "e4", source: "if-1", target: "agent-yes", sourceHandle: "yes" },
    { id: "e5", source: "if-1", target: "agent-no", sourceHandle: "no" },
    { id: "e6", source: "agent-yes", target: "end" },
    { id: "e7", source: "agent-no", target: "end" },
  ];

  it("builds adjacency map from nodes and edges", () => {
    const graph = buildAdjacencyMap(nodes, edges);

    // Verify start node has one outgoing edge
    const startEdges = graph.getOutgoing("start");
    expect(startEdges).toHaveLength(1);
    expect(startEdges[0].target).toBe("guard-1");
  });

  it("looks up edges by handle", () => {
    const graph = buildAdjacencyMap(nodes, edges);

    // Verify if-else branching
    const yesEdge = graph.getOutgoingByHandle("if-1", "yes");
    expect(yesEdge).toBeDefined();
    expect(yesEdge!.target).toBe("agent-yes");

    const noEdge = graph.getOutgoingByHandle("if-1", "no");
    expect(noEdge).toBeDefined();
    expect(noEdge!.target).toBe("agent-no");
  });

  it("uses 'default' handle when sourceHandle is undefined", () => {
    const graph = buildAdjacencyMap(nodes, edges);

    // start -> guard-1 has no sourceHandle, defaults to 'default'
    const defaultEdge = graph.getOutgoingByHandle("start", "default");
    expect(defaultEdge).toBeDefined();
    expect(defaultEdge!.target).toBe("guard-1");
  });

  it("returns undefined for non-existent handle", () => {
    const graph = buildAdjacencyMap(nodes, edges);

    const missingEdge = graph.getOutgoingByHandle("start", "nonexistent");
    expect(missingEdge).toBeUndefined();
  });

  it("tracks incoming edges", () => {
    const graph = buildAdjacencyMap(nodes, edges);

    // End node has two incoming edges
    const endIncoming = graph.getIncoming("end");
    expect(endIncoming).toHaveLength(2);
    expect(endIncoming.map((e) => e.source).sort()).toEqual(["agent-no", "agent-yes"]);
  });

  it("handles nodes with no edges", () => {
    const graph = buildAdjacencyMap(nodes, edges);

    const endOutgoing = graph.getOutgoing("end");
    expect(endOutgoing).toHaveLength(0);
  });
});

describe("findNode", () => {
  const nodes: WorkflowNode[] = [
    { id: "node-1", type: "start", position: { x: 0, y: 0 }, data: {} },
    { id: "node-2", type: "agent", position: { x: 100, y: 0 }, data: { systemPrompt: "test", llm: { provider: "openai", model: "gpt-4" } } },
    { id: "node-3", type: "end", position: { x: 200, y: 0 }, data: {} },
  ];

  it("finds node by ID", () => {
    const node = findNode(nodes, "node-2");
    expect(node).toBeDefined();
    expect(node!.type).toBe("agent");
  });

  it("returns undefined for non-existent ID", () => {
    const node = findNode(nodes, "nonexistent");
    expect(node).toBeUndefined();
  });
});

describe("findNodeByType", () => {
  const nodes: WorkflowNode[] = [
    { id: "start-1", type: "start", position: { x: 0, y: 0 }, data: {} },
    { id: "agent-1", type: "agent", position: { x: 100, y: 0 }, data: { systemPrompt: "test", llm: { provider: "openai", model: "gpt-4" } } },
    { id: "agent-2", type: "agent", position: { x: 200, y: 0 }, data: { systemPrompt: "test2", llm: { provider: "openai", model: "gpt-4" } } },
    { id: "end-1", type: "end", position: { x: 300, y: 0 }, data: {} },
  ];

  it("finds first node of given type", () => {
    const startNode = findNodeByType(nodes, "start");
    expect(startNode).toBeDefined();
    expect(startNode!.id).toBe("start-1");
  });

  it("returns first match when multiple nodes exist", () => {
    const agentNode = findNodeByType(nodes, "agent");
    expect(agentNode).toBeDefined();
    expect(agentNode!.id).toBe("agent-1"); // First agent
  });

  it("returns undefined for non-existent type", () => {
    const node = findNodeByType(nodes, "guard");
    expect(node).toBeUndefined();
  });
});
