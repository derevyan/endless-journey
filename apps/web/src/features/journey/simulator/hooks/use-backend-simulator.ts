/**
 * Backend Simulator Hook
 *
 * Provides a "remote control" interface to the backend SessionEngine.
 * The engine runs on the server with real DB callbacks and BullMQ timers,
 * while this hook sends commands and receives events via SSE.
 *
 * Key benefits over local simulator:
 * - 100% production parity (same engine, same DB, same timers)
 * - Debug superpowers (_debug state in every event)
 * - Session persistence (survives page refresh)
 * - Skip timer (time travel using real timer infrastructure)
 *
 * Architecture:
 * - useEventProcessor: Handles SSE event processing
 * - useSessionLifecycle: Manages session creation/cleanup
 * - This hook: Composes them together and provides public API
 *
 * @module features/simulator/hooks/use-backend-simulator
 */

import { useMemo, useCallback } from "react";
import { useStore } from "@tanstack/react-store";

import { createLogger, serializeError } from "@journey/logger";

import { API_URL, appConfig } from "@/shared/lib/app-config";
import { simulatorActions, simulatorStore, selectIsActive, type PendingFollowUp } from "../store";
import { simulatorApi } from "../lib/simulator-api-client";
import { shouldConnectEvent } from "../lib/event-constants";
import { useSSEConnection } from "@/shared/hooks";

import { useEventProcessor } from "./use-event-processor";
import { useSessionLifecycle } from "./use-session-lifecycle";
import type { SimulatorEvent } from "../lib/event-validators";

const log = createLogger("backend-simulator");

// =============================================================================
// TYPES
// =============================================================================

/** Pending timer info for skip timer functionality */
export interface PendingTimerInfo {
  edgeId: string;
  durationMs: number;
  scheduledAt: string;
}

interface UseBackendSimulatorOptions {
  journeyId: string;
  onError?: (error: Error) => void;
}

// =============================================================================
// HOOK
// =============================================================================

export function useBackendSimulator({ journeyId, onError }: UseBackendSimulatorOptions) {
  // Get state from simulator store (shared with local simulator)
  const storeState = useStore(simulatorStore);

  // Sub-hooks for event processing and session lifecycle
  const { processEvent, debugState } = useEventProcessor();

  const {
    isConnected,
    connect: connectSSE,
  } = useSSEConnection({
    url: `${API_URL}/api/events/stream`,
    onEvent: handleSSEEvent,
    onError,
    config: appConfig.simulator.sse,
  });

  const {
    sessionId,
    sessionIdRef,
    isLoading,
    startSession: startSessionInternal,
    stopSession: stopSessionInternal,
    bufferEvent,
    processPendingEvents,
  } = useSessionLifecycle({ journeyId, connectSSE, onError });

  // ===========================================================================
  // DERIVED STATE (Optimized with useMemo)
  // ===========================================================================

  /**
   * Derive pending timers from debug state
   * Single source of truth from backend, memoized to prevent re-renders
   */
  const pendingTimers: PendingTimerInfo[] = useMemo(
    () =>
      (debugState.pendingTimers ?? []).map((t) => ({
        edgeId: t.edgeId,
        durationMs: 0, // Backend doesn't send duration in debug state
        scheduledAt: t.firesAt,
      })),
    [debugState.pendingTimers]
  );

  /**
   * Derive pending follow-ups from debug state
   * Follow-up plugin stores its debug state under pluginStates.followup
   */
  const pendingFollowUps: PendingFollowUp[] = useMemo(() => {
    const followUpDebugState = (debugState.pluginStates?.followup ?? []) as Array<{
      timerId: string;
      parentNodeId: string;
      stepIndex: number;
      totalSteps: number;
      triggersAt: string;
    }>;

    return followUpDebugState.map((fu) => ({
      timerId: fu.timerId,
      nodeId: fu.parentNodeId,
      stepIndex: fu.stepIndex,
      totalSteps: fu.totalSteps,
      durationMs: Math.max(0, new Date(fu.triggersAt).getTime() - Date.now()),
      startTime: Date.now(),
    }));
  }, [debugState.pluginStates?.followup]);

  // ===========================================================================
  // SSE EVENT HANDLING
  // ===========================================================================

  /**
   * Handle raw SSE events by parsing and routing to event handler.
   * Filters for relevant event types only.
   */
  function handleSSEEvent(e: MessageEvent) {
    try {
      const event = JSON.parse(e.data) as SimulatorEvent;

      // Filter for events we care about
      if (shouldConnectEvent(event.type)) {
        handleSimulatorEvent(event);
      }
    } catch (parseError) {
      log.error({ err: serializeError(parseError) }, "backendSimulator:parseEventFailed");
    }
  }

  /**
   * Handle incoming simulator events with buffering for race condition.
   *
   * When SSE connects before session is created, events arrive before we
   * know the sessionId. We buffer these events and replay them once
   * the sessionId is set.
   */
  const handleSimulatorEvent = useCallback(
    (event: SimulatorEvent) => {
      // Get current sessionId at event processing time (not callback creation time)
      const currentSessionId = sessionIdRef.current;

      // If we don't have a sessionId yet, buffer the event for later
      if (!currentSessionId) {
        bufferEvent(event);
        return;
      }

      // Only process events for our session
      if (event.sessionId !== currentSessionId) {
        log.debug(
          {
            eventSessionId: event.sessionId,
            currentSessionId,
            eventType: event.type
          },
          "backendSimulator:ignoringEventForDifferentSession"
        );
        return;
      }

      // Process the event through the event processor
      processEvent(event);
    },
    [bufferEvent, processEvent, sessionIdRef]
  );

  // ===========================================================================
  // SESSION LIFECYCLE
  // ===========================================================================

  /**
   * Start a new simulator session
   * Creates a test client and journey session on the backend
   *
   * CRITICAL: SSE must be connected BEFORE creating the session!
   * The session creation triggers engine.start() which sends initial messages.
   * If SSE isn't connected yet, those messages are lost.
   *
   * @param startNodeId - Optional node to start from
   * @param personaId - Optional persona ID to reuse client identity
   */
  const startSession = useCallback(
    async (startNodeId?: string, personaId?: string) => {
      // 1. Start session on backend (SSE connects internally)
      const response = await startSessionInternal(startNodeId, personaId);

      // 2. Initialize simulator store (this clears messages/events arrays)
      // IMPORTANT: Must be called BEFORE processPendingEvents to avoid wiping messages!
      simulatorActions.startSession({
        sessionId: response.sessionId,
        userId: response.clientId,
        platformUserId: response.clientId,
        journeyId: response.journeyId,
        currentNodeId: response.currentNodeId,
        status: "active",
        context: {},
        tags: [],
        pendingTimers: [],
        pendingPluginFollowUps: [],
        nodeOutputs: {},
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completedAt: null,
        hasStarted: false,
        history: [],
      });

      // 3. NOW process buffered events (messages will persist in the initialized store)
      // These arrived via SSE before we knew the sessionId
      processPendingEvents(response.sessionId, processEvent);

      log.info({ sessionId: response.sessionId }, "backendSimulator:sessionStarted");
    },
    [startSessionInternal, processEvent, processPendingEvents]
  );

  /**
   * Stop and cleanup the current session
   * Note: SSE connection is kept alive for reuse by future sessions.
   * It will be automatically disconnected on component unmount.
   */
  const stopSession = useCallback(async () => {
    try {
      await stopSessionInternal();
      simulatorActions.stopSession();
    } catch {
      // Already logged by stopSessionInternal
      // Still reset local state even if backend cleanup fails
      simulatorActions.stopSession();
    }
  }, [stopSessionInternal]);

  // ===========================================================================
  // ACTIONS
  // ===========================================================================

  /**
   * Send a text message to the engine
   */
  const sendMessage = useCallback(
    async (text: string) => {
      if (!sessionId) {
        log.warn({}, "backendSimulator:sendMessage:noSession");
        return;
      }

      try {
        // Add user message to UI immediately
        simulatorActions.addMessage({ type: "text", content: text }, "user");

        // Send to backend
        await simulatorApi.executeEvent({
          sessionId,
          event: { type: "text", text },
        });

        log.debug({ sessionId, text }, "backendSimulator:messageSent");
      } catch (error) {
        const err = error instanceof Error ? error : new Error("Failed to send message");
        log.error({ err: serializeError(err) }, "backendSimulator:sendMessageFailed");
        onError?.(err);
      }
    },
    [sessionId, onError]
  );

  /**
   * Handle button click
   */
  const handleButtonClick = useCallback(
    async (buttonId: string, buttonText?: string) => {
      if (!sessionId) {
        log.warn({}, "backendSimulator:handleButtonClick:noSession");
        return;
      }

      try {
        // Add user action to UI immediately
        simulatorActions.addMessage({ type: "text", content: buttonText || buttonId }, "user");

        // Send to backend
        await simulatorApi.executeEvent({
          sessionId,
          event: { type: "button_click", buttonId },
        });

        log.debug({ sessionId, buttonId }, "backendSimulator:buttonClicked");
      } catch (error) {
        const err = error instanceof Error ? error : new Error("Failed to handle button click");
        log.error({ err: serializeError(err) }, "backendSimulator:handleButtonClickFailed");
        onError?.(err);
      }
    },
    [sessionId, onError]
  );

  /**
   * Skip the active timer (time travel!)
   * Forces the timer to fire immediately without waiting.
   * Uses the activeTimer from store state for compatibility with local simulator.
   *
   * Note: Captures timer ID at call time to prevent race conditions where
   * a different timer becomes active before the API call resolves.
   */
  const skipTimer = useCallback(() => {
    if (!sessionId) {
      log.warn({}, "backendSimulator:skipTimer:noSession");
      return;
    }

    const activeTimer = simulatorStore.state.activeTimer;
    if (!activeTimer) {
      log.warn({}, "backendSimulator:skipTimer:noActiveTimer");
      return;
    }

    // Capture IDs at call time to prevent race conditions
    const targetTimerId = activeTimer.id;
    const targetSessionId = sessionId;

    // Fire async but don't await (matches local simulator pattern)
    simulatorApi
      .skipTimer(targetTimerId, targetSessionId)
      .then(() => {
        // Only clear if the timer is still the same one we skipped
        const currentTimer = simulatorStore.state.activeTimer;
        if (currentTimer?.id === targetTimerId) {
          simulatorActions.setActiveTimer(null);
        }
        log.info(
          { sessionId: targetSessionId, edgeId: targetTimerId },
          "backendSimulator:timerSkipped"
        );
      })
      .catch((error) => {
        const err = error instanceof Error ? error : new Error("Failed to skip timer");
        log.error({ err: serializeError(err) }, "backendSimulator:skipTimerFailed");
        onError?.(err);
      });
  }, [sessionId, onError]);

  /**
   * Skip a specific timer by edge ID (backend-specific method)
   */
  const skipTimerByEdgeId = useCallback(
    async (edgeId: string) => {
      if (!sessionId) {
        log.warn({}, "backendSimulator:skipTimerByEdgeId:noSession");
        return;
      }

      try {
        await simulatorApi.skipTimer(edgeId, sessionId);
        simulatorActions.setActiveTimer(null);
        log.info({ sessionId, edgeId }, "backendSimulator:timerSkipped");
      } catch (error) {
        const err = error instanceof Error ? error : new Error("Failed to skip timer");
        log.error({ err: serializeError(err) }, "backendSimulator:skipTimerByEdgeIdFailed");
        onError?.(err);
      }
    },
    [sessionId, onError]
  );

  // ===========================================================================
  // CLEANUP & RETURN
  // ===========================================================================
  // Note: SSE cleanup on unmount is handled by useSSEConnection hook

  return {
    // Session state (from store for consistency)
    isActive: selectIsActive(storeState),
    messages: storeState.messages,
    activeTimer: storeState.activeTimer,
    currentSession: storeState.session,
    eventLog: storeState.eventLog,
    chatState: storeState.chatState,
    pendingFollowUps, // Derived from debug state (single source of truth from backend)
    playback: storeState.playback,

    // Persona state (from store)
    selectedPersonaId: storeState.selectedPersonaId,
    setSelectedPersonaId: simulatorActions.setSelectedPersonaId,

    // Backend-specific state
    sessionId,
    isConnected,
    isLoading,
    debugState,
    pendingTimers,

    // Session lifecycle
    startSession,
    stopSession,

    // User actions
    sendMessage,
    handleButtonClick,

    // Timer actions
    skipTimer,
    skipTimerByEdgeId,

    // Playback controls (direct from store actions)
    playbackNext: simulatorActions.playbackNext,
    playbackPrevious: simulatorActions.playbackPrevious,
    setPlaybackIndex: simulatorActions.setPlaybackIndex,
    togglePlayback: simulatorActions.togglePlayback,
    setPlaybackSpeed: simulatorActions.setPlaybackSpeed,
    stopPlayback: simulatorActions.stopPlayback,
  };
}
