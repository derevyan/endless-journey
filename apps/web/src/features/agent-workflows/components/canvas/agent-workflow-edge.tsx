/**
 * Custom Agent Workflow Edge
 *
 * Edge component with dynamic styling based on connection type.
 * - Different colors for different branch types (yes/no, passed/blocked, etc.)
 * - Selection highlighting with delete button
 * - Smooth animations
 *
 * @module features/agent-workflows/components/canvas/agent-workflow-edge
 */

import { memo, useCallback, useMemo } from "react";
import type { Edge, EdgeProps } from "@xyflow/react";
import { BaseEdge, EdgeLabelRenderer, getBezierPath } from "@xyflow/react";
import { Trash2 } from "lucide-react";
import {
  getWorkflowEdgeStyle,
  WORKFLOW_EDGE_SELECTED_STYLE,
  WORKFLOW_EDGE_VISITED_STYLE,
} from "@/features/nodes/workflow/config/workflow-theme";

// =============================================================================
// TYPES
// =============================================================================

interface WorkflowEdgeData extends Record<string, unknown> {
  onDelete?: (edgeId: string) => void;
  label?: string;
  isVisitedEdge?: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

export const AgentWorkflowEdge = memo(function AgentWorkflowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  sourceHandleId,
  style,
  markerEnd,
  selected,
  data,
}: EdgeProps<Edge<WorkflowEdgeData>>) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  // Get edge style based on source handle (yes/no, passed/blocked, etc.)
  // Priority: selected > visited > base style
  const edgeStyle = useMemo(() => {
    const baseStyle = getWorkflowEdgeStyle(sourceHandleId);

    // Selected takes priority (edit mode)
    if (selected) {
      return {
        ...style,
        ...baseStyle,
        ...WORKFLOW_EDGE_SELECTED_STYLE,
      };
    }

    // Visited edge (simulator mode)
    if (data?.isVisitedEdge) {
      return {
        ...style,
        ...WORKFLOW_EDGE_VISITED_STYLE,
        strokeDasharray: undefined, // solid line for visited
      };
    }

    // Default base style
    return {
      ...style,
      stroke: baseStyle.stroke,
      strokeWidth: baseStyle.strokeWidth,
      strokeDasharray: baseStyle.strokeDasharray,
    };
  }, [sourceHandleId, style, selected, data?.isVisitedEdge]);

  const onDelete = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      if (data?.onDelete) {
        data.onDelete(id);
      }
    },
    [id, data]
  );

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={edgeStyle} />
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: "all",
          }}
          className="nodrag nopan"
        >
          {/* Delete button - appears when selected with smooth animation */}
          <button
            onClick={onDelete}
            className={`bg-card/95 backdrop-blur-sm p-1 rounded-full shadow-lg border text-destructive hover:text-destructive/80 hover:scale-110 transition-all duration-150 ${
              selected ? "opacity-100 scale-100" : "opacity-0 scale-75 pointer-events-none"
            }`}
            title="Delete edge"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
});
