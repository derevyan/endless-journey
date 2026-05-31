/**
 * Event Processor Hook
 *
 * Dedicated hook for processing incoming SSE events.
 * Manages debug state and routes events to handlers.
 * Clean separation of concerns from session lifecycle.
 *
 * @module features/simulator/hooks/use-event-processor
 */

import { useCallback, useState } from "react";
import { createLogger } from "@journey/logger";
import type { SimulatorDebugState } from "@journey/schemas";

import { applyStateChanges } from "../lib/state-change-applier";
import { EVENT_HANDLERS, handleGenericEvent } from "../lib/event-handlers";
import { isLoggableEvent } from "../lib/event-constants";
import type { SimulatorEvent } from "../lib/event-validators";

const log = createLogger("event-processor");

interface UseEventProcessorOptions {
  // Currently no options, but leaving this open for future extension
}

/**
 * Hook that processes SSE events
 * Maintains debug state and routes events to appropriate handlers
 *
 * @returns Object with processEvent callback and current debugState
 */
export function useEventProcessor(_options: UseEventProcessorOptions = {}) {
  const [debugState, setDebugState] = useState<SimulatorDebugState>({});

  /**
   * Process a single simulator event
   * 1. Update debug state
   * 2. Route to handler or default logging
   * 3. Apply resulting state changes
   */
  const processEvent = useCallback((event: SimulatorEvent) => {
    log.debug(
      { eventType: event.type, sessionId: event.sessionId },
      "eventProcessor:eventReceived"
    );

    // Update debug state from every event (used for derived state like pendingTimers)
    if (event._debug) {
      setDebugState(event._debug);
    }

    // Try to find a special handler for this event type
    const handler = EVENT_HANDLERS[event.type];
    if (handler) {
      const changes = handler(event);
      applyStateChanges(changes);
      return;
    }

    // Default: log if this is a loggable event type
    if (isLoggableEvent(event.type)) {
      const changes = handleGenericEvent(event);
      applyStateChanges(changes);
    } else {
      log.debug({ eventType: event.type }, "eventProcessor:unhandledEventType");
    }
  }, []);

  return {
    processEvent,
    debugState,
  };
}

export type UseEventProcessorReturn = ReturnType<typeof useEventProcessor>;
