/**
 * ButtonTabHandle Component
 *
 * Renders buttons as a vertical stack inside the node, flush against the left edge.
 * Each button has a React Flow Handle at its left edge for connections.
 *
 * Design:
 * - Buttons are INSIDE the node body
 * - Stacked vertically (one per row)
 * - Flush against left edge (no left padding)
 * - Connection handle at left edge where button meets node border
 * - Emerald green theme matching button response type
 */

import { Handle, Position } from "@xyflow/react";
import { memo } from "react";

import { cn } from "@/shared/lib/utils";

import { BUTTON_TAB_STYLES, HANDLE_STYLES } from "../config/node-theme";

export interface ButtonTabProps {
  button: {
    id: string;
    text: string;
    targetNodeId?: string;
  };
  index: number;
}

/**
 * Single button tab with handle at left edge
 */
export const ButtonTab = memo(function ButtonTab({ button, index: _index }: ButtonTabProps) {
  const isConnected = !!button.targetNodeId;

  return (
    <div
      className={cn(
        BUTTON_TAB_STYLES.tab.base,
        isConnected ? BUTTON_TAB_STYLES.tab.connected : BUTTON_TAB_STYLES.tab.disconnected
      )}
      title={button.text}
    >
      {/* Handle at left edge of button - always hidden, targets set via NodeSelectorPopover */}
      <Handle
        type="source"
        position={Position.Left}
        id={button.id}
        className={cn(BUTTON_TAB_STYLES.handle.base, HANDLE_STYLES.hidden)}
        style={{ top: "50%", left: 0, transform: "translate(-50%, -50%)" }}
      />

      {/* Button label */}
      <span className={BUTTON_TAB_STYLES.tab.label}>{button.text}</span>
    </div>
  );
});

export interface ButtonStackProps {
  buttons: Array<{ id: string; text: string; targetNodeId?: string }>;
}

/**
 * Vertical stack of button tabs inside node body.
 * Renders flush against the left edge with handles for connections.
 */
export const ButtonStack = memo(function ButtonStack({ buttons }: ButtonStackProps) {
  if (!buttons || buttons.length === 0) return null;

  return (
    <div className={BUTTON_TAB_STYLES.stack}>
      {buttons.map((button, index) => (
        <ButtonTab key={button.id} button={button} index={index} />
      ))}
    </div>
  );
});
