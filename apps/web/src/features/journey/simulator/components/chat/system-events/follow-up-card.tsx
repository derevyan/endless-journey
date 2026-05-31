/**
 * Follow-up Card
 *
 * Displays follow-up sequence events (system.followup).
 * Uses payload.action to differentiate between event subtypes:
 * - "scheduled" - timer scheduled for next follow-up step
 * - "sent" - follow-up message was sent
 * - "cancelled" - sequence cancelled (user responded)
 *
 * @module features/simulator/components/chat/system-events/follow-up-card
 */

import { memo } from "react";
import { Bell, BellOff, BellRing } from "lucide-react";

import { EventCardBase } from "./event-card-base";
import type { SystemEventProps } from "./types";
import { formatDuration } from "./utils";

// Payload types for different follow-up actions
interface FollowUpScheduledPayload {
  action: "scheduled";
  stepIndex: number;
  totalSteps: number;
  delayMs: number;
  timerId?: string;
}

interface FollowUpSentPayload {
  action: "sent";
  stepIndex: number;
  totalSteps: number;
  content?: string;
  hasButtons?: boolean;
}

interface FollowUpCancelledPayload {
  action: "cancelled";
  reason: "user_response" | "button_click" | "manual";
  cancelledSteps?: number;
}

type FollowUpPayload = FollowUpScheduledPayload | FollowUpSentPayload | FollowUpCancelledPayload | { action?: string };

/**
 * Follow-up event card
 * Routes to correct sub-card based on payload.action
 */
export const FollowUpCard = memo(function FollowUpCard({
  event,
  prevEvent,
  nodeMetadata,
}: SystemEventProps) {
  const payload = (event.payload || {}) as FollowUpPayload;
  const action = payload.action || "scheduled";

  switch (action) {
    case "scheduled": {
      const p = payload as FollowUpScheduledPayload;
      const stepIndex = p.stepIndex ?? 0;
      const totalSteps = p.totalSteps ?? 1;
      const delayMs = p.delayMs;

      return (
        <EventCardBase
          icon={Bell}
          label="Follow-up Scheduled"
          variant="info"
          nodeId={event.nodeId}
          nodeMetadata={nodeMetadata}
          timestamp={event.timestamp}
          prevTimestamp={prevEvent?.timestamp}
        >
          <div className="text-[11px] text-muted-foreground">
            Step {stepIndex + 1}/{totalSteps} scheduled
            {delayMs && <span> in {formatDuration(delayMs)}</span>}
          </div>
        </EventCardBase>
      );
    }

    case "sent": {
      const p = payload as FollowUpSentPayload;
      const stepIndex = p.stepIndex ?? 0;
      const totalSteps = p.totalSteps ?? 1;
      const content = p.content;
      const hasButtons = p.hasButtons;

      return (
        <EventCardBase
          icon={BellRing}
          label="Follow-up Sent"
          variant="warning"
          nodeId={event.nodeId}
          nodeMetadata={nodeMetadata}
          timestamp={event.timestamp}
          prevTimestamp={prevEvent?.timestamp}
        >
          <div className="text-[11px] text-muted-foreground space-y-0.5">
            <div>
              Follow-up {stepIndex + 1}/{totalSteps} delivered
              {hasButtons && <span> • with buttons</span>}
            </div>
            {content && (
              <div className="truncate max-w-[200px] opacity-70">
                "{content.slice(0, 50)}{content.length > 50 ? "..." : ""}"
              </div>
            )}
          </div>
        </EventCardBase>
      );
    }

    case "cancelled": {
      const p = payload as FollowUpCancelledPayload;
      const reason = p.reason ?? "user_response";
      const cancelledSteps = p.cancelledSteps ?? 0;

      const reasonText = {
        user_response: "user replied",
        button_click: "button clicked",
        manual: "manually cancelled",
      }[reason] || reason;

      return (
        <EventCardBase
          icon={BellOff}
          label="Follow-up Cancelled"
          variant="success"
          nodeId={event.nodeId}
          nodeMetadata={nodeMetadata}
          timestamp={event.timestamp}
          prevTimestamp={prevEvent?.timestamp}
        >
          <div className="text-[11px] text-muted-foreground">
            Sequence stopped ({reasonText})
            {cancelledSteps > 0 && <span> • {cancelledSteps} pending step{cancelledSteps > 1 ? "s" : ""} cancelled</span>}
          </div>
        </EventCardBase>
      );
    }

    default:
      // Generic follow-up event with unknown action
      return (
        <EventCardBase
          icon={Bell}
          label="Follow-up"
          variant="default"
          nodeId={event.nodeId}
          nodeMetadata={nodeMetadata}
          timestamp={event.timestamp}
          prevTimestamp={prevEvent?.timestamp}
        >
          <div className="text-[11px] text-muted-foreground">
            Follow-up event
          </div>
        </EventCardBase>
      );
  }
});
