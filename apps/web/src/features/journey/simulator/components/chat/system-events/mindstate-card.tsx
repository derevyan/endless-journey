/**
 * Mindstate Card
 *
 * Displays mindstate analysis changes.
 *
 * @module features/simulator/components/chat/system-events/mindstate-card
 */

import { memo } from "react";
import { Brain } from "lucide-react";

import { EventCardBase } from "./event-card-base";
import type { SystemEventProps } from "./types";
import { formatValue } from "./utils";

interface MindstateChange {
  parameter: string;
  from?: unknown;
  to?: unknown;
}

/**
 * Mindstate event card
 */
export const MindstateCard = memo(function MindstateCard({ event, prevEvent, nodeMetadata }: SystemEventProps) {
  const payload = event.payload as {
    mindstateKey?: string;
    key?: string;
    changes?: MindstateChange[];
    changesCount?: number;
  } | undefined;

  const key = payload?.mindstateKey || payload?.key || "mindstate";
  const changes = payload?.changes || [];
  const changesCount = payload?.changesCount || changes.length;

  return (
    <EventCardBase
      icon={Brain}
      label="Mindstate"
      variant="info"
      nodeId={event.nodeId}
      nodeMetadata={nodeMetadata}
      timestamp={event.timestamp}
      prevTimestamp={prevEvent?.timestamp}
    >
      <div className="space-y-0.5 text-[11px]">
        <div className="flex items-center gap-2">
          <span className="font-mono text-foreground">{key}</span>
          {changesCount > 0 && (
            <span className="text-muted-foreground">• {changesCount} change{changesCount > 1 ? "s" : ""}</span>
          )}
        </div>
        {changes.length > 0 && (
          <div className="space-y-0.5 pl-2 border-l border-border/50">
            {changes.slice(0, 5).map((change) => (
              <div key={`${change.parameter}-${String(change.from)}-${String(change.to)}`} className="font-mono text-[10px]">
                <span className="text-muted-foreground">{change.parameter}:</span>{" "}
                <span className="text-foreground/50">{formatValue(change.from)}</span>
                <span className="text-primary mx-1">→</span>
                <span className="text-foreground/80">{formatValue(change.to)}</span>
              </div>
            ))}
            {changes.length > 5 && (
              <div className="text-[10px] text-muted-foreground">
                ...and {changes.length - 5} more
              </div>
            )}
          </div>
        )}
      </div>
    </EventCardBase>
  );
});
