/**
 * Variables Card
 *
 * Displays variable changes with actual values.
 *
 * @module features/simulator/components/chat/system-events/variables-card
 */

import { memo } from "react";
import { Variable } from "lucide-react";

import { EventCardBase } from "./event-card-base";
import type { SystemEventProps } from "./types";
import { formatValue } from "./utils";

interface VariableOperation {
  op: string;
  key: string;
  scope: string;
  value?: unknown;
}

/**
 * Format operation for display
 */
function formatOperation(op: VariableOperation): string {
  const valueStr = op.value !== undefined ? ` = ${formatValue(op.value)}` : "";

  switch (op.op) {
    case "set":
      return `${op.key}${valueStr}`;
    case "increment":
      return `${op.key} += ${op.value ?? 1}`;
    case "decrement":
      return `${op.key} -= ${op.value ?? 1}`;
    case "delete":
      return `${op.key} (deleted)`;
    default:
      return `${op.op}(${op.key})${valueStr}`;
  }
}

/**
 * Variables event card
 */
export const VariablesCard = memo(function VariablesCard({ event, prevEvent, nodeMetadata }: SystemEventProps) {
  const payload = event.payload as { operations?: VariableOperation[] } | undefined;
  const operations = payload?.operations || [];

  // Group operations by scope (with catch-all for unknown scopes)
  const byScope: Record<string, VariableOperation[]> = { user: [], journey: [], global: [], other: [] };
  for (const op of operations) {
    const bucket = byScope[op.scope] ?? byScope.other;
    bucket.push(op);
  }

  return (
    <EventCardBase
      icon={Variable}
      label="Variables"
      variant="default"
      nodeId={event.nodeId}
      nodeMetadata={nodeMetadata}
      timestamp={event.timestamp}
      prevTimestamp={prevEvent?.timestamp}
    >
      <div className="space-y-0.5 text-[11px]">
        {byScope.user.length > 0 && (
          <div className="flex items-start gap-1">
            <span className="text-muted-foreground shrink-0">User:</span>
            <span className="font-mono text-foreground/80">
              {byScope.user.map(formatOperation).join(", ")}
            </span>
          </div>
        )}
        {byScope.journey.length > 0 && (
          <div className="flex items-start gap-1">
            <span className="text-muted-foreground shrink-0">Journey:</span>
            <span className="font-mono text-foreground/80">
              {byScope.journey.map(formatOperation).join(", ")}
            </span>
          </div>
        )}
        {byScope.global.length > 0 && (
          <div className="flex items-start gap-1">
            <span className="text-muted-foreground shrink-0">Global:</span>
            <span className="font-mono text-foreground/80">
              {byScope.global.map(formatOperation).join(", ")}
            </span>
          </div>
        )}
        {byScope.other.length > 0 && (
          <div className="flex items-start gap-1">
            <span className="text-muted-foreground shrink-0">Other:</span>
            <span className="font-mono text-foreground/80">
              {byScope.other.map(formatOperation).join(", ")}
            </span>
          </div>
        )}
      </div>
    </EventCardBase>
  );
});
