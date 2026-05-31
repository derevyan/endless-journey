/**
 * Teleport Card
 *
 * Displays teleport events showing journey change.
 *
 * @module features/simulator/components/chat/system-events/teleport-card
 */

import { memo } from "react";
import { Rocket } from "lucide-react";

import { EventCardBase } from "./event-card-base";
import type { SystemEventProps } from "./types";

/**
 * Teleport event card
 */
export const TeleportCard = memo(function TeleportCard({ event, prevEvent, nodeMetadata }: SystemEventProps) {
  const payload = event.payload as {
    fromJourneyId?: string;
    fromJourneyName?: string;
    toJourneyId?: string;
    toJourneyName?: string;
    toNodeId?: string;
    preserveContext?: boolean;
  } | undefined;

  const fromJourney = payload?.fromJourneyName || payload?.fromJourneyId || "current";
  const toJourney = payload?.toJourneyName || payload?.toJourneyId || "unknown";
  const toNode = payload?.toNodeId;
  const preserveContext = payload?.preserveContext;

  return (
    <EventCardBase
      icon={Rocket}
      label="Teleport"
      variant="info"
      nodeId={event.nodeId}
      nodeMetadata={nodeMetadata}
      timestamp={event.timestamp}
      prevTimestamp={prevEvent?.timestamp}
    >
      <div className="space-y-0.5 text-[11px]">
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground">Journey:</span>
          <span className="font-mono text-foreground/80">{fromJourney}</span>
          <span className="text-primary">→</span>
          <span className="font-mono text-foreground">{toJourney}</span>
        </div>
        {(toNode || preserveContext !== undefined) && (
          <div className="text-muted-foreground">
            {toNode && <span>Target: <span className="font-mono">{toNode}</span></span>}
            {toNode && preserveContext !== undefined && <span> • </span>}
            {preserveContext !== undefined && (
              <span>{preserveContext ? "preserving context" : "fresh context"}</span>
            )}
          </div>
        )}
      </div>
    </EventCardBase>
  );
});
