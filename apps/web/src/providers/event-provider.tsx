/**
 * Event Provider
 *
 * Connects SSE event stream to the event dispatcher.
 * Sets up core event handlers for query invalidation and notifications.
 *
 * @module providers/event-provider
 */

import { useQueryClient } from "@tanstack/react-query";
import React, { useCallback, useEffect } from "react";

import { createLogger, serializeError } from "@journey/logger";

import { useEventStream } from "@/shared/hooks";
import {
  eventDispatcher,
  createQueryInvalidationHandler,
  createNotificationHandler,
  QUERY_INVALIDATION_CONFIG,
  NOTIFICATION_CONFIG,
} from "@/shared/lib/events";
import { eventBridge } from "@/stores/event-bridge";

const log = createLogger("event-provider");

// =============================================================================
// PROPS
// =============================================================================

interface EventProviderProps {
  children: React.ReactNode;
  /** Enable SSE event streaming (default: true) */
  enabled?: boolean;
  /** Enable query invalidation handler (default: true) */
  enableQueryInvalidation?: boolean;
  /** Enable notification handler (default: true) */
  enableNotifications?: boolean;
}

// =============================================================================
// PROVIDER
// =============================================================================

/**
 * Event provider that connects SSE events to the dispatcher
 *
 * @example
 * ```tsx
 * <EventProvider>
 *   <App />
 * </EventProvider>
 * ```
 */
export function EventProvider({
  children,
  enabled = true,
  enableQueryInvalidation = true,
  enableNotifications = true,
}: EventProviderProps) {
  const queryClient = useQueryClient();

  // Memoize callbacks to prevent infinite reconnection loops
  // (unstable callback references cause useEventStream to reconnect)
  const handleConnect = useCallback(() => {
    log.info("eventProvider:connected");
  }, []);

  const handleDisconnect = useCallback(() => {
    log.info("eventProvider:disconnected");
  }, []);

  // Dispatch each event immediately as it arrives from SSE
  // This ensures no events are lost during React render batching
  const handleEvent = useCallback((event: Parameters<typeof eventDispatcher.dispatch>[0]) => {
    eventDispatcher.dispatch(event).catch((error) => {
      log.error(
        { err: serializeError(error), eventType: event.type },
        "eventProvider:dispatchError"
      );
    });
  }, []);

  // SSE event stream - use onEvent callback for immediate dispatch
  useEventStream(enabled, {
    onConnect: handleConnect,
    onDisconnect: handleDisconnect,
    onEvent: handleEvent,
  });

  // Register core handlers on mount
  useEffect(() => {
    const unsubscribers: (() => void)[] = [];

    // Query invalidation handler
    if (enableQueryInvalidation) {
      const queryHandler = createQueryInvalidationHandler(queryClient);
      unsubscribers.push(
        eventDispatcher.registerGlobal({
          handler: queryHandler,
          priority: QUERY_INVALIDATION_CONFIG.priority,
        })
      );
      log.debug("eventProvider:queryInvalidationRegistered");
    }

    // Notification handler
    if (enableNotifications) {
      const notificationHandler = createNotificationHandler();
      unsubscribers.push(
        eventDispatcher.registerGlobal({
          handler: notificationHandler,
          priority: NOTIFICATION_CONFIG.priority,
        })
      );
      log.debug("eventProvider:notificationRegistered");
    }

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [queryClient, enableQueryInvalidation, enableNotifications]);

  // Start event bridge when SSE is enabled
  // This bridges backend events to the store event bus for real-time sync
  useEffect(() => {
    if (!enabled) return;

    eventBridge.start();
    log.debug("eventProvider:bridgeStarted");

    return () => {
      eventBridge.stop();
      log.debug("eventProvider:bridgeStopped");
    };
  }, [enabled]);

  return <>{children}</>;
}
