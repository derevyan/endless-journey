/**
 * Node and Edge Utilities
 *
 * Shared utilities for processing nodes and edges.
 * Used by both the editor (journey-nodes-store) and viewer (useJourney).
 */

import type { JourneyEdge, JourneyNode } from "../react-flow-types";

/**
 * Generate a unique node ID based on existing nodes
 */
export function generateNodeId(existingNodes: JourneyNode[]): string {
  const existingIds = new Set(existingNodes.map((n) => n.id));
  let counter = 1;
  let newId = `node-${counter}`;
  while (existingIds.has(newId)) {
    counter++;
    newId = `node-${counter}`;
  }
  return newId;
}

/**
 * Generate a unique edge ID based on existing edges
 */
export function generateEdgeId(existingEdges: JourneyEdge[]): string {
  const existingIds = new Set(existingEdges.map((e) => e.id));
  let counter = 1;
  let newId = `e${counter}`;
  while (existingIds.has(newId)) {
    counter++;
    newId = `e${counter}`;
  }
  return newId;
}

/**
 * Check if a node ID exists in the nodes array
 */
export function nodeExists(nodes: JourneyNode[], nodeId: string): boolean {
  return nodes.some((n) => n.id === nodeId);
}

/**
 * Check if an edge ID exists in the edges array
 */
export function edgeExists(edges: JourneyEdge[], edgeId: string): boolean {
  return edges.some((e) => e.id === edgeId);
}

/**
 * Find a node by ID
 */
export function findNodeById(nodes: JourneyNode[], nodeId: string): JourneyNode | undefined {
  return nodes.find((n) => n.id === nodeId);
}

/**
 * Find an edge by ID
 */
export function findEdgeById(edges: JourneyEdge[], edgeId: string): JourneyEdge | undefined {
  return edges.find((e) => e.id === edgeId);
}

/**
 * Get all edges connected to a node (both incoming and outgoing)
 */
export function getConnectedEdges(edges: JourneyEdge[], nodeId: string): JourneyEdge[] {
  return edges.filter((e) => e.source === nodeId || e.target === nodeId);
}

