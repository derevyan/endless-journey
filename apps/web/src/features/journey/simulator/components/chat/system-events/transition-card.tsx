/**
 * Transition Card
 *
 * Displays node transition events with from/to and trigger reason.
 *
 * @module features/simulator/components/chat/system-events/transition-card
 */

import { memo } from "react";
import { ArrowRight, Cog, MousePointer, Timer, Zap } from "lucide-react";

import { EventCardBase } from "./event-card-base";
import type { SystemEventProps } from "./types";

/**
 * Get trigger icon and label
 */
function getTriggerDisplay(trigger?: string): { icon: React.ReactNode; label: string } {
  if (!trigger) return { icon: <Cog className="h-2.5 w-2.5" />, label: "automatic" };

  if (trigger.includes("button") || trigger.includes("click")) {
    return { icon: <MousePointer className="h-2.5 w-2.5" />, label: trigger };
  }
  if (trigger.includes("timeout") || trigger.includes("timer")) {
    return { icon: <Timer className="h-2.5 w-2.5" />, label: trigger };
  }
  if (trigger.includes("webhook")) {
    return { icon: <Zap className="h-2.5 w-2.5" />, label: trigger };
  }

  return { icon: <Cog className="h-2.5 w-2.5" />, label: trigger };
}

/**
 * Transition event card
 */
export const TransitionCard = memo(function TransitionCard({ event, prevEvent, nodeMetadata }: SystemEventProps) {
  const payload = event.payload as { from?: string; to?: string; trigger?: string } | undefined;
  const from = payload?.from || "?";
  const to = payload?.to || "?";
  const triggerDisplay = getTriggerDisplay(payload?.trigger);

  return (
    <EventCardBase
      icon={ArrowRight}
      label="Transition"
      variant="success"
      nodeId={event.nodeId}
      nodeMetadata={nodeMetadata}
      timestamp={event.timestamp}
      prevTimestamp={prevEvent?.timestamp}
    >
      <div className="flex items-center gap-2 text-[11px]">
        <span className="font-mono text-muted-foreground">{from}</span>
        <ArrowRight className="h-3 w-3 text-success" />
        <span className="font-mono text-foreground">{to}</span>
        <span className="text-muted-foreground">•</span>
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          {triggerDisplay.icon}
          {triggerDisplay.label}
        </span>
      </div>
    </EventCardBase>
  );
});
