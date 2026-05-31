/**
 * Tags Card
 *
 * Displays tag add/remove events with visual badges.
 *
 * @module features/simulator/components/chat/system-events/tags-card
 */

import { memo } from "react";
import { Tag } from "lucide-react";

import { Badge } from "@/shared/components/ui/badges";

import { EventCardBase } from "./event-card-base";
import type { SystemEventProps } from "./types";

/**
 * Tags event card
 */
export const TagsCard = memo(function TagsCard({ event, prevEvent, nodeMetadata }: SystemEventProps) {
  // Engine emits tags as nested structure: payload.tags.add / payload.tags.remove
  const payload = event.payload as { tags?: { add?: string[]; remove?: string[] }; scope?: string } | undefined;
  const addTags = payload?.tags?.add || [];
  const removeTags = payload?.tags?.remove || [];
  const scope = payload?.scope;

  return (
    <EventCardBase
      icon={Tag}
      label="Tags"
      variant="default"
      nodeId={event.nodeId}
      nodeMetadata={nodeMetadata}
      timestamp={event.timestamp}
      prevTimestamp={prevEvent?.timestamp}
    >
      <div className="flex items-center gap-1.5 flex-wrap">
        {addTags.map((tag) => (
          <Badge key={`add-${tag}`} variant="success" className="text-[10px] px-1.5 py-0 gap-0.5">
            <span className="text-success">+</span>
            {tag}
          </Badge>
        ))}
        {removeTags.map((tag) => (
          <Badge key={`remove-${tag}`} variant="error" className="text-[10px] px-1.5 py-0 gap-0.5">
            <span className="text-destructive">−</span>
            {tag}
          </Badge>
        ))}
        {scope === "global" && (
          <span className="text-[10px] text-muted-foreground">(global)</span>
        )}
      </div>
    </EventCardBase>
  );
});
