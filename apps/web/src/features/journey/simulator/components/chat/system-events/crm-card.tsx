/**
 * CRM Card
 *
 * Displays CRM action events (create, move, remove pipeline stages).
 *
 * @module features/simulator/components/chat/system-events/crm-card
 */

import { memo } from "react";
import { Check, GitPullRequest, X } from "lucide-react";

import { EventCardBase } from "./event-card-base";
import type { SystemEventProps } from "./types";

/** Map action to friendly label */
function getActionLabel(action: string): string {
  switch (action) {
    case "update": return "Position Updated";
    case "pipeline": return "Pipeline Set";
    case "stage": return "Stage Set";
    default: return "CRM Action";
  }
}

/**
 * CRM event card - displays CRM position updates
 */
export const CrmCard = memo(function CrmCard({ event, prevEvent, nodeMetadata }: SystemEventProps) {
  const payload = event.payload as {
    action?: string;
    pipelineId?: string;
    stageId?: string;
    success?: boolean;
    message?: string;
  } | undefined;

  const action = payload?.action || "update";
  const pipelineId = payload?.pipelineId;
  const stageId = payload?.stageId;
  const success = payload?.success ?? true;
  const message = payload?.message;
  const actionLabel = getActionLabel(action);

  return (
    <EventCardBase
      icon={GitPullRequest}
      label="CRM"
      variant={success ? "info" : "error"}
      nodeId={event.nodeId}
      nodeMetadata={nodeMetadata}
      timestamp={event.timestamp}
      prevTimestamp={prevEvent?.timestamp}
    >
      <div className="space-y-0.5 text-[11px]">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-foreground">{actionLabel}</span>
          {pipelineId && (
            <>
              <span className="text-muted-foreground">•</span>
              <span className="text-muted-foreground">Pipeline:</span>
              <span className="font-mono text-foreground/80">{pipelineId}</span>
            </>
          )}
          {stageId && (
            <>
              <span className="text-muted-foreground">•</span>
              <span className="text-muted-foreground">Stage:</span>
              <span className="font-mono text-foreground/80">{stageId}</span>
            </>
          )}
        </div>
        {message && (
          <div className="flex items-center gap-1">
            {success ? (
              <Check className="h-3 w-3 text-success" />
            ) : (
              <X className="h-3 w-3 text-destructive" />
            )}
            <span className={success ? "text-muted-foreground" : "text-destructive"}>{message}</span>
          </div>
        )}
      </div>
    </EventCardBase>
  );
});
