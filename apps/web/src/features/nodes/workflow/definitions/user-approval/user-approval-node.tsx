/**
 * User Approval Node Component
 * @module features/nodes/workflow/definitions/user-approval/user-approval-node
 */

import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import type { UserApprovalNodeConfig } from "@journey/schemas";
import { UserCheck } from "lucide-react";

import { BaseWorkflowNode } from "../../components/base-workflow-node";
import type { WorkflowCanvasNode } from "@/features/agent-workflows/stores/agent-workflow-store";
import { useValidatedNodeData } from "../../hooks/use-validated-node-data";

export const UserApprovalNode = memo(function UserApprovalNode({
  id,
  selected,
  data,
}: NodeProps<WorkflowCanvasNode>) {
  const config = useValidatedNodeData<UserApprovalNodeConfig>("user_approval", data);
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
        icon={UserCheck}
        label="Invalid User Approval"
        nodeType="user_approval"
        error="Node data validation failed"
      />
    );
  }

  const timeout = config.timeoutSeconds ?? 300;

  return (
    <BaseWorkflowNode
      id={id}
      selected={selected}
      isCurrentNode={isCurrentNode}
      isVisitedNode={isVisitedNode}
      icon={UserCheck}
      label="User Approval"
      subtitle={`${Math.round(timeout / 60)}min timeout`}
      nodeType="user_approval"
    />
  );
});
