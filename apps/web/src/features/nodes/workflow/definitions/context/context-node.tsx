/**
 * Context Node Component
 * @module features/nodes/workflow/definitions/context/context-node
 */

import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import type { ContextNodeConfig } from "@journey/schemas";
import { BookOpen } from "lucide-react";

import { BaseWorkflowNode } from "../../components/base-workflow-node";
import type { WorkflowCanvasNode } from "@/features/agent-workflows/stores/agent-workflow-store";
import { useValidatedNodeData } from "../../hooks/use-validated-node-data";

export const ContextNode = memo(function ContextNode({
  id,
  selected,
  data,
}: NodeProps<WorkflowCanvasNode>) {
  const config = useValidatedNodeData<ContextNodeConfig>("context", data);
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
        icon={BookOpen}
        label="Invalid Context"
        nodeType="context"
        error="Node data validation failed"
      />
    );
  }

  const sourceCount = config.sources?.length ?? 0;

  return (
    <BaseWorkflowNode
      id={id}
      selected={selected}
      isCurrentNode={isCurrentNode}
      isVisitedNode={isVisitedNode}
      icon={BookOpen}
      label="Context"
      subtitle={`${sourceCount} source${sourceCount !== 1 ? "s" : ""}`}
      nodeType="context"
    />
  );
});
