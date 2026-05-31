/**
 * Node Defaults
 *
 * Utility functions for creating new nodes.
 * Default data is sourced from the node registry definitions.
 */

import { nodeRegistry } from "../registry/node-registry";
import type { JourneyNode, JourneyNodeWithMetadata, JourneyStepData, NodeType } from "../react-flow-types";
import { NodeTypeEnum } from "../react-flow-types";
import { generateNodeId } from "../utils/node-utils";

/**
 * Create default node data based on node type.
 * Uses the node registry for default data.
 */
export function createDefaultNodeData(type: NodeType): JourneyStepData {
  const defaultData = nodeRegistry.createDefaultData(type);
  if (defaultData) {
    return defaultData;
  }

  // Fallback for unknown types
  return {
    type: NodeTypeEnum.MESSAGE,
    schemaVersion: 2,
    contentFormat: "text",
    label: `New ${type}`,
    content: "",
  };
}

/**
 * Create a new node with metadata
 */
export function createNode(type: NodeType, existingNodes: JourneyNode[], position?: { x: number; y: number }): JourneyNodeWithMetadata {
  const id = generateNodeId(existingNodes);
  const now = new Date().toISOString();

  return {
    id,
    type: "custom",
    position: position || { x: 0, y: 0 },
    data: createDefaultNodeData(type),
    metadata: {
      createdAt: now,
      updatedAt: now,
      version: "1.0.0",
      status: "draft",
    },
  };
}
