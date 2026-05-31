/**
 * Truncated Select Trigger
 *
 * A wrapper around SelectTrigger that handles text truncation with optional tooltip
 * for long values. Ensures consistent truncation behavior across selectors.
 *
 * @module shared/components/ui/truncated-select-trigger
 */

import * as React from "react";
import { SelectTrigger, type SelectTriggerProps } from "./select";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";
import { cn } from "@/shared/lib/utils";

// =============================================================================
// TYPES
// =============================================================================

interface TruncatedSelectTriggerProps extends Omit<SelectTriggerProps, "children"> {
  /** Optional icon to display before the value */
  icon?: React.ReactNode;
  /** The text value to display (used for truncation check) */
  value?: string;
  /** Placeholder text when no value is provided */
  placeholder?: string;
  /** Character threshold for showing tooltip (default: 30) */
  tooltipThreshold?: number;
  /** Aria label for accessibility */
  ariaLabel?: string;
  /** The SelectValue content */
  children: React.ReactNode;
}

// =============================================================================
// COMPONENT
// =============================================================================

export const TruncatedSelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectTrigger>,
  TruncatedSelectTriggerProps
>(
  (
    {
      icon,
      value,
      placeholder,
      tooltipThreshold = 30,
      ariaLabel,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const shouldShowTooltip = value && value.length > tooltipThreshold;
    const resolvedAriaLabel = ariaLabel ?? placeholder;

    const triggerContent = (
      <SelectTrigger
        ref={ref}
        className={cn("overflow-hidden", className)}
        aria-label={resolvedAriaLabel}
        {...props}
      >
        <div className="flex items-center gap-2 min-w-0 overflow-hidden">
          {icon && <div className="shrink-0">{icon}</div>}
          <div className="min-w-0 flex-1 overflow-hidden truncate">{children}</div>
        </div>
      </SelectTrigger>
    );

    if (shouldShowTooltip) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>{triggerContent}</TooltipTrigger>
          <TooltipContent>
            <p>{value}</p>
          </TooltipContent>
        </Tooltip>
      );
    }

    return triggerContent;
  }
);

TruncatedSelectTrigger.displayName = "TruncatedSelectTrigger";
