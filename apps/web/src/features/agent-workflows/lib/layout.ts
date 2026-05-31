/**
 * Workflow-Specific Layout Utilities
 *
 * Wraps the shared layout factory with Workflow-specific types and defaults.
 * Uses ELK (Eclipse Layout Kernel) as the primary layout engine with
 * Dagre as a synchronous fallback.
 *
 * @module features/agent-workflows/lib/layout
 */

import { createLayoutWrapper } from "@/shared/lib/ui/create-layout-wrapper";
import { buildDefaultDimensionMap } from "@/features/nodes/workflow/lib/node-dimensions";

import type { WorkflowCanvasNode, WorkflowCanvasEdge } from "../stores/agent-workflow-store";

// Re-export types for convenience
export type { NodeDimensions } from "@/features/nodes/workflow/lib/node-dimensions";

// Fallback dimensions for Dagre (used when ELK fails)
const WORKFLOW_NODE_WIDTH = 140;
const WORKFLOW_NODE_HEIGHT = 60;

/**
 * Workflow layout utilities - ELK with Dagre fallback.
 */
const layoutWrapper = createLayoutWrapper<WorkflowCanvasNode, WorkflowCanvasEdge>({
  loggerName: "workflow-layout",
  fallbackNodeWidth: WORKFLOW_NODE_WIDTH,
  fallbackNodeHeight: WORKFLOW_NODE_HEIGHT,
  defaultDirection: "LR",
  buildDefaultDimensionMap,
});

/**
 * Apply auto-layout to workflow nodes and edges using ELK.
 * Falls back to Dagre if ELK fails for any reason.
 */
export const getLayoutedElements = layoutWrapper.getLayoutedElements;

/**
 * Synchronous layout using Dagre only.
 * Use this when async is not possible or for quick fallback.
 */
export const getLayoutedElementsSync = layoutWrapper.getLayoutedElementsSync;

/**
 * Add React Flow handle positions to workflow nodes without changing their positions.
 * Use this when loading nodes that already have valid positions.
 */
export const addHandlePositions = layoutWrapper.addHandlePositions;
