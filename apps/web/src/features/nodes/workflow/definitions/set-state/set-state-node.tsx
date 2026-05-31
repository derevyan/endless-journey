/**
 * Set State Node Component
 * @module features/nodes/workflow/definitions/set-state/set-state-node
 */

import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import type { SetStateNodeConfig } from "@journey/schemas";
import { Database } from "lucide-react";

import { BaseWorkflowNode } from "../../components/base-workflow-node";
import type { WorkflowCanvasNode } from "@/features/agent-workflows/stores/agent-workflow-store";
import { useValidatedNodeData } from "../../hooks/use-validated-node-data";

export const SetStateNode = memo(function SetStateNode({
  id,
  selected,
  data,
}: NodeProps<WorkflowCanvasNode>) {
  const config = useValidatedNodeData<SetStateNodeConfig>("set_state", data);
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
        icon={Database}
        label="Invalid Set State"
        nodeType="set_state"
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
      icon={Database}
      label="Set State"
      subtitle={config.key ? `${config.key}` : "Store variable"}
      nodeType="set_state"
    />
  );
});
