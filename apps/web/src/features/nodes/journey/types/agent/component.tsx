/**
 * AgentNode Component
 *
 * Display AI agent that delegates to Agent Workflows.
 * Shows workflow reference and timeout configuration.
 * Supports plugins (like follow-up sequences).
 */

import { useNodeId } from "@xyflow/react";
import { Clock } from "lucide-react";
import { memo } from "react";

import { NODE_LAYOUT, NODE_TYPOGRAPHY } from "../../config/node-theme";
import { useNodePlugins } from "../../hooks/use-node-plugins";
import { formatDuration } from "../../logic/wait";
import type { AgentNodeData } from "@journey/schemas";
import { NodeTypeEnum } from "../../react-flow-types";
import { BaseNode } from "../../components/base-node";
import { NodeBadge } from "../../components/previews/node-badge";

interface AgentNodeProps {
  data: AgentNodeData;
}

export const AgentNode = memo(function AgentNode({ data }: AgentNodeProps) {
  // Get node ID from React Flow context
  const nodeId = useNodeId() ?? "";

  // Get plugins attached to this node for addon rendering
  const plugins = useNodePlugins(nodeId);

  const hasTimeout = data.timeout && data.timeout.seconds > 0;
  const hasWorkflow = !!data.workflowKey;

  // Build badges array
  const badges = (
    <div className={`flex flex-wrap items-center ${NODE_LAYOUT.badge.gap}`}>
      {/* Timeout badge */}
      {hasTimeout && (
        <NodeBadge className="bg-accent text-accent-foreground" icon={<Clock className="size-3" />}>
          {formatDuration(data.timeout!.seconds)}
        </NodeBadge>
      )}
    </div>
  );

  // Subtitle shows workflow reference
  const subtitle = hasWorkflow ? `Workflow: ${data.workflowKey}` : "No workflow selected";

  return (
    <BaseNode
      nodeType={NodeTypeEnum.AGENT}
      label={data.label}
      subtitle={subtitle}
      hasTimerHandle={hasTimeout}
      hasOutputHandle={true}
      badges={badges}
      pluginAddons={plugins}
    >
      {/* Workflow mode indicator */}
      <div className="flex items-center gap-2 mt-1">
        <div className={`size-1.5 rounded-full ${hasWorkflow ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-destructive animate-pulse"}`} />
        {hasWorkflow ? (
          <p className={`${NODE_TYPOGRAPHY.content} font-medium text-foreground/80`}>
            Multi-agent orchestrator active
          </p>
        ) : (
          <p className={`${NODE_TYPOGRAPHY.content} font-medium text-destructive/80`}>
            Configuration required
          </p>
        )}
      </div>

      {!hasWorkflow && (
        <p className={`${NODE_TYPOGRAPHY.metadata} mt-1 leading-tight`}>
          Select a workflow in the editor to define agent behavior
        </p>
      )}
    </BaseNode>
  );
});
