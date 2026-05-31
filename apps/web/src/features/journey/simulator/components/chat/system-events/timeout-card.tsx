/**
 * Timeout Card
 *
 * Displays timer expiration events.
 *
 * @module features/simulator/components/chat/system-events/timeout-card
 */

import { memo } from "react";
import { Timer } from "lucide-react";

import { EventCardBase } from "./event-card-base";
import type { SystemEventProps } from "./types";
import { formatDuration } from "./utils";

/**
 * Timeout event card
 */
export const TimeoutCard = memo(function TimeoutCard({ event, prevEvent, nodeMetadata }: SystemEventProps) {
  const payload = event.payload as { edgeId?: string; duration?: number; durationMs?: number } | undefined;
  const edgeId = payload?.edgeId;
  const durationMs = payload?.durationMs || payload?.duration;

  return (
    <EventCardBase
      icon={Timer}
      label="Timeout"
      variant="warning"
      nodeId={event.nodeId}
      nodeMetadata={nodeMetadata}
      timestamp={event.timestamp}
      prevTimestamp={prevEvent?.timestamp}
    >
      <div className="text-[11px] text-muted-foreground">
        Timer expired
        {durationMs && <span> after {formatDuration(durationMs)}</span>}
        {edgeId && <span className="font-mono"> • Edge: {edgeId}</span>}
      </div>
    </EventCardBase>
  );
});
