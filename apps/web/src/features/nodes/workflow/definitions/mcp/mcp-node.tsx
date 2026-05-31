/**
 * MCP Node Component
 * @module features/nodes/workflow/definitions/mcp/mcp-node
 */

import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import type { MCPNodeConfig } from "@journey/schemas";
import { Plug } from "lucide-react";

import { BaseWorkflowNode } from "../../components/base-workflow-node";
import type { WorkflowCanvasNode } from "@/features/agent-workflows/stores/agent-workflow-store";
import { useValidatedNodeData } from "../../hooks/use-validated-node-data";

export const MCPNode = memo(function MCPNode({
  id,
  selected,
  data,
}: NodeProps<WorkflowCanvasNode>) {
  const config = useValidatedNodeData<MCPNodeConfig>("mcp", data);
  const { isCurrentNode, isVisitedNode } = data as {
    isCurrentNode?: boolean;
    isVisitedNode?: boolean;
  };

  if (!config) {
    return (
      <BaseWorkflowNode
        id={id}
        selected={selected}
        isCurrentNode={isCurrentNode}
        isVisitedNode={isVisitedNode}
        icon={Plug}
        label="Invalid MCP"
        nodeType="mcp"
        error="Node data validation failed"
      />
    );
  }

  return (
    <BaseWorkflowNode
      id={id}
      selected={selected}
      isCurrentNode={isCurrentNode}
      isVisitedNode={isVisitedNode}
      icon={Plug}
      label="MCP"
      subtitle={config.tool ? `${config.server}/${config.tool}` : "External tool"}
      nodeType="mcp"
    />
  );
});
