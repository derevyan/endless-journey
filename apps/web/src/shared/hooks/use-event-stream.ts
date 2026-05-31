/**
 * Event Stream Hook (Built on SSE Connection)
 *
 * Specialized SSE hook for EnrichedEvent streaming with storage.
 * Wraps use-sse-connection with event parsing and memory management.
 *
 * @module shared/hooks/use-event-stream
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createLogger, serializeError } from "@journey/logger";
import { EventTypes, type EnrichedEvent } from "@journey/schemas";
import { API_URL } from "@/shared/lib/app-config";
import { useSSEConnection, type SSEConnectionConfig } from "./use-sse-connection";

const log = createLogger("event-stream");

// Default SSE configuration for event streaming
const DEFAULT_EVENT_STREAM_CONFIG: SSEConnectionConfig = {
  connectTimeoutMs: 10000,
  maxReconnectAttempts: 5,
  initialReconnectDelayMs: 1000,
};

export interface UseEventStreamOptions {
  /** SSE endpoint URL (default: uses API_URL + /api/events/stream) */
  url?: string;
  /** Maximum events to keep in memory (default: 100) */
  maxEvents?: number;
  /** Callback when new event arrives */
  onEvent?: (event: EnrichedEvent) => void;
  /** Error handler for connection and parsing errors */
  onError?: (error: Error) => void;
  /** Callback when connection established */
  onConnect?: () => void;
  /** Callback when disconnected */
  onDisconnect?: () => void;
  /** SSE connection configuration */
  config?: Partial<SSEConnectionConfig>;
  /** Whether to include credentials (default: true) */
  withCredentials?: boolean;
}

export interface UseEventStreamResult {
  /** Stored events (newest first) */
  events: EnrichedEvent[];
  /** Whether currently connected */
  isConnected: boolean;
  /** Current connection status */
  status: "disconnected" | "connecting" | "connected" | "reconnecting";
  /** Last error encountered */
  error: Error | null;
  /** Clear all stored events */
  clearEvents: () => void;
  /** Manually connect (Promise-based) */
  connect: () => Promise<void>;
  /** Manually disconnect */
  disconnect: () => void;
}

/**
 * Hook for SSE event streaming with automatic storage and parsing.
 *
 * Features:
 * - Automatic JSON parsing of EnrichedEvent
 * - In-memory event storage with size limit
 * - Special handling for SSE error events
 * - Reconnection with exponential backoff
 * - Heartbeat acknowledgment
 *
 * @example
 * ```tsx
 * // Simple usage with defaults
 * const { events, isConnected } = useEventStream(true);
 *
 * // Custom endpoint and options
 * const { events, clearEvents } = useEventStream(true, {
 *   url: '/api/custom/stream',
 *   maxEvents: 50,
 *   onEvent: (e) => console.log('New event:', e),
 * });
 * ```
 */
export function useEventStream(
  enabled: boolean,
  options: UseEventStreamOptions = {}
): UseEventStreamResult {
  const {
    url,
    maxEvents = 100,
    onEvent,
    onError,
    onConnect,
    onDisconnect,
    config = {},
    withCredentials = true,
  } = options;

  // Derive URL from API_URL if not provided
  const streamUrl = useMemo(() => {
    if (url) return url;
    return `${API_URL}/api/events/stream`;
  }, [url]);

  const [events, setEvents] = useState<EnrichedEvent[]>([]);
  const [error, setError] = useState<Error | null>(null);

  // Stable callback refs
  const onEventRef = useRef(onEvent);
  const onErrorRef = useRef(onError);
  const onConnectRef = useRef(onConnect);
  const onDisconnectRef = useRef(onDisconnect);

  useEffect(() => {
    onEventRef.current = onEvent;
    onErrorRef.current = onError;
    onConnectRef.current = onConnect;
    onDisconnectRef.current = onDisconnect;
  }, [onEvent, onError, onConnect, onDisconnect]);

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  // SSE event handler - parse and store events
  const handleSSEMessage = useCallback(
    (messageEvent: MessageEvent) => {
      try {
        const event = JSON.parse(messageEvent.data) as EnrichedEvent;

        // Special handling for SSE error events
        if (event.type === EventTypes.SYSTEM_SSE_ERROR) {
          const payload = event.payload as {
            originalEventType: string;
            originalEventId: string;
            errorMessage: string;
            errorCode?: string;
          };
          log.warn(
            {
              originalEventType: payload.originalEventType,
              errorMessage: payload.errorMessage,
            },
            "eventStream:sseError"
          );
          const sseError = new Error(
            `SSE publish failed: ${payload.errorMessage}`
          );
          setError(sseError);
          onErrorRef.current?.(sseError);
          // Don't add error events to the events list
          return;
        }

        // Handle heartbeat (no storage needed)
        if (messageEvent.type === "heartbeat") {
          return;
        }

        // Store event (newest first)
        setEvents((prev) => {
          const newEvents = [event, ...prev];
          return newEvents.slice(0, maxEvents);
        });

        onEventRef.current?.(event);
      } catch (parseError) {
        const parseErr =
          parseError instanceof Error
            ? parseError
            : new Error("Failed to parse event");
        log.error(
          { err: serializeError(parseErr) },
          "eventStream:parseEventFailed"
        );
        setError(parseErr);
        onErrorRef.current?.(parseErr);
      }
    },
    [maxEvents]
  );

  // SSE error handler
  const handleSSEError = useCallback((err: Error) => {
    log.error({ err: serializeError(err) }, "eventStream:connectionError");
    setError(err);
    onErrorRef.current?.(err);
  }, []);

  // Connection lifecycle callbacks
  const handleConnect = useCallback(() => {
    setError(null);
    onConnectRef.current?.();
  }, []);

  const handleDisconnect = useCallback(() => {
    onDisconnectRef.current?.();
  }, []);

  // Merge user config with defaults
  const sseConfig = useMemo(
    () => ({ ...DEFAULT_EVENT_STREAM_CONFIG, ...config }),
    [config]
  );

  // Use base SSE connection hook
  const { connect, disconnect, isConnected, status } = useSSEConnection({
    url: streamUrl,
    onEvent: handleSSEMessage,
    onError: handleSSEError,
    config: sseConfig,
    withCredentials,
  });

  // Auto-connect when enabled
  useEffect(() => {
    if (enabled) {
      connect()
        .then(() => {
          handleConnect();
        })
        .catch((err) => {
          log.error(
            { err: serializeError(err) },
            "eventStream:autoConnectFailed"
          );
        });
    } else {
      disconnect();
      handleDisconnect();
    }
  }, [enabled, connect, disconnect, handleConnect, handleDisconnect]);

  return {
    events,
    isConnected,
    status,
    error,
    clearEvents,
    connect,
    disconnect,
  };
}
