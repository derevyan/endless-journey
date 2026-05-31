import type { EdgeGuard, EdgeType } from "@journey/schemas";
import type { Edge, EdgeProps } from "@xyflow/react";
import { BaseEdge, EdgeLabelRenderer, getBezierPath, getSmoothStepPath, getStraightPath } from "@xyflow/react";
import { LifeBuoy, Shield, Trash2 } from "lucide-react";
import { memo, useCallback } from "react";

import { EDGE_STYLES, EDGE_SELECTED_STYLE, EDGE_LABEL_STACK_OFFSET } from "../config/node-theme";
import { ManagedEdgeId } from "../utils/edge-identity";
import { EdgeLabelWithTooltip } from "./edge-label-tooltip";

interface CustomEdgeData extends Record<string, unknown> {
  onDelete?: (edgeId: string) => void;
  onSelect?: (edgeId: string) => void; // Handler for edge selection (when clicking label)
  label?: string;
  siblingIndex?: number; // Index among edges from same source (for label offset)
  edgeType?: EdgeType; // Edge type for label accent styling
  // Smart Edge properties
  guard?: EdgeGuard; // Guard condition for this edge
  fallback?: boolean; // Is this a fallback edge?
}

// Base component that handles the common rendering logic
const CustomEdgeRenderer = memo(function CustomEdgeRenderer({
  id,
  style,
  markerEnd,
  data,
  label,
  selected,
  path,
  labelX,
  labelY,
}: EdgeProps<Edge<CustomEdgeData>> & {
  path: string;
  labelX: number;
  labelY: number;
}) {
  const onDelete = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      if (data?.onDelete) {
        data.onDelete(id);
      }
    },
    [id, data]
  );

  // Handle click on edge label to trigger selection
  const onLabelClick = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      if (data?.onSelect) {
        data.onSelect(id);
      }
    },
    [id, data]
  );

  // Determine what label to show - prefer data.label, then prop label
  const edgeLabel = data?.label || label;

  // Calculate vertical label offset for sibling stacking
  const siblingIndex = data?.siblingIndex ?? 0;
  const adjustedLabelY = labelY + siblingIndex * EDGE_LABEL_STACK_OFFSET;

  const isEditable = !ManagedEdgeId.is(id);

  // Smart Edge indicators
  const hasGuard = !!data?.guard;
  const isFallback = !!data?.fallback;
  const hasIndicators = hasGuard || isFallback;

  return (
    <>
      <BaseEdge
        path={path}
        markerEnd={markerEnd}
        style={{
          ...style,
          ...(selected ? EDGE_SELECTED_STYLE : {}),
        }}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px,${adjustedLabelY}px)`,
            pointerEvents: "all",
          }}
          className="nodrag nopan flex flex-col items-center gap-1"
          onClick={onLabelClick}
        >
          {/* Top row: indicators + label */}
          <div className="flex items-center gap-1">
            {/* Smart Edge indicators - show before label */}
            {hasIndicators && (
              <div className="flex items-center gap-0.5">
                {hasGuard && (
                  <span title={`Guard: ${data?.guard?.type ?? "unknown"}`}>
                    <Shield className="w-3 h-3 text-amber-500" />
                  </span>
                )}
                {isFallback && (
                  <span title="Fallback edge">
                    <LifeBuoy className="w-3 h-3 text-green-500" />
                  </span>
                )}
              </div>
            )}

            {/* Show label if it exists - with tooltip for truncated labels */}
            {edgeLabel && <EdgeLabelWithTooltip label={String(edgeLabel)} maxChars={22} edgeType={data?.edgeType} />}
          </div>

          {/* Bottom: delete button (smooth appear/disappear animation) */}
          {isEditable && (
            <button
              onClick={onDelete}
              className={`${EDGE_STYLES.deleteButton.base} ${EDGE_STYLES.deleteButton.colors} transition-all duration-150 ease-out ${
                selected
                  ? "opacity-100 scale-100 translate-y-0"
                  : "opacity-0 scale-75 -translate-y-1 pointer-events-none"
              }`}
              title="Delete edge"
              data-testid="edge-delete-button"
            >
              <Trash2 className={EDGE_STYLES.deleteButton.iconSize} />
            </button>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
});

// Bezier Edge (Default)
export const CustomEdge = memo(function CustomEdge(props: EdgeProps<Edge<CustomEdgeData>>) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    sourcePosition: props.sourcePosition,
    targetX: props.targetX,
    targetY: props.targetY,
    targetPosition: props.targetPosition,
  });

  return <CustomEdgeRenderer {...props} path={edgePath} labelX={labelX} labelY={labelY} />;
});

// Straight Edge
export const CustomStraightEdge = memo(function CustomStraightEdge(props: EdgeProps<Edge<CustomEdgeData>>) {
  const [edgePath, labelX, labelY] = getStraightPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    targetX: props.targetX,
    targetY: props.targetY,
  });

  return <CustomEdgeRenderer {...props} path={edgePath} labelX={labelX} labelY={labelY} />;
});

// Step Edge (SmoothStep with borderRadius 0)
export const CustomStepEdge = memo(function CustomStepEdge(props: EdgeProps<Edge<CustomEdgeData>>) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    sourcePosition: props.sourcePosition,
    targetX: props.targetX,
    targetY: props.targetY,
    targetPosition: props.targetPosition,
    borderRadius: 0,
  });

  return <CustomEdgeRenderer {...props} path={edgePath} labelX={labelX} labelY={labelY} />;
});

// SmoothStep Edge
export const CustomSmoothStepEdge = memo(function CustomSmoothStepEdge(props: EdgeProps<Edge<CustomEdgeData>>) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    sourcePosition: props.sourcePosition,
    targetX: props.targetX,
    targetY: props.targetY,
    targetPosition: props.targetPosition,
  });

  return <CustomEdgeRenderer {...props} path={edgePath} labelX={labelX} labelY={labelY} />;
});
