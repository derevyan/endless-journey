/**
 * Event Card Base
 *
 * Base wrapper for system event cards with consistent styling.
 *
 * @module features/simulator/components/chat/system-events/event-card-base
 */

import type { LucideIcon } from "lucide-react";

import { cn } from "@/shared/lib/utils";

import { NodeMetadataBadge } from "./node-metadata-badge";
import { TimeDeltaBadge } from "./time-delta-badge";

interface EventCardBaseProps {
  /** Event type icon */
  icon: LucideIcon;
  /** Event type label */
  label: string;
  /** Color variant for the border and icon */
  variant?: "default" | "success" | "warning" | "error" | "info";
  /** Node ID */
  nodeId: string;
  /** Node metadata */
  nodeMetadata?: { type: string; label: string };
  /** Current timestamp */
  timestamp: string;
  /** Previous timestamp for delta */
  prevTimestamp?: string;
  /** Card content */
  children?: React.ReactNode;
  /** Additional class names */
  className?: string;
}

const VARIANT_STYLES = {
  default: "border-border/50 bg-muted/20",
  success: "border-success/30 bg-success/5",
  warning: "border-warning/30 bg-warning/5",
  error: "border-destructive/30 bg-destructive/5",
  info: "border-primary/30 bg-primary/5",
};

const ICON_STYLES = {
  default: "text-muted-foreground",
  success: "text-success",
  warning: "text-warning",
  error: "text-destructive",
  info: "text-primary",
};

/**
 * Base wrapper for system event cards
 */
export function EventCardBase({
  icon: Icon,
  label,
  variant = "default",
  nodeId,
  nodeMetadata,
  timestamp,
  prevTimestamp,
  children,
  className,
}: EventCardBaseProps) {
  return (
    <div
      className={cn(
        "mx-3 rounded-md border px-2.5 py-1.5 text-xs",
        VARIANT_STYLES[variant],
        className
      )}
    >
      {/* Header row */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Icon and label */}
        <div className={cn("flex items-center gap-1 font-medium", ICON_STYLES[variant])}>
          <Icon className="h-3 w-3" />
          <span>{label}</span>
        </div>

        {/* Node metadata badge */}
        <NodeMetadataBadge nodeId={nodeId} nodeMetadata={nodeMetadata} />

        {/* Time delta (pushed to right) */}
        <TimeDeltaBadge
          timestamp={timestamp}
          prevTimestamp={prevTimestamp}
          className="ml-auto"
        />
      </div>

      {/* Content */}
      {children && <div className="mt-1 text-foreground/80">{children}</div>}
    </div>
  );
}
