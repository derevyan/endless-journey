/**
 * Event Log Panel for Simulator Mode Console
 *
 * Wrapper around InteractionLog for the simulator console.
 *
 * @module features/simulator/components/console/event-log-panel
 */

import type { InteractionEvent } from "@journey/schemas";
import { Terminal } from "lucide-react";

import { InteractionLog } from "@/shared/components/common/interaction-log";

interface EventLogPanelProps {
  events: InteractionEvent[];
  onClear: () => void;
  className?: string;
}

export function EventLogPanel({ events, onClear, className }: EventLogPanelProps) {
  return (
    <InteractionLog
      events={events}
      title="Console"
      icon={Terminal}
      onClear={onClear}
      showDateGroups={false}
      autoScroll={true}
      emptyMessage="Waiting for events..."
      className={className}
    />
  );
}
