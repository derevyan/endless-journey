/**
 * Time Delta Badge
 *
 * Displays the time elapsed since the previous event.
 *
 * @module features/simulator/components/chat/system-events/time-delta-badge
 */

import { Clock } from "lucide-react";

import { cn } from "@/shared/lib/utils";

interface TimeDeltaBadgeProps {
  /** Current event timestamp */
  timestamp: string;
  /** Previous event timestamp */
  prevTimestamp?: string;
  /** Additional class names */
  className?: string;
}

/**
 * Format time delta between two timestamps
 */
export function formatTimeDelta(current: string, previous: string): string {
  const deltaMs = new Date(current).getTime() - new Date(previous).getTime();

  if (deltaMs < 0) return "";
  if (deltaMs < 1000) return `+${deltaMs}ms`;
  if (deltaMs < 60000) return `+${(deltaMs / 1000).toFixed(1)}s`;
  if (deltaMs < 3600000) {
    const mins = Math.floor(deltaMs / 60000);
    const secs = Math.floor((deltaMs % 60000) / 1000);
    return secs > 0 ? `+${mins}m ${secs}s` : `+${mins}m`;
  }
  const hours = Math.floor(deltaMs / 3600000);
  const mins = Math.floor((deltaMs % 3600000) / 60000);
  return mins > 0 ? `+${hours}h ${mins}m` : `+${hours}h`;
}

/**
 * Time delta badge component
 */
export function TimeDeltaBadge({ timestamp, prevTimestamp, className }: TimeDeltaBadgeProps) {
  if (!prevTimestamp) return null;

  const deltaMs = new Date(timestamp).getTime() - new Date(prevTimestamp).getTime();
  const delta = formatTimeDelta(timestamp, prevTimestamp);

  if (!delta) return null;

  // Highlight long waits (> 10 seconds)
  const isLongWait = deltaMs > 10000;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-[10px] font-mono tabular-nums",
        isLongWait ? "text-warning" : "text-muted-foreground/70",
        className
      )}
    >
      {isLongWait && <Clock className="h-2.5 w-2.5" />}
      {delta}
    </span>
  );
}
