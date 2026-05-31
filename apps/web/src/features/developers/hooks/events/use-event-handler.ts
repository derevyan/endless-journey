/**
 * Event Handler Hook
 *
 * React hook for registering custom event handlers.
 * Automatically handles cleanup on unmount.
 *
 * @module hooks/events/use-event-handler
 */

import { useEffect, useRef, useCallback, useMemo } from "react";

import { eventDispatcher } from "@/shared/lib/events";
import type {
  EventHandler,
  EventHandlerConfig,
  FrontendEvent,
} from "@/shared/lib/events";

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Creates a stable handler reference that always calls the latest version
 */
function useStableHandler(handler: EventHandler): EventHandler {
  const handlerRef = useRef(handler);

  // Update ref on every render to capture latest closure values
  useEffect(() => {
    handlerRef.current = handler;
  });

  // Return stable callback that delegates to ref
  return useCallback((event: FrontendEvent) => {
    return handlerRef.current(event);
  }, []);
}

/**
 * Memoize event type to prevent unnecessary re-registrations
 */
function useStableEventType(eventType: string | string[]): string | string[] {
  // For arrays, stringify to compare contents
  const isArray = Array.isArray(eventType);
  const eventTypeKey = isArray ? eventType.join(",") : eventType;
  return useMemo(
    () => (isArray ? eventTypeKey.split(",") : eventTypeKey),
    [eventTypeKey, isArray]
  );
}

// =============================================================================
// HOOKS
// =============================================================================

/**
 * Register a handler for specific event type(s)
 *
 * @param eventType - Event type or array of types to handle
 * @param handler - Handler function
 *
 * @example
 * ```tsx
 * useEventHandler("crm.stage.changed", (event) => {
 *   console.log("Stage changed:", event.payload);
 * });
 *
 * useEventHandler(
 *   ["journey.created", "journey.deleted"],
 *   (event) => {
 *     refetchJourneys();
 *   }
 * );
 * ```
 */
export function useEventHandler(
  eventType: string | string[],
  handler: EventHandler
): void {
  const stableHandler = useStableHandler(handler);
  const stableEventType = useStableEventType(eventType);

  useEffect(() => {
    const unsubscribe = eventDispatcher.register(stableEventType, {
      handler: stableHandler,
    });
    return unsubscribe;
  }, [stableEventType, stableHandler]);
}

/**
 * Register a handler with full configuration options
 *
 * @param eventType - Event type or array of types to handle
 * @param config - Handler configuration (handler, priority, filter)
 *
 * @example
 * ```tsx
 * useEventHandlerWithConfig(
 *   "user.message",
 *   {
 *     handler: (event) => handleMessage(event),
 *     priority: HANDLER_PRIORITY.HIGH,
 *     filter: (event) => event.journeyId === currentJourneyId,
 *   }
 * );
 * ```
 */
export function useEventHandlerWithConfig(
  eventType: string | string[],
  config: EventHandlerConfig
): void {
  const stableHandler = useStableHandler(config.handler);
  const stableEventType = useStableEventType(eventType);

  // Memoize config with stable handler
  const stableConfig = useMemo(
    () => ({
      ...config,
      handler: stableHandler,
    }),
    [config, stableHandler]
  );

  useEffect(() => {
    const unsubscribe = eventDispatcher.register(stableEventType, stableConfig);
    return unsubscribe;
  }, [stableEventType, stableConfig]);
}

/**
 * Register a global handler that receives all events
 *
 * @param handler - Handler function
 *
 * @example
 * ```tsx
 * useGlobalEventHandler((event) => {
 *   analytics.track(event.type, event.payload);
 * });
 * ```
 */
export function useGlobalEventHandler(handler: EventHandler): void {
  const stableHandler = useStableHandler(handler);

  useEffect(() => {
    const unsubscribe = eventDispatcher.registerGlobal({
      handler: stableHandler,
    });
    return unsubscribe;
  }, [stableHandler]);
}
