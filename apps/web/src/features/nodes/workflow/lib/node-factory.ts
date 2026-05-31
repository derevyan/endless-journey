/**
 * Node Factory
 *
 * Factory functions for creating workflow nodes with default configurations.
 * Delegates to the workflow node registry for node type definitions.
 *
 * @module features/nodes/workflow/lib/node-factory
 */

import type { Node } from "@xyflow/react";
import type { WorkflowNode, WorkflowNodeType } from "@journey/schemas";
import { workflowNodeRegistry } from "../definitions";

/** Node as represented in React Flow (with position) */
export type WorkflowCanvasNode = Node<WorkflowNode["data"], WorkflowNodeType>;

/** Position for placing a new node */
export interface NodePosition {
  x: number;
  y: number;
}

const NODE_TYPE_NAME_OVERRIDES: Partial<Record<WorkflowNodeType, string>> = {
  user_approval: "Approval",
};

function getNodeLabel(type: WorkflowNodeType): string {
  return NODE_TYPE_NAME_OVERRIDES[type] ?? workflowNodeRegistry.get(type)?.displayName ?? type;
}

/**
 * Generate a unique name for a new node based on existing nodes.
 *
 * Naming pattern:
 * - First node of type: "Guard"
 * - Second node of type: "Guard-2"
 * - Third node of type: "Guard-3"
 *
 * @param type - The type of node being created
 * @param existingNodes - Current nodes on the canvas
 * @returns A unique, human-readable name
 */
export function generateNodeName(
  type: WorkflowNodeType,
  existingNodes: WorkflowCanvasNode[]
): string {
  const baseLabel = getNodeLabel(type);

  // Count existing nodes of this type
  const sameTypeCount = existingNodes.filter((n) => n.type === type).length;

  // First node gets just the label, subsequent get -2, -3, etc.
  return sameTypeCount === 0 ? baseLabel : `${baseLabel}-${sameTypeCount + 1}`;
}

/**
 * Generate a unique output variable name from a node name.
 *
 * Converts human-readable names to valid variable names:
 * - "Question" → "question_output"
 * - "Question-2" → "question_2_output"
 * - "Transform-3" → "transform_3_output"
 *
 * @param nodeName - The human-readable node name
 * @returns A valid, unique variable name
 */
export function generateOutputVariable(nodeName: string): string {
  return nodeName.toLowerCase().replace(/-/g, "_") + "_output";
}

/**
 * Get default data configuration for a node type.
 *
 * Delegates to the workflow node registry for node-specific defaults.
 *
 * @param type - The type of node
 * @param nodeName - Optional node name for generating unique output variables
 */
export function getDefaultNodeData(
  type: WorkflowNodeType,
  nodeName?: string
): WorkflowNode["data"] {
  // Get base defaults from registry
  const def = workflowNodeRegistry.get(type);
  const baseData = def?.createDefaultData() ?? {};

  // Apply unique output variable if node name is provided
  if (nodeName) {
    const outputVar = generateOutputVariable(nodeName);

    // Update output variable for node types that support it
    if (type === "transform" || type === "question_understanding") {
      return { ...baseData, outputVariable: outputVar };
    }
  }

  return baseData as WorkflowNode["data"];
}

/**
 * Create a new workflow node with default data.
 *
 * @param type - The type of node to create
 * @param id - Unique identifier for the node
 * @param position - Position on the canvas
 * @param name - Optional human-readable name for the node (also used for unique variable generation)
 */
export function createNode(
  type: WorkflowNodeType,
  id: string,
  position: NodePosition,
  name?: string
): WorkflowCanvasNode {
  // Pass name to getDefaultNodeData for unique output variable generation
  const data = getDefaultNodeData(type, name);
  // Add name to data if provided
  if (name) {
    (data as Record<string, unknown>).name = name;
  }
  return {
    id,
    type,
    position,
    data,
  };
}

/**
 * Generate a unique node ID.
 * Format: {type}_{timestamp}_{random}
 */
export function generateNodeId(type: WorkflowNodeType): string {
  return `${type}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Create a node with an auto-generated ID and name.
 *
 * @param type - The type of node to create
 * @param position - Position on the canvas
 * @param existingNodes - Current nodes on the canvas (for unique name generation)
 */
export function createNodeWithId(
  type: WorkflowNodeType,
  position: NodePosition,
  existingNodes: WorkflowCanvasNode[] = []
): WorkflowCanvasNode {
  const name = generateNodeName(type, existingNodes);
  return createNode(type, generateNodeId(type), position, name);
}
