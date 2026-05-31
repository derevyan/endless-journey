/**
 * MessageNode Component
 *
 * Display content to user with optional buttons and timer.
 * This is the most versatile node type, handling:
 * - Simple messages
 * - Messages with buttons (decision points)
 * - Messages with timers (follow-ups)
 * - Messages waiting for text replies
 */

import { useNodeId } from "@xyflow/react";
import { Clock, Pause } from "lucide-react";
import { memo, useMemo } from "react";

import { NODE_LAYOUT, NODE_TYPOGRAPHY } from "../../config/node-theme";
import { getResponseTypeBadge } from "../../config/node-theme-response";
import { useNodePlugins } from "../../hooks/use-node-plugins";
import { formatDuration } from "../../logic/wait";
import type { MessageNodeData } from "@journey/schemas";
import { NodeTypeEnum } from "../../react-flow-types";
import { BaseNode } from "../../components/base-node";
import { ButtonStack } from "../../components/button-tab-handle";
import { NodeBadge } from "../../components/previews/node-badge";
import { NodeButtonsPreview } from "../../components/previews/node-buttons-preview";
import { NodeMediaPreview } from "../../components/previews/node-media-preview";
import { NodeTagsPreview } from "../../components/previews/node-tags-preview";

/**
 * MessageNode Props - Now focused on node data only.
 * Visualization state is derived from stores via BaseNode's useNodeVisualization hook.
 */
interface MessageNodeProps {
  data: MessageNodeData;
}

export const MessageNode = memo(function MessageNode({ data }: MessageNodeProps) {
  // Get node ID from React Flow context
  const nodeId = useNodeId() ?? "";

  // Get plugins attached to this node for addon rendering
  const plugins = useNodePlugins(nodeId);

  const hasTimer = data.timer && data.timer.seconds > 0;
  const hasDelay = data.delay && data.delay > 0;
  const hasButtons = data.buttons && data.buttons.length > 0;
  const effectiveResponseType = data.responseType || "auto";

  // Get buttons for ButtonStack when response type supports buttons (buttons or any)
  const stackButtons = useMemo(() => {
    if (!hasButtons) return undefined;
    if (effectiveResponseType !== "buttons" && effectiveResponseType !== "any") return undefined;
    return data.buttons!.map((btn) => ({
      id: btn.id,
      text: btn.text,
      targetNodeId: btn.targetNodeId,
    }));
  }, [hasButtons, effectiveResponseType, data.buttons]);

  const showButtonStack = stackButtons && stackButtons.length > 0;
  const responseTypeBadge = getResponseTypeBadge(effectiveResponseType);

  // Build badges array
  const badges = (
    <div className={`flex items-center ${NODE_LAYOUT.badge.gap}`}>
      {responseTypeBadge && (
        <NodeBadge
          className={responseTypeBadge.badgeColor}
          icon={responseTypeBadge.icon ? <responseTypeBadge.icon className={responseTypeBadge.iconSize} /> : null}
        >
          {responseTypeBadge.label}
        </NodeBadge>
      )}
      {hasDelay && (
        <NodeBadge className="bg-muted/50 text-muted-foreground" icon={<Pause className="size-3" />}>
          {data.delay}s
        </NodeBadge>
      )}
      {hasTimer && (
        <NodeBadge className="bg-accent text-accent-foreground" icon={<Clock className="size-3" />}>
          {formatDuration(data.timer!.seconds)}
        </NodeBadge>
      )}
    </div>
  );

  return (
    <BaseNode
      nodeType={NodeTypeEnum.MESSAGE}
      label={data.label}
      hasTimerHandle={hasTimer}
      hasVirtualHandle={false}
      hasOutputHandle={effectiveResponseType !== "buttons"}
      badges={badges}
      responseType={effectiveResponseType}
      pluginAddons={plugins}
    >
      {/* Media preview */}
      <NodeMediaPreview media={data.media} />

      {/* Content preview - preserves newlines, strips HTML tags for compact display */}
      {data.content && (
        <p className={`${NODE_TYPOGRAPHY.content} text-muted-foreground line-clamp-2 leading-relaxed whitespace-pre-wrap`}>
          {data.content.replace(/<[^>]*>/g, "")}
        </p>
      )}

      {/* Button stack - rendered BELOW content, flush against left edge with handles */}
      {showButtonStack && <ButtonStack buttons={stackButtons} />}

      {/* Button badges preview - only show when NOT using button stack (e.g., auto/text response types) */}
      {hasButtons && !showButtonStack && <NodeButtonsPreview buttons={data.buttons!} />}

      {/* Tags - show add tags from tagAction */}
      {data.tagAction?.tags?.add && data.tagAction.tags.add.length > 0 && (
        <NodeTagsPreview tags={data.tagAction.tags.add} />
      )}
    </BaseNode>
  );
});
