/**
 * Session Lifecycle Hook
 *
 * Manages session creation, cleanup, and event buffering.
 * Handles the critical race condition where SSE events arrive before sessionId is known.
 * Clean separation of concerns from event processing.
 *
 * @module features/simulator/hooks/use-session-lifecycle
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createLogger, serializeError } from "@journey/logger";

import { MAX_PENDING_EVENTS } from "../lib/event-constants";
import { simulatorApi } from "../lib/simulator-api-client";
import type { SimulatorEvent } from "../lib/event-validators";

const log = createLogger("session-lifecycle");

interface UseSessionLifecycleOptions {
  journeyId: string;
  connectSSE: () => Promise<void>;
  onError?: (error: Error) => void;
}

/**
 * Hook that manages session lifecycle
 * Handles creation, cleanup, and event buffering
 *
 * @param options - Configuration options
 * @returns Session state and lifecycle methods
 */
export function useSessionLifecycle({
  journeyId,
  connectSSE,
  onError,
}: UseSessionLifecycleOptions) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Refs for session management
  const sessionIdRef = useRef<string | null>(null);

  // Buffer events that arrive before we know the sessionId
  const pendingEventsRef = useRef<SimulatorEvent[]>([]);

  // Keep sessionIdRef in sync with sessionId state
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  /**
   * Buffer an event that arrived before session creation
   * Prevents unbounded buffer growth with MAX_PENDING_EVENTS limit
   */
  const bufferEvent = useCallback((event: SimulatorEvent) => {
    if (pendingEventsRef.current.length >= MAX_PENDING_EVENTS) {
      pendingEventsRef.current.shift(); // Drop oldest event
      log.warn(
        { maxSize: MAX_PENDING_EVENTS },
        "sessionLifecycle:eventBufferOverflow"
      );
    }

    log.debug(
      {
        eventType: event.type,
        sessionId: event.sessionId,
        bufferedCount: pendingEventsRef.current.length,
      },
      "sessionLifecycle:bufferingEvent"
    );
    pendingEventsRef.current.push(event);
  }, []);

  /**
   * Process buffered events after session is created
   * Called when sessionId becomes known
   *
   * @param targetSessionId - The session ID to filter events by
   * @param processEvent - Callback to process each event
   */
  const processPendingEvents = useCallback(
    (targetSessionId: string, processEvent: (e: SimulatorEvent) => void) => {
      const pending = pendingEventsRef.current;
      if (pending.length === 0) return;

      log.info(
        {
          count: pending.length,
          targetSessionId,
          eventTypes: pending.map((e) => e.type)
        },
        "sessionLifecycle:processingBufferedEvents"
      );

      // Filter for events matching this session
      const relevantEvents = pending.filter((e) => e.sessionId === targetSessionId);
      const droppedCount = pending.length - relevantEvents.length;

      if (droppedCount > 0) {
        log.warn(
          { droppedCount, targetSessionId },
          "sessionLifecycle:droppedEventsForOtherSessions"
        );
      }

      for (const event of relevantEvents) {
        processEvent(event);
      }

      // Clear the buffer
      pendingEventsRef.current = [];

      log.info(
        { processedCount: relevantEvents.length },
        "sessionLifecycle:bufferedEventsProcessed"
      );
    },
    []
  );

  /**
   * Start a new simulator session
   *
   * CRITICAL: SSE must be connected BEFORE creating the session!
   * The session creation triggers engine.start() which sends initial messages.
   * If SSE isn't connected yet, those messages are lost.
   *
   * @param startNodeId - Optional node to start from (defaults to journey start node)
   * @param personaId - Optional persona ID to reuse client identity
   * @returns Session response with sessionId, clientId, currentNodeId
   * @throws Error if session creation fails
   */
  const startSession = useCallback(
    async (startNodeId?: string, personaId?: string) => {
      setIsLoading(true);
      try {
        log.info(
          { journeyId, startNodeId, personaId },
          "sessionLifecycle:startSession"
        );

        // 1. Connect SSE FIRST (org-level, doesn't need sessionId)
        // This ensures we're subscribed before messages are published
        await connectSSE();
        log.info({}, "sessionLifecycle:sseReadyBeforeSession");

        // 2. Now create session - engine.start() will send messages
        // and we'll receive them via SSE
        const response = await simulatorApi.createSession({
          journeyId,
          startNodeId,
          personaId,
          clientProfile: {
            firstName: "Simulator",
            lastName: "User",
          },
        });

        // 3. Set sessionId IMMEDIATELY so event handler can filter correctly
        setSessionId(response.sessionId);
        sessionIdRef.current = response.sessionId;

        log.info(
          { sessionId: response.sessionId },
          "sessionLifecycle:sessionStarted"
        );

        return response;
      } catch (error) {
        const err = error instanceof Error ? error : new Error("Failed to start session");
        log.error(
          { err: serializeError(err) },
          "sessionLifecycle:startSessionFailed"
        );
        onError?.(err);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [journeyId, connectSSE, onError]
  );

  /**
   * Stop and cleanup the current session
   * Note: SSE connection is kept alive for reuse by future sessions.
   * It will be automatically disconnected on component unmount.
   */
  const stopSession = useCallback(async () => {
    if (!sessionId) return;

    try {
      log.info({ sessionId }, "sessionLifecycle:stopSession");

      // Cleanup session on backend
      await simulatorApi.deleteSession(sessionId);

      // Reset local state
      setSessionId(null);
      sessionIdRef.current = null;

      log.info({}, "sessionLifecycle:sessionStopped");
    } catch (error) {
      const err = error instanceof Error ? error : new Error("Failed to stop session");
      log.error(
        { err: serializeError(err) },
        "sessionLifecycle:stopSessionFailed"
      );
      // Still reset local state even if backend cleanup fails
      setSessionId(null);
      sessionIdRef.current = null;
    }
  }, [sessionId]);

  return {
    sessionId,
    sessionIdRef,
    isLoading,
    startSession,
    stopSession,
    bufferEvent,
    processPendingEvents,
  };
}

export type UseSessionLifecycleReturn = ReturnType<typeof useSessionLifecycle>;
