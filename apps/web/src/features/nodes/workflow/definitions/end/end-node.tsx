/**
 * End Node Component
 * @module features/nodes/workflow/definitions/end/end-node
 */

import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Square } from "lucide-react";

import { BaseWorkflowNode } from "../../components/base-workflow-node";
import type { WorkflowCanvasNode } from "@/features/agent-workflows/stores/agent-workflow-store";

export const EndNode = memo(function EndNode({
  id,
  selected,
  data,
}: NodeProps<WorkflowCanvasNode>) {
  const { isCurrentNode, isVisitedNode } = data as {
    isCurrentNode?: boolean;
    isVisitedNode?: boolean;
  };

  return (
    <BaseWorkflowNode
      id={id}
      selected={selected}
      isCurrentNode={isCurrentNode}
      isVisitedNode={isVisitedNode}
      icon={Square}
      label="End"
      subtitle="Send output"
      nodeType="end"
    />
  );
});
