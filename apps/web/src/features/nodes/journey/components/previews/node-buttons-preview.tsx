/**
 * NodeButtonsPreview Component
 *
 * Displays a truncated list of buttons for node previews.
 * Shows first N buttons with a "+X" indicator for overflow.
 */

import type { ButtonConfig } from "@journey/schemas";
import { memo } from "react";
import { BUTTON_PREVIEW, NODE_LAYOUT, NODE_TYPOGRAPHY } from "../../config/node-theme";

interface NodeButtonsPreviewProps {
  buttons: ButtonConfig[];
  maxVisible?: number;
}

/**
 * Extract display data from ButtonConfig
 */
function getButtonDisplay(btn: ButtonConfig): { id: string; text: string } {
  return { id: btn.id, text: btn.text };
}

export const NodeButtonsPreview = memo(function NodeButtonsPreview({ buttons, maxVisible = 3 }: NodeButtonsPreviewProps) {
  if (!buttons || buttons.length === 0) return null;

  return (
    <div className={`flex flex-wrap ${NODE_LAYOUT.badge.gap}`}>
      {buttons.slice(0, maxVisible).map((btn) => {
        const display = getButtonDisplay(btn);
        return (
          <span key={display.id} className={`${BUTTON_PREVIEW.base} ${BUTTON_PREVIEW.variant}`}>
            {display.text}
          </span>
        );
      })}
      {buttons.length > maxVisible && (
        <span className={`${NODE_TYPOGRAPHY.contentTiny} px-2 py-0.5 text-muted-foreground`}>+{buttons.length - maxVisible}</span>
      )}
    </div>
  );
});
