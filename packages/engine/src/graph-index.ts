/**
 * Graph Index - Runtime O(1) Lookup for Journey Graphs
 *
 * Provides efficient node and edge lookups for journey execution.
 * Builds indexes from JourneyConfig for O(1) access patterns.
 *
 * Used by SessionEngine for:
 * - Node lookup by ID (getNode)
 * - Edge lookup by source node (getOutgoingEdges)
 * - Edge lookup by ID (getEdge)
 *
 * @module engine/graph-index
 */

import type { JourneyConfig, JourneyEdgeData, JourneyNodeData } from "@journey/schemas";

/**
 * GraphIndex - Runtime journey graph index
 *
 * @example
 * ```ts
 * const index = new GraphIndex(journeyConfig);
 * const startNode = index.getNode("start-1");
 * const edges = index.getOutgoingEdges("message-1");
 * ```
 */
export class GraphIndex {
  private readonly nodeById: Map<string, JourneyNodeData>;
  private readonly edgesBySource: Map<string, JourneyEdgeData[]>;
  private readonly edgeById: Map<string, JourneyEdgeData>;
  private readonly journey: JourneyConfig;

  constructor(journey: JourneyConfig) {
    this.journey = journey;
    this.nodeById = new Map();
    this.edgesBySource = new Map();
    this.edgeById = new Map();
    this.buildIndex();
  }

  /**
   * Get a node by ID
   * @returns Node data or undefined if not found
   */
  getNode(nodeId: string): JourneyNodeData | undefined {
    return this.nodeById.get(nodeId);
  }

  /**
   * Get all outgoing edges from a node
   * @returns Array of edges (empty if node has no outgoing edges)
   */
  getOutgoingEdges(nodeId: string): JourneyEdgeData[] {
    return this.edgesBySource.get(nodeId) ?? [];
  }

  /**
   * Get an edge by ID
   * @returns Edge data or undefined if not found
   */
  getEdge(edgeId: string): JourneyEdgeData | undefined {
    return this.edgeById.get(edgeId);
  }

  /**
   * Check if a node exists
   */
  hasNode(nodeId: string): boolean {
    return this.nodeById.has(nodeId);
  }

  /**
   * Check if an edge exists
   */
  hasEdge(edgeId: string): boolean {
    return this.edgeById.has(edgeId);
  }

  /**
   * Get all nodes in the journey
   */
  getAllNodes(): JourneyNodeData[] {
    return Array.from(this.nodeById.values());
  }

  /**
   * Get all edges in the journey
   */
  getAllEdges(): JourneyEdgeData[] {
    return Array.from(this.edgeById.values());
  }

  /**
   * Get node count
   */
  get nodeCount(): number {
    return this.nodeById.size;
  }

  /**
   * Get edge count
   */
  get edgeCount(): number {
    return this.edgeById.size;
  }

  /**
   * Get the underlying journey config
   */
  getJourney(): JourneyConfig {
    return this.journey;
  }

  /**
   * Build the graph index from journey config
   */
  private buildIndex(): void {
    // Index nodes by ID
    for (const node of this.journey.nodes) {
      this.nodeById.set(node.id, node);
    }

    // Index edges by source node and by ID
    for (const edge of this.journey.edges) {
      this.edgeById.set(edge.id, edge);

      const existing = this.edgesBySource.get(edge.source);
      if (existing) {
        existing.push(edge);
      } else {
        this.edgesBySource.set(edge.source, [edge]);
      }
    }
  }
}
