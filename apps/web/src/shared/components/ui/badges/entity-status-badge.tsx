import type { JourneyStatus, MindstateStatus, WorkflowStatus } from "@journey/schemas";

import { StatusDotBadge } from "./status-dot-badge";

type EntityStatus = JourneyStatus | WorkflowStatus | MindstateStatus;

export interface EntityStatusBadgeProps {
  status: EntityStatus;
  entityType?: "journey" | "workflow" | "mindstate";
  size?: "sm" | "default";
  hideTextOnMobile?: boolean;
  className?: string;
}

const dotColors: Record<EntityStatus, string> = {
  draft: "bg-orange-500",
  active: "bg-emerald-500",
  archived: "bg-slate-500",
};

export function EntityStatusBadge({
  status,
  entityType,
  size = "default",
  hideTextOnMobile,
  className,
}: EntityStatusBadgeProps) {
  const ariaLabel = entityType ? `${entityType} status: ${status}` : undefined;

  return (
    <StatusDotBadge
      label={status}
      dotClassName={dotColors[status]}
      size={size}
      className={className}
      hideTextOnMobile={hideTextOnMobile}
      ariaLabel={ariaLabel}
    />
  );
}
