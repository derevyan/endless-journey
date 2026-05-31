/**
 * Journey-Specific Layout Utilities
 *
 * Wraps the shared layout factory with Journey-specific types and defaults.
 * Uses ELK (Eclipse Layout Kernel) as the primary layout engine with
 * Dagre as a synchronous fallback.
 *
 * @module features/journey/builder/lib/layout
 */

import { createLayoutWrapper } from "@/shared/lib/ui/create-layout-wrapper";
import type { JourneyEdge, JourneyNode } from "@/features/nodes/journey/react-flow-types";

import { buildDefaultDimensionMap } from "./node-dimensions";

// Re-export types for convenience
export type { NodeDimensions } from "./node-dimensions";

// Fallback dimensions for Dagre (used when ELK fails)
const JOURNEY_NODE_WIDTH = 260;
const JOURNEY_NODE_HEIGHT = 170;

/**
 * Journey layout utilities - ELK with Dagre fallback.
 */
const layoutWrapper = createLayoutWrapper<JourneyNode, JourneyEdge>({
  loggerName: "journey-layout",
  fallbackNodeWidth: JOURNEY_NODE_WIDTH,
  fallbackNodeHeight: JOURNEY_NODE_HEIGHT,
  defaultDirection: "TB",
  buildDefaultDimensionMap,
});

/**
 * Apply auto-layout to journey nodes and edges using ELK.
 * Falls back to Dagre if ELK fails for any reason.
 */
export const getLayoutedElements = layoutWrapper.getLayoutedElements;

/**
 * Synchronous layout using Dagre only.
 * Use this when async is not possible or for quick fallback.
 */
export const getLayoutedElementsSync = layoutWrapper.getLayoutedElementsSync;

/**
 * Add React Flow handle positions to journey nodes without changing their positions.
 * Use this when loading nodes that already have valid positions.
 */
export const addHandlePositions = layoutWrapper.addHandlePositions;
