/**
 * NodeWrapper Component
 *
 * ReactFlow custom node wrapper that routes to the appropriate node component
 * based on the node type using the node registry.
 *
 * Simplified: Node components now receive only `data` prop.
 * Visualization state (selected, isEditMode, journey path) is derived
 * from stores via useNodeVisualization hook in BaseNode/WaitNode.
 */

import { memo } from "react";
import type { NodeProps } from "@xyflow/react";

import { nodeRegistry } from "@/features/nodes/journey/registry/node-registry";
import type { JourneyNode } from "@/features/nodes/journey/react-flow-types";

function NodeWrapperComponent({ data }: NodeProps<JourneyNode>) {
  // Get component from registry
  const Component = data?.type ? nodeRegistry.getComponent(data.type) : undefined;

  if (!Component) {
    // All nodes must have valid types - this should never happen
    return null;
  }

  // Node components only need data - visualization state is derived from stores via hooks
  return <Component data={data} />;
}

export const NodeWrapper = memo(NodeWrapperComponent);
