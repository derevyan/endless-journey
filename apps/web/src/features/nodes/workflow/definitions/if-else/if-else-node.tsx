/**
 * If/Else Node Component
 * @module features/nodes/workflow/definitions/if-else/if-else-node
 */

import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import type { IfElseNodeConfig } from "@journey/schemas";
import { GitBranch } from "lucide-react";

import { BaseWorkflowNode } from "../../components/base-workflow-node";
import type { WorkflowCanvasNode } from "@/features/agent-workflows/stores/agent-workflow-store";
import { useValidatedNodeData } from "../../hooks/use-validated-node-data";

export const IfElseNode = memo(function IfElseNode({
  id,
  selected,
  data,
}: NodeProps<WorkflowCanvasNode>) {
  const config = useValidatedNodeData<IfElseNodeConfig>("if_else", data);
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
        icon={GitBranch}
        label="Invalid If/Else"
        nodeType="if_else"
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
      icon={GitBranch}
      label="If/Else"
      subtitle={config.conditionType === "intent" ? "Intent detection" : "Expression"}
      nodeType="if_else"
    />
  );
});
