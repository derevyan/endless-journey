/**
 * SSE Connection Hook
 *
 * Manages Server-Sent Events (SSE) connection lifecycle with:
 * - Automatic reconnection with exponential backoff
 * - Connection timeout handling
 * - Explicit state machine for clean state tracking
 *
 * @module shared/hooks/use-sse-connection
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { createLogger, serializeError } from "@journey/logger";

const log = createLogger("sse-connection");

// =============================================================================
// TYPES
// =============================================================================

/** SSE Connection configuration */
export interface SSEConnectionConfig {
  /** Connection timeout in milliseconds */
  connectTimeoutMs: number;
  /** Maximum reconnection attempts before giving up */
  maxReconnectAttempts: number;
  /** Initial reconnection delay (doubles with each attempt) */
  initialReconnectDelayMs: number;
}

/** SSE Connection status for external consumers */
export type SSEConnectionStatus = "disconnected" | "connecting" | "connected" | "reconnecting";

/** Internal state machine for SSE connection */
type SSEConnectionState =
  | { status: "disconnected" }
  | { status: "connecting"; timeoutId: NodeJS.Timeout }
  | { status: "connected"; eventSource: EventSource }
  | { status: "reconnecting"; attempts: number; eventSource: EventSource | null };

/** Options for useSSEConnection hook */
export interface UseSSEConnectionOptions {
  /** SSE endpoint URL */
  url: string;
  /** Event handler for incoming messages */
  onEvent: (event: MessageEvent) => void;
  /** Error handler for connection failures */
  onError?: (error: Error) => void;
  /** Connection configuration */
  config: SSEConnectionConfig;
  /** Whether to include credentials (cookies) in the request */
  withCredentials?: boolean;
}

/** Return type for useSSEConnection hook */
export interface UseSSEConnectionResult {
  /** Current connection status */
  status: SSEConnectionStatus;
  /** Whether currently connected */
  isConnected: boolean;
  /** Connect to SSE endpoint (returns Promise that resolves when connected) */
  connect: () => Promise<void>;
  /** Disconnect from SSE endpoint */
  disconnect: () => void;
}

// =============================================================================
// HOOK
// =============================================================================

/**
 * Hook for managing SSE connection lifecycle.
 *
 * Features:
 * - Promise-based connect() that resolves when connection is established
 * - Automatic reconnection with exponential backoff on disconnect
 * - Clean disconnect with proper cleanup
 * - Explicit state machine prevents inconsistent states
 *
 * @example
 * ```tsx
 * const { status, connect, disconnect } = useSSEConnection({
 *   url: '/api/events/stream',
 *   onEvent: (e) => console.log('Event:', e.data),
 *   config: { connectTimeoutMs: 10000, maxReconnectAttempts: 5, initialReconnectDelayMs: 1000 }
 * });
 *
 * // Connect and wait for connection
 * await connect();
 *
 * // Later, disconnect
 * disconnect();
 * ```
 */
export function useSSEConnection({
  url,
  onEvent,
  onError,
  config,
  withCredentials = true,
}: UseSSEConnectionOptions): UseSSEConnectionResult {
  // State machine for connection lifecycle
  const [state, setState] = useState<SSEConnectionState>({ status: "disconnected" });

  // Refs for cleanup and reconnection
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const hasConnectedOnceRef = useRef(false);
  // Track current state for connection reuse check (avoids dependency on state in connect)
  const stateRef = useRef<SSEConnectionState>(state);
  stateRef.current = state;

  // Keep onEvent and onError refs stable to avoid reconnection loops
  const onEventRef = useRef(onEvent);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onEventRef.current = onEvent;
    onErrorRef.current = onError;
  }, [onEvent, onError]);

  /**
   * Clear any pending reconnection timeout
   */
  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  /**
   * Close EventSource and clean up
   */
  const closeEventSource = useCallback((eventSource: EventSource | null) => {
    if (eventSource) {
      eventSource.close();
    }
  }, []);

  /**
   * Disconnect from SSE endpoint.
   * Clears all state and stops any pending reconnection.
   */
  const disconnect = useCallback(() => {
    clearReconnectTimeout();
    hasConnectedOnceRef.current = false;
    reconnectAttemptsRef.current = 0;

    setState((currentState) => {
      if (currentState.status === "connected") {
        closeEventSource(currentState.eventSource);
      } else if (currentState.status === "connecting") {
        clearTimeout(currentState.timeoutId);
      } else if (currentState.status === "reconnecting") {
        closeEventSource(currentState.eventSource);
      }
      return { status: "disconnected" };
    });

    log.debug({}, "sseConnection:disconnected");
  }, [clearReconnectTimeout, closeEventSource]);

  /**
   * Schedule a reconnection attempt with exponential backoff
   */
  const scheduleReconnect = useCallback(
    (attempt: number, connectFn: () => Promise<void>) => {
      if (reconnectTimeoutRef.current) {
        log.debug(
          { attempt, maxAttempts: config.maxReconnectAttempts },
          "sseConnection:reconnectAlreadyScheduled"
        );
        return;
      }

      const delay = config.initialReconnectDelayMs * Math.pow(2, attempt - 1);
      log.warn(
        { attempt, maxAttempts: config.maxReconnectAttempts, delayMs: delay },
        "sseConnection:schedulingReconnect"
      );

      reconnectTimeoutRef.current = setTimeout(() => {
        connectFn().catch((err) => {
          log.error({ err: serializeError(err) }, "sseConnection:reconnectFailed");
        });
      }, delay);
    },
    [config.maxReconnectAttempts, config.initialReconnectDelayMs]
  );

  /**
   * Connect to SSE endpoint.
   * Returns a Promise that resolves when connected or rejects on failure.
   * If already connected, returns immediately without creating a new connection.
   */
  const connect = useCallback((): Promise<void> => {
    // Reuse existing connection if already connected
    // This prevents rate limit exhaustion from repeated connect() calls
    if (stateRef.current.status === "connected") {
      log.debug({}, "sseConnection:alreadyConnected");
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      // Close existing connection if any (connecting/reconnecting states)
      setState((currentState) => {
        if (currentState.status === "connecting") {
          clearTimeout(currentState.timeoutId);
        } else if (currentState.status === "reconnecting") {
          closeEventSource(currentState.eventSource);
        }
        return currentState; // Will be updated below
      });

      clearReconnectTimeout();

      // Set up connection timeout
      const timeoutId = setTimeout(() => {
        setState((currentState) => {
          if (currentState.status === "connecting") {
            log.error({ timeoutMs: config.connectTimeoutMs }, "sseConnection:connectionTimeout");
            reject(new Error("SSE connection timeout"));
            return { status: "disconnected" };
          }
          return currentState;
        });
      }, config.connectTimeoutMs);

      setState({ status: "connecting", timeoutId });

      try {
        const eventSource = new EventSource(url, { withCredentials });

        eventSource.onopen = () => {
          clearTimeout(timeoutId);
          hasConnectedOnceRef.current = true;
          reconnectAttemptsRef.current = 0;
          setState({ status: "connected", eventSource });
          log.info({}, "sseConnection:connected");
          resolve();
        };

        eventSource.addEventListener("event", (e) => {
          onEventRef.current(e);
        });

        eventSource.onerror = () => {
          clearTimeout(timeoutId);

          setState((_currentState) => {
            // Close the failed EventSource
            closeEventSource(eventSource);

            if (reconnectTimeoutRef.current) {
              return {
                status: "reconnecting",
                attempts: Math.max(reconnectAttemptsRef.current, 1),
                eventSource: null,
              };
            }

            // If we've connected once before, attempt reconnection
            if (hasConnectedOnceRef.current) {
              const nextAttempt = reconnectAttemptsRef.current + 1;

              if (nextAttempt > config.maxReconnectAttempts) {
                log.error(
                  { attempts: nextAttempt, maxAttempts: config.maxReconnectAttempts },
                  "sseConnection:maxReconnectAttemptsReached"
                );
                onErrorRef.current?.(new Error("SSE connection lost after max retries"));
                clearReconnectTimeout();
                reconnectAttemptsRef.current = 0;
                return { status: "disconnected" };
              }

              reconnectAttemptsRef.current = nextAttempt;
              scheduleReconnect(nextAttempt, connect);

              return { status: "reconnecting", attempts: nextAttempt, eventSource: null };
            }

            // Initial connection failure
            log.warn({}, "sseConnection:initialConnectionFailed");
            reject(new Error("SSE connection failed"));
            return { status: "disconnected" };
          });
        };
      } catch (err) {
        clearTimeout(timeoutId);
        const error = err instanceof Error ? err : new Error("Failed to create EventSource");
        log.error({ err: serializeError(error) }, "sseConnection:createFailed");
        onErrorRef.current?.(error);
        setState({ status: "disconnected" });
        reject(error);
      }
    });
  }, [
    url,
    withCredentials,
    config.connectTimeoutMs,
    config.maxReconnectAttempts,
    closeEventSource,
    clearReconnectTimeout,
    scheduleReconnect,
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    status: state.status,
    isConnected: state.status === "connected",
    connect,
    disconnect,
  };
}
