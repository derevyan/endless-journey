/**
 * Guard Node Component
 * @module features/nodes/workflow/definitions/guard/guard-node
 */

import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import type { GuardNodeConfig } from "@journey/schemas";
import { Shield } from "lucide-react";

import { BaseWorkflowNode } from "../../components/base-workflow-node";
import type { WorkflowCanvasNode } from "@/features/agent-workflows/stores/agent-workflow-store";
import { workflowNodeRegistry } from "../../registry/workflow-node-registry";
import { useValidatedNodeData } from "../../hooks/use-validated-node-data";

export const GuardNode = memo(function GuardNode({
  id,
  selected,
  data,
}: NodeProps<WorkflowCanvasNode>) {
  const config = useValidatedNodeData<GuardNodeConfig>("guard", data);
  const { isCurrentNode, isVisitedNode } = data as {
    isCurrentNode?: boolean;
    isVisitedNode?: boolean;
  };
  const definition = workflowNodeRegistry.get("guard");
  const outputHandles = definition?.handles.outputs ?? [];

  if (!config) {
    return (
      <BaseWorkflowNode
        id={id}
        selected={selected}
        isCurrentNode={isCurrentNode}
        isVisitedNode={isVisitedNode}
        icon={Shield}
        label="Invalid Guard"
        nodeType="guard"
        error="Node data validation failed"
      />
    );
  }

  const workerCount = config.workers?.length ?? 0;

  return (
    <BaseWorkflowNode
      id={id}
      selected={selected}
      isCurrentNode={isCurrentNode}
      isVisitedNode={isVisitedNode}
      icon={Shield}
      label="Guard"
      subtitle={`${workerCount} worker${workerCount !== 1 ? "s" : ""}`}
      nodeType="guard"
      sourceHandles={config.terminateOnBlock ? undefined : outputHandles}
      sourceHandleId={config.terminateOnBlock ? outputHandles[0]?.id : undefined}
    />
  );
});
