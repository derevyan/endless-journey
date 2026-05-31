/**
 * Question Understanding Node Component
 * @module features/nodes/workflow/definitions/question-understanding/question-understanding-node
 */

import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import type { QuestionUnderstandingNodeConfig } from "@journey/schemas";
import { MessageCircleQuestion } from "lucide-react";

import { BaseWorkflowNode } from "../../components/base-workflow-node";
import type { WorkflowCanvasNode } from "@/features/agent-workflows/stores/agent-workflow-store";
import { useValidatedNodeData } from "../../hooks/use-validated-node-data";

export const QuestionUnderstandingNode = memo(function QuestionUnderstandingNode({
  id,
  selected,
  data,
}: NodeProps<WorkflowCanvasNode>) {
  const config = useValidatedNodeData<QuestionUnderstandingNodeConfig>("question_understanding", data);
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
        icon={MessageCircleQuestion}
        label="Invalid Question Understanding"
        nodeType="question_understanding"
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
      icon={MessageCircleQuestion}
      label="Question"
      subtitle={config.outputVariable ? `→ ${config.outputVariable}` : "Synthesize questions"}
      nodeType="question_understanding"
    />
  );
});
