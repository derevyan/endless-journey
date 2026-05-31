/**
 * Transform Node Component
 * @module features/nodes/workflow/definitions/transform/transform-node
 */

import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import type { TransformNodeConfig } from "@journey/schemas";
import { Wand2 } from "lucide-react";

import { BaseWorkflowNode } from "../../components/base-workflow-node";
import type { WorkflowCanvasNode } from "@/features/agent-workflows/stores/agent-workflow-store";
import { useValidatedNodeData } from "../../hooks/use-validated-node-data";

export const TransformNode = memo(function TransformNode({
  id,
  selected,
  data,
}: NodeProps<WorkflowCanvasNode>) {
  const config = useValidatedNodeData<TransformNodeConfig>("transform", data);
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
        icon={Wand2}
        label="Invalid Transform"
        nodeType="transform"
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
      icon={Wand2}
      label="Transform"
      subtitle={config.outputVariable ? `→ ${config.outputVariable}` : "Transform data"}
      nodeType="transform"
    />
  );
});
