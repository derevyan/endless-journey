/**
 * Edge Label with Tooltip
 *
 * Displays edge labels with optional tooltip for truncated text.
 * Shows colored dot indicator based on edge type.
 */

import type { EdgeType } from "@journey/schemas";
import { memo } from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { cn } from "@/shared/lib/utils";

import { EDGE_STYLES, getEdgeLabelAccentColor } from "../config/node-theme";

interface EdgeLabelWithTooltipProps {
  label: string;
  maxChars?: number;
  className?: string;
  edgeType?: EdgeType;
}

function truncateLabel(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars - 1) + "…";
}

export const EdgeLabelWithTooltip = memo(function EdgeLabelWithTooltip({
  label,
  maxChars = 20,
  className,
  edgeType,
}: EdgeLabelWithTooltipProps) {
  const truncatedLabel = truncateLabel(label, maxChars);
  const isLabelTruncated = label.length > maxChars;

  const labelClasses = cn(
    EDGE_STYLES.label.base,
    EDGE_STYLES.label.text,
    EDGE_STYLES.label.decoration,
    "flex items-center",
    className
  );

  const dotIndicator = edgeType && (
    <span className={EDGE_STYLES.label.dot} style={{ backgroundColor: getEdgeLabelAccentColor(edgeType) }} />
  );

  if (!isLabelTruncated) {
    return (
      <div className={labelClasses}>
        {dotIndicator}
        {label}
      </div>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={cn(labelClasses, "cursor-default")}>
          {dotIndicator}
          {truncatedLabel}
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={4}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
});
