/**
 * Start Node Component
 *
 * Visual component for the workflow entry point node.
 * This is the simplest node - no configuration, just marks the start of execution.
 *
 * @module features/nodes/workflow/definitions/start/start-node
 */

import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Play } from "lucide-react";

import { BaseWorkflowNode } from "../../components/base-workflow-node";
import type { WorkflowCanvasNode } from "@/features/agent-workflows/stores/agent-workflow-store";

export const StartNode = memo(function StartNode({
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
      icon={Play}
      label="Start"
      subtitle="Entry point"
      nodeType="start"
    />
  );
});
