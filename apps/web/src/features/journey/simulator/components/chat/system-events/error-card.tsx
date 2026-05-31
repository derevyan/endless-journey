/**
 * Error Card
 *
 * Displays error events with code and message.
 *
 * @module features/simulator/components/chat/system-events/error-card
 */

import { memo } from "react";
import { AlertCircle } from "lucide-react";

import { EventCardBase } from "./event-card-base";
import type { SystemEventProps } from "./types";

/**
 * Error event card
 */
export const ErrorCard = memo(function ErrorCard({ event, prevEvent, nodeMetadata }: SystemEventProps) {
  const payload = event.payload as { code?: string; message?: string; error?: string } | undefined;
  const code = payload?.code;
  const message = payload?.message || payload?.error || "Unknown error";

  return (
    <EventCardBase
      icon={AlertCircle}
      label="Error"
      variant="error"
      nodeId={event.nodeId}
      nodeMetadata={nodeMetadata}
      timestamp={event.timestamp}
      prevTimestamp={prevEvent?.timestamp}
    >
      <div className="text-[11px]">
        {code && <span className="font-mono text-destructive mr-2">{code}</span>}
        <span className="text-foreground/80">{message}</span>
      </div>
    </EventCardBase>
  );
});
