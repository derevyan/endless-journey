/**
 * Base Workflow Node
 *
 * Base component for all workflow nodes with consistent styling.
 * Handles are color-coded for easy visual identification:
 * - Green: positive paths (yes, passed, approved)
 * - Red: negative paths (no, blocked, rejected)
 *
 * @module features/nodes/workflow/components/base-workflow-node
 */

import { memo, type ReactNode } from "react";

import { Handle, Position } from "@xyflow/react";
import type { WorkflowNodeType } from "@journey/schemas";
import { Loader2, type LucideIcon } from "lucide-react";

import { cn } from "@/shared/lib/utils";

import {
  getBranchingHandleClasses,
  getBranchingLabelClasses,
  getDefaultHandleClasses,
  getHandlePositioning,
  getWorkflowNodeDimensions,
  getWorkflowNodeTheme,
  WORKFLOW_STATES,
  WORKFLOW_VISUAL_CONSTANTS
} from "../config/workflow-theme";
import { workflowNodeRegistry } from "../registry/workflow-node-registry";

// =============================================================================
// TYPES
// =============================================================================

export interface BaseWorkflowNodeProps {
  /** Node ID */
  id: string;
  /** Whether the node is selected */
  selected?: boolean;
  /** Whether this is the currently executing node in simulator */
  isCurrentNode?: boolean;
  /** Whether this node has been executed (for path highlighting) */
  isVisitedNode?: boolean;
  /** Icon component */
  icon: LucideIcon;
  /** Node label/title */
  label: string;
  /** Optional subtitle */
  subtitle?: string;
  /** Node type for theme styling */
  nodeType: WorkflowNodeType;
  /** Whether to show source handle */
  showSourceHandle?: boolean;
  /** Whether to show target handle */
  showTargetHandle?: boolean;
  /** Override for default source handle ID */
  sourceHandleId?: string;
  /** Source handles (for branching nodes) */
  sourceHandles?: Array<{ id: string; label?: string; position?: "top" | "bottom" }>;
  /** Children content */
  children?: ReactNode;
  /** Optional error message */
  error?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export const BaseWorkflowNode = memo(function BaseWorkflowNode({
  id: _id,
  selected,
  isCurrentNode,
  isVisitedNode,
  icon: Icon,
  label,
  subtitle,
  nodeType,
  showSourceHandle,
  showTargetHandle,
  sourceHandleId,
  sourceHandles,
  children,
  error,
}: BaseWorkflowNodeProps) {
  const theme = getWorkflowNodeTheme(nodeType);
  const dimensions = getWorkflowNodeDimensions(nodeType);
  const definition = workflowNodeRegistry.get(nodeType);
  const handles = definition?.handles;
  const hasInputs = handles ? handles.inputs.length > 0 : true;
  const hasOutputs = handles ? handles.outputs.length > 0 : true;
  const resolvedShowTargetHandle = showTargetHandle ?? hasInputs;
  const resolvedShowSourceHandle = showSourceHandle ?? hasOutputs;
  const resolvedSourceHandles =
    sourceHandles && sourceHandles.length > 0
      ? sourceHandles
      : handles && handles.outputs.length > 1
        ? handles.outputs.map((handle) => ({
            id: handle.id,
            label: handle.label ?? handle.id,
          }))
        : undefined;
  const resolvedSourceHandleId =
    sourceHandleId ?? (handles && handles.outputs.length === 1 ? handles.outputs[0]?.id : undefined);

  // Priority: current > visited > selected
  const stateStyle = isCurrentNode ? WORKFLOW_STATES.current : isVisitedNode ? WORKFLOW_STATES.visited : selected ? theme.selected : undefined;

  const hasContent = Boolean(children || error);

  return (
    <div
      className={cn(
        "relative transform-gpu",
        WORKFLOW_VISUAL_CONSTANTS.transitions,
        WORKFLOW_VISUAL_CONSTANTS.hover,
        WORKFLOW_VISUAL_CONSTANTS.borderRadius,
        dimensions.minWidth,
        dimensions.maxWidth,
        theme.nodeBg,
        "backdrop-blur-md",
        WORKFLOW_VISUAL_CONSTANTS.shadow.premium,
        theme.border,
        stateStyle,
        (isCurrentNode || isVisitedNode || selected) && theme.glow,
      )}
    >
      {/* Target Handle (input) */}
      {resolvedShowTargetHandle && (
        <Handle
          type="target"
          position={Position.Left}
          className={getDefaultHandleClasses()}
        />
      )}

      {isCurrentNode && (
        <div className="absolute top-2 right-2 size-5 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 shadow-sm z-10">
          <Loader2 className="size-2.5 text-primary animate-spin" />
        </div>
      )}

      {/* Header */}
      <div
        className={cn(
          "flex items-center gap-3",
          dimensions.headerPadding,
          theme.header,
          hasContent ? "border-b border-border/40" : "",
          hasContent ? "rounded-t-2xl" : "rounded-2xl"
        )}
      >
        <div className={cn(WORKFLOW_VISUAL_CONSTANTS.header.iconWrapper, theme.iconBg)}>
          <Icon className={cn(dimensions.iconSize, theme.icon)} />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className={cn(WORKFLOW_VISUAL_CONSTANTS.header.fontSize, "text-foreground truncate")}>{label}</div>
          {subtitle && <div className={cn(WORKFLOW_VISUAL_CONSTANTS.header.subtitleSize, "truncate")}>{subtitle}</div>}
        </div>
      </div>

      {/* Content */}
      {hasContent && (
        <div className={cn(dimensions.padding, "text-[13px] leading-relaxed")}>
          {children}
          {error && <div className="mt-2 text-xs text-destructive">{error}</div>}
        </div>
      )}

      {/* Source Handles (output) */}
      {resolvedShowSourceHandle && !resolvedSourceHandles && (
        <Handle
          type="source"
          position={Position.Right}
          id={resolvedSourceHandleId}
          className={getDefaultHandleClasses()}
        />
      )}

      {/* Multiple source handles for branching nodes - color-coded */}
      {resolvedShowSourceHandle && resolvedSourceHandles && resolvedSourceHandles.length > 0 && (() => {
        const positioning = getHandlePositioning();
        return (
          <>
            {resolvedSourceHandles.map((handle, index) => {
              const topPercent = ((index + 1) / (resolvedSourceHandles.length + 1)) * 100;
              const topStyle = positioning.branchingVerticalOffset !== 0 
                ? `calc(${topPercent}% + ${positioning.branchingVerticalOffset}px)` 
                : `${topPercent}%`;

              return (
                <div key={handle.id}>
                  {/* Label positioned inside the node */}
                  <span 
                    className={getBranchingLabelClasses()}
                    style={{
                      top: topStyle,
                      transform: "translateY(-50%)",
                    }}
                  >
                    {handle.label ?? handle.id}
                  </span>
                  {/* Handle - positioned with configurable offset */}
                  <Handle
                    type="source"
                    position={Position.Right}
                    id={handle.id}
                    className={getBranchingHandleClasses(handle.id)}
                    style={{
                      top: topStyle,
                      right: positioning.branchingHandleOffset !== 0 ? `${-positioning.branchingHandleOffset}px` : undefined,
                    }}
                  />
                </div>
              );
            })}
          </>
        );
      })()}
    </div>
  );
});
