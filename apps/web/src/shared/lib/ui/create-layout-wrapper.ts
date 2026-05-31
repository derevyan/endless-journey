/**
 * Layout Wrapper Factory
 *
 * Creates feature-specific layout utilities that wrap ELK and Dagre.
 * Used by both Journey Builder and Agent Workflow Builder with their
 * specific node types and default dimensions.
 *
 * @module shared/lib/ui/create-layout-wrapper
 */

import { createLogger, serializeError } from "@journey/logger";
import type { Node, Edge } from "@xyflow/react";
import {
  getLayoutedElementsGeneric,
  addHandlePositionsGeneric,
  type LayoutOptions,
  type LayoutDirection,
} from "@/shared/lib/ui/layout";
import { getElkLayoutedElements } from "@/shared/lib/ui/elk-layout";
import type { NodeDimensions } from "@/shared/lib/ui/node-dimensions";

/**
 * Configuration for creating layout wrapper functions.
 */
export interface LayoutWrapperConfig {
  /** Logger name for debugging (e.g., "journey-layout", "workflow-layout") */
  loggerName: string;
  /** Fallback node width for Dagre when ELK fails */
  fallbackNodeWidth: number;
  /** Fallback node height for Dagre when ELK fails */
  fallbackNodeHeight: number;
  /** Default direction for handle positions (default: "TB") */
  defaultDirection?: LayoutDirection;
  /** Function to build default dimension map from nodes */
  buildDefaultDimensionMap: (nodes: Array<{ id: string; type?: string }>) => Map<string, NodeDimensions>;
}

/**
 * Layout wrapper functions returned by createLayoutWrapper.
 */
export interface LayoutWrapper<N extends Node, E extends Edge> {
  /**
   * Apply auto-layout using ELK with Dagre fallback.
   */
  getLayoutedElements: (
    nodes: N[],
    edges: E[],
    options?: LayoutOptions,
    nodeDimensions?: Map<string, NodeDimensions>
  ) => Promise<{ nodes: N[]; edges: E[] }>;

  /**
   * Synchronous layout using Dagre only.
   */
  getLayoutedElementsSync: (
    nodes: N[],
    edges: E[],
    options?: LayoutOptions
  ) => { nodes: N[]; edges: E[] };

  /**
   * Add handle positions without changing node positions.
   */
  addHandlePositions: (nodes: N[], direction?: LayoutDirection) => N[];
}

/**
 * Create layout wrapper functions for a specific node/edge type.
 *
 * @example
 * ```typescript
 * const { getLayoutedElements, getLayoutedElementsSync, addHandlePositions } =
 *   createLayoutWrapper<JourneyNode, JourneyEdge>({
 *     loggerName: "journey-layout",
 *     fallbackNodeWidth: 260,
 *     fallbackNodeHeight: 170,
 *     buildDefaultDimensionMap,
 *   });
 * ```
 */
export function createLayoutWrapper<N extends Node, E extends Edge>(
  config: LayoutWrapperConfig
): LayoutWrapper<N, E> {
  const log = createLogger(config.loggerName);
  const defaultDirection = config.defaultDirection ?? "TB";

  /**
   * Apply auto-layout using ELK with Dagre fallback.
   */
  async function getLayoutedElements(
    nodes: N[],
    edges: E[],
    options: LayoutOptions = {},
    nodeDimensions?: Map<string, NodeDimensions>
  ): Promise<{ nodes: N[]; edges: E[] }> {
    // Handle empty graph
    if (nodes.length === 0) {
      return { nodes, edges };
    }

    // Build dimension map from measured or type-based defaults
    const dims = nodeDimensions ?? config.buildDefaultDimensionMap(nodes);

    try {
      // Use ELK for superior layout
      const result = await getElkLayoutedElements(nodes, edges, dims, options);
      log.debug({ nodeCount: nodes.length, edgeCount: edges.length }, "layout:elkApplied");
      return result;
    } catch (error) {
      // Log warning and fall back to Dagre
      log.warn({ err: serializeError(error) }, "layout:elkFailed:usingDagreFallback");
      return getLayoutedElementsGeneric(nodes, edges, {
        ...options,
        nodeWidth: config.fallbackNodeWidth,
        nodeHeight: config.fallbackNodeHeight,
      });
    }
  }

  /**
   * Synchronous layout using Dagre only.
   */
  function getLayoutedElementsSync(
    nodes: N[],
    edges: E[],
    options: LayoutOptions = {}
  ): { nodes: N[]; edges: E[] } {
    return getLayoutedElementsGeneric(nodes, edges, {
      ...options,
      nodeWidth: config.fallbackNodeWidth,
      nodeHeight: config.fallbackNodeHeight,
    });
  }

  /**
   * Add handle positions without changing node positions.
   */
  function addHandlePositions(nodes: N[], direction: LayoutDirection = defaultDirection): N[] {
    return addHandlePositionsGeneric(nodes, direction);
  }

  return {
    getLayoutedElements,
    getLayoutedElementsSync,
    addHandlePositions,
  };
}
