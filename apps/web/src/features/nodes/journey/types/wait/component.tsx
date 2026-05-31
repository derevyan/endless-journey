/**
 * WaitNode Component
 *
 * Pause the journey for a specified duration.
 * Distinct pill-shaped design with dashed border to suggest "pausing".
 *
 * Uses useNodeVisualization hook for visualization state (selected, isEditMode, journey path).
 */

import { Handle, Position, useNodeId } from "@xyflow/react";
import { Timer } from "lucide-react";
import { memo } from "react";

import { FOCUS_STYLES, HANDLE_STYLES, JOURNEY_STATES, TRANSITIONS, WAIT_NODE_STYLES } from "../../config/node-theme";
import { useNodeVisualization } from "../../hooks/use-node-visualization";
import { formatDuration } from "../../logic/wait";
import type { WaitNodeData } from "@journey/schemas";
import { getHandleVisibility } from "../../utils/node-styles";

interface WaitNodeProps {
  data: WaitNodeData;
}

export const WaitNode = memo(function WaitNode({ data }: WaitNodeProps) {
  const nodeId = useNodeId();
  const {
    isSelected: selected,
    isEditMode,
    isJourneyVisited,
    isJourneyCurrent,
    isJourneyDropped,
  } = useNodeVisualization(nodeId || "");

  const duration = data.duration?.seconds || 0;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Wait node: ${data.label}, duration ${formatDuration(duration)}`}
      className={`
        relative ${WAIT_NODE_STYLES.padding} ${WAIT_NODE_STYLES.shape} ${WAIT_NODE_STYLES.border}
        ${WAIT_NODE_STYLES.background} ${WAIT_NODE_STYLES.shadow}
        ${TRANSITIONS.default} ${FOCUS_STYLES.ring}
        ${selected ? `${WAIT_NODE_STYLES.colors.border.selected} ${WAIT_NODE_STYLES.colors.shadow.selected}` : `${WAIT_NODE_STYLES.colors.border.default} ${WAIT_NODE_STYLES.colors.border.hover}`}
        ${isJourneyVisited && !isJourneyCurrent ? JOURNEY_STATES.visited : ""}
        ${isJourneyCurrent ? JOURNEY_STATES.current : ""}
        ${isJourneyDropped ? JOURNEY_STATES.dropped : ""}
      `}
    >
      <Handle
        type="target"
        position={Position.Top}
        className={`${HANDLE_STYLES.size} ${WAIT_NODE_STYLES.colors.handle} ${HANDLE_STYLES.border} ${getHandleVisibility(isEditMode)}`}
      />

      <div className="flex items-center gap-2">
        <Timer className={`${WAIT_NODE_STYLES.icon.size} ${WAIT_NODE_STYLES.colors.icon}`} />
        <span className={WAIT_NODE_STYLES.label.size}>{formatDuration(duration)}</span>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        id="output"
        className={`${HANDLE_STYLES.size} ${WAIT_NODE_STYLES.colors.handle} ${HANDLE_STYLES.border} ${getHandleVisibility(isEditMode)}`}
      />
    </div>
  );
});
