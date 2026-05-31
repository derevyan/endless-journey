/**
 * System Event Renderer
 *
 * Dispatches to the correct event card component based on event type.
 *
 * @module features/simulator/components/chat/system-events/system-event-renderer
 */

import { memo } from "react";

import { SystemEventType } from "../../../types/event-types";
import { CrmCard } from "./crm-card";
import { ErrorCard } from "./error-card";
import { FollowUpCard } from "./follow-up-card";
import { MindstateCard } from "./mindstate-card";
import { TagsCard } from "./tags-card";
import { TeleportCard } from "./teleport-card";
import { TimeoutCard } from "./timeout-card";
import { TransitionCard } from "./transition-card";
import type { SystemEventProps } from "./types";
import { VariablesCard } from "./variables-card";

/**
 * Render the appropriate card component for a system event
 */
export const SystemEventRenderer = memo(function SystemEventRenderer({ event, prevEvent, nodeMetadata }: SystemEventProps) {
  switch (event.type) {
    case SystemEventType.TRANSITION:
      return <TransitionCard event={event} prevEvent={prevEvent} nodeMetadata={nodeMetadata} />;
    case SystemEventType.TIMEOUT:
      return <TimeoutCard event={event} prevEvent={prevEvent} nodeMetadata={nodeMetadata} />;
    case SystemEventType.ERROR:
      return <ErrorCard event={event} prevEvent={prevEvent} nodeMetadata={nodeMetadata} />;
    case SystemEventType.TAG:
      return <TagsCard event={event} prevEvent={prevEvent} nodeMetadata={nodeMetadata} />;
    case SystemEventType.VARIABLE:
      return <VariablesCard event={event} prevEvent={prevEvent} nodeMetadata={nodeMetadata} />;
    case SystemEventType.TELEPORT:
      return <TeleportCard event={event} prevEvent={prevEvent} nodeMetadata={nodeMetadata} />;
    case SystemEventType.MINDSTATE:
      return <MindstateCard event={event} prevEvent={prevEvent} nodeMetadata={nodeMetadata} />;
    case SystemEventType.CRM:
      return <CrmCard event={event} prevEvent={prevEvent} nodeMetadata={nodeMetadata} />;
    case SystemEventType.FOLLOWUP:
      return <FollowUpCard event={event} prevEvent={prevEvent} nodeMetadata={nodeMetadata} />;
    default:
      // Unknown event type - don't render anything
      return null;
  }
});
