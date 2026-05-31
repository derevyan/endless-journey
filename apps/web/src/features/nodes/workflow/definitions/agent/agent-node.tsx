import type { AgentNodeConfig } from "@journey/schemas";
import type { NodeProps } from "@xyflow/react";
import { Bot, Layers } from "lucide-react";
import { memo } from "react";

import { useModel } from "@/hooks/queries/use-models";
import { ProviderLogo } from "@/shared/components/provider-logo";

import type { WorkflowCanvasNode } from "@/features/agent-workflows/stores/agent-workflow-store";
import { BaseWorkflowNode } from "../../components/base-workflow-node";
import { useValidatedNodeData } from "../../hooks/use-validated-node-data";

export const AgentNode = memo(function AgentNode({
  id,
  selected,
  data,
}: NodeProps<WorkflowCanvasNode>) {
  const config = useValidatedNodeData<AgentNodeConfig>("agent", data);
  const { isCurrentNode, isVisitedNode } = data as {
    isCurrentNode?: boolean;
    isVisitedNode?: boolean;
  };

  // Fetch model details to get the provider
  // NOTE: Hook must be called before any early returns to satisfy Rules of Hooks
  const { data: model } = useModel(config?.llm?.model ?? "", !!config?.llm?.model);

  if (!config) {
    return (
      <BaseWorkflowNode
        id={id}
        selected={selected}
        isCurrentNode={isCurrentNode}
        isVisitedNode={isVisitedNode}
        icon={Bot}
        label="Invalid Agent"
        nodeType="agent"
        error="Node data validation failed"
      />
    );
  }

  const subtitle = config.name || "Agent";

  return (
    <BaseWorkflowNode
      id={id}
      selected={selected}
      isCurrentNode={isCurrentNode}
      isVisitedNode={isVisitedNode}
      icon={Bot}
      label="Agent"
      subtitle={subtitle}
      nodeType="agent"
    >
      {config.llm && (
        <div className="flex items-center gap-1.5 mt-1">
          {model?.provider ? (
            <ProviderLogo provider={model.provider} className="size-3" />
          ) : (
             <Layers className="size-3 text-muted-foreground" />
          )}
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-tight">
            {config.llm.model}
          </span>
        </div>
      )}
    </BaseWorkflowNode>
  );
});
