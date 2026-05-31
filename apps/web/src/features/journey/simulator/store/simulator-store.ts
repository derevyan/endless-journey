import { Store } from "@tanstack/react-store";

import type { JourneyMessage } from "@journey/schemas";
import { EventTypes, type EnhancedUserJourney, type InteractionEvent } from "@journey/schemas";

import { appConfig } from "@/shared/lib/app-config";
import { storeEventBus } from "@/stores/store-event-bus";
import { deduplicateEvents, mergeEventLogs } from "../lib/event-utils";
import { EventBatcher } from "../lib/event-batcher";
import { clearReplayCache } from "../lib/session-replay";
import { clearStateCache } from "../lib/state-reconstruction";

export type ChatState = "idle" | "waiting_for_user" | "processing" | "timer_active" | "completed";

/**
 * Explicit simulator mode enum.
 * - 'inactive': Simulator not running
 * - 'simulator': Live simulator mode with running engine
 * - 'playback': Read-only session replay
 */
export type SimulatorMode = "inactive" | "simulator" | "playback";

// =============================================================================
// EVENT BATCHING
// =============================================================================

/**
 * Module-level event batcher to handle rapid event additions.
 * Only the final merged eventLog triggers subscribers.
 */
const eventBatcher = new EventBatcher((events) => {
  simulatorStore.setState((state) => ({
    ...state,
    eventLog: mergeEventLogs(state.eventLog, events),
  }));
});

// Playback state for session replay
export interface PlaybackState {
  isReadOnly: boolean;
  playbackIndex: number;
  isPlaying: boolean;
  playbackSpeed: number; // 0.5, 1, 2
  totalInteractions: number;
  // Note: Messages are computed on-demand via replayUpToIndex() in JourneyChat
  impersonatedUser: {
    id: string;
    name: string;
  } | null;
}

/**
 * Pending follow-up timer info
 */
export interface PendingFollowUp {
  timerId: string;
  nodeId: string;
  stepIndex: number;
  totalSteps: number;
  durationMs: number;
  startTime: number;
}

interface SimulatorState {
  mode: SimulatorMode;
  session: EnhancedUserJourney | null;
  /** Selected persona ID for simulator sessions (null = anonymous mode) */
  selectedPersonaId: string | null;
  messages: Array<{
    id: string;
    message: JourneyMessage;
    timestamp: Date;
    from: "bot" | "user";
  }>;
  activeTimer: {
    id: string;
    durationMs: number;
    startTime: number;
  } | null;
  /** Pending follow-up timers for current node */
  pendingFollowUps: PendingFollowUp[];
  eventLog: InteractionEvent[];
  chatState: ChatState;
  // Playback state
  playback: PlaybackState;
}

const initialPlaybackState: PlaybackState = {
  isReadOnly: false,
  playbackIndex: 0,
  isPlaying: false,
  playbackSpeed: 1,
  totalInteractions: 0,
  impersonatedUser: null,
};

const initialState: SimulatorState = {
  mode: "inactive",
  session: null,
  selectedPersonaId: null,
  messages: [],
  activeTimer: null,
  pendingFollowUps: [],
  eventLog: [],
  chatState: "idle",
  playback: initialPlaybackState,
};

// =============================================================================
// HMR-SAFE STORE CREATION
// =============================================================================

declare global {
   
  var __simulatorStore: Store<SimulatorState> | undefined;
}

function getOrCreateStore(): Store<SimulatorState> {
  if (typeof globalThis.__simulatorStore !== "undefined") {
    return globalThis.__simulatorStore;
  }
  const store = new Store(initialState);
  if (import.meta.env.DEV) {
    globalThis.__simulatorStore = store;
  }
  return store;
}

export const simulatorStore = getOrCreateStore();

// Helper function to extract nodeId from an interaction
function getNodeIdFromInteraction(interaction: InteractionEvent): string | null {
  if (interaction.type === EventTypes.ENGINE_TRANSITION) {
    const payload = interaction.payload as { to?: string };
    return payload?.to || interaction.nodeId;
  }
  return interaction.nodeId;
}

/**
 * Helper to update session's currentNodeId based on interaction at given index
 * Returns the updated session or original if no update needed
 */
function updateSessionNodeFromIndex(session: EnhancedUserJourney | null, eventLog: InteractionEvent[], index: number): EnhancedUserJourney | null {
  if (!session || !eventLog[index]) return session;
  const nodeId = getNodeIdFromInteraction(eventLog[index]);
  return nodeId ? { ...session, currentNodeId: nodeId } : session;
}

/**
 * Compute the appropriate ChatState based on current simulator state.
 *
 * Priority order:
 * 1. completed - session has ended
 * 2. timer_active - a timer is currently running
 * 3. waiting_for_user - last message was from bot
 * 4. processing - engine is working (default)
 */
function computeChatState(
  session: EnhancedUserJourney | null,
  activeTimer: SimulatorState["activeTimer"],
  messages: SimulatorState["messages"]
): ChatState {
  // Completed takes highest priority
  if (session?.status === "completed") {
    return "completed";
  }

  // Active timer takes precedence
  if (activeTimer) {
    return "timer_active";
  }

  // Check last message to determine state
  const lastMessage = messages[messages.length - 1];
  if (lastMessage?.from === "bot") {
    return "waiting_for_user";
  }

  return "processing";
}

export const simulatorActions = {
  /**
   * Set the selected persona ID for simulator sessions.
   * This persists across session starts/stops.
   */
  setSelectedPersonaId: (personaId: string | null) => {
    simulatorStore.setState((state) => ({
      ...state,
      selectedPersonaId: personaId,
    }));
  },

  startSession: (session: EnhancedUserJourney) => {
    simulatorStore.setState((state) => ({
      ...state,
      mode: "simulator",
      session,
      messages: [],
      activeTimer: null,
      pendingFollowUps: [],
      eventLog: [],
      chatState: "processing",
    }));
  },

  stopSession: () => {
    // Flush any pending events before clearing
    eventBatcher.flushNow();
    // Clear the event queue
    eventBatcher.clear();

    simulatorStore.setState((state) => ({
      ...state,
      mode: "inactive",
      session: null,
      messages: [],
      activeTimer: null,
      pendingFollowUps: [],
      eventLog: [],
      chatState: "idle",
      playback: initialPlaybackState,
    }));
  },

  addMessage: (message: JourneyMessage, from: "bot" | "user") => {
    simulatorStore.setState((state) => {
      const newMessages = [
        ...state.messages,
        {
          id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
          message,
          timestamp: new Date(),
          from,
        },
      ];

      return {
        ...state,
        messages: newMessages,
        chatState: computeChatState(state.session, state.activeTimer, newMessages),
      };
    });
  },

  setActiveTimer: (timer: { id: string; durationMs: number; startTime: number } | null) => {
    simulatorStore.setState((state) => ({
      ...state,
      activeTimer: timer,
      chatState: computeChatState(state.session, timer, state.messages),
    }));
  },

  // ===========================================================================
  // FOLLOW-UP TIMER ACTIONS
  // ===========================================================================

  /**
   * Add a pending follow-up timer to the store.
   * Called when engine schedules a follow-up step.
   */
  addPendingFollowUp: (followUp: PendingFollowUp) => {
    simulatorStore.setState((state) => ({
      ...state,
      pendingFollowUps: [...state.pendingFollowUps, followUp],
    }));
  },

  /**
   * Remove a specific follow-up timer by ID.
   * Called when a follow-up fires or is cancelled.
   */
  removePendingFollowUp: (timerId: string) => {
    simulatorStore.setState((state) => ({
      ...state,
      pendingFollowUps: state.pendingFollowUps.filter((f) => f.timerId !== timerId),
    }));
  },

  /**
   * Clear all pending follow-up timers for a node.
   * Called when user responds (cancelling the sequence).
   */
  clearFollowUpsForNode: (nodeId: string) => {
    simulatorStore.setState((state) => ({
      ...state,
      pendingFollowUps: state.pendingFollowUps.filter((f) => f.nodeId !== nodeId),
    }));
  },

  /**
   * Clear all pending follow-up timers.
   * Called on session reset/stop.
   */
  clearAllFollowUps: () => {
    simulatorStore.setState((state) => ({
      ...state,
      pendingFollowUps: [],
    }));
  },

  updateSession: (session: EnhancedUserJourney) => {
    simulatorStore.setState((state) => {
      // Compute chat state using shared helper
      const newChatState = computeChatState(session, state.activeTimer, state.messages);

      // Only update event log from session history if it has events,
      // otherwise keep existing eventLog (e.g., from random run which adds events directly)
      const newEventLog = session.history.length > 0 ? deduplicateEvents([...session.history]) : state.eventLog;

      // Sync pendingFollowUps with two-layer filtering:
      // 1. Clear follow-ups when node changes (timing-independent, semantically correct)
      // 2. Filter by timerId as safety net (catches remaining edge cases)
      const previousNodeId = state.session?.currentNodeId;
      const newNodeId = session.currentNodeId;
      let syncedFollowUps = state.pendingFollowUps;

      // Layer 1: When transitioning to a new node, clear follow-ups for the old node
      if (previousNodeId && previousNodeId !== newNodeId) {
        syncedFollowUps = syncedFollowUps.filter((f) => f.nodeId !== previousNodeId);
      }

      // Layer 2: Keep only entries that still exist in engine session (by timerId)
      const activeTimerIds = new Set(session.pendingPluginFollowUps.map((f) => f.timerId));
      syncedFollowUps = syncedFollowUps.filter((f) => activeTimerIds.has(f.timerId));

      return {
        ...state,
        session,
        pendingFollowUps: syncedFollowUps,
        eventLog: newEventLog,
        chatState: newChatState,
      };
    });
  },

  /**
   * Add an event to the log using batched updates.
   * Events are queued and flushed on the next animation frame for performance.
   */
  addEvent: (event: InteractionEvent) => {
    eventBatcher.add(event);
  },

  /**
   * Add an event immediately without batching.
   * Use this when you need the event to be visible synchronously.
   */
  addEventImmediate: (event: InteractionEvent) => {
    // Flush any pending events first
    eventBatcher.flushNow();

    simulatorStore.setState((state) => ({
      ...state,
      eventLog: mergeEventLogs(state.eventLog, [event]),
    }));
  },

  clearEventLog: () => {
    // Clear pending events as well
    eventBatcher.clear();

    // Clear state reconstruction cache before clearing event log
    const currentEvents = simulatorStore.state.eventLog;
    if (currentEvents.length > 0) {
      clearStateCache(currentEvents);
    }

    simulatorStore.setState((state) => ({
      ...state,
      eventLog: [],
    }));
  },

  updateCurrentNode: (nodeId: string) => {
    simulatorStore.setState((state) => ({
      ...state,
      session: state.session ? { ...state.session, currentNodeId: nodeId } : null,
    }));
  },

  setChatState: (chatState: ChatState) => {
    simulatorStore.setState((state) => ({ ...state, chatState }));
  },

  /**
   * Reset store to initial state (used on logout/user change)
   */
  reset: () => {
    // Clear pending events
    eventBatcher.clear();

    // Clear replay cache to prevent memory leaks
    clearReplayCache();

    simulatorStore.setState(() => initialState);
  },

  /**
   * Flush any pending batched events immediately.
   * Useful for testing to ensure all events are visible synchronously.
   */
  flushPendingEvents: () => {
    eventBatcher.flushNow();
  },

  // ===========================================================================
  // PLAYBACK ACTIONS
  // ===========================================================================

  /**
   * Initialize playback mode with session data
   */
  startPlayback: (params: {
    session: EnhancedUserJourney;
    totalInteractions: number;
    impersonatedUser: { id: string; name: string };
  }) => {
    // Update frontend state
    simulatorStore.setState((state) => ({
      ...state,
      mode: "playback",
      session: params.session,
      messages: [],
      activeTimer: null,
      eventLog: deduplicateEvents([...params.session.history]),
      chatState: "completed", // Playback is always "completed" state
      playback: {
        isReadOnly: true,
        playbackIndex: 0,
        isPlaying: false,
        playbackSpeed: appConfig.simulator.playback.defaultSpeed,
        totalInteractions: params.totalInteractions,
        impersonatedUser: params.impersonatedUser,
      },
    }));
  },

  /**
   * Set playback index (seek to position)
   */
  setPlaybackIndex: (index: number) => {
    simulatorStore.setState((state) => {
      const maxIndex = Math.max(0, state.playback.totalInteractions - 1);
      const clampedIndex = Math.max(0, Math.min(index, maxIndex));

      return {
        ...state,
        session: updateSessionNodeFromIndex(state.session, state.eventLog, clampedIndex),
        playback: {
          ...state.playback,
          playbackIndex: clampedIndex,
        },
      };
    });
  },

  /**
   * Move to next interaction
   */
  playbackNext: () => {
    simulatorStore.setState((state) => {
      const nextIndex = state.playback.playbackIndex + 1;
      const maxIndex = state.playback.totalInteractions - 1;

      // If at end, stop playing
      if (nextIndex > maxIndex) {
        return {
          ...state,
          playback: {
            ...state.playback,
            isPlaying: false,
          },
        };
      }

      return {
        ...state,
        session: updateSessionNodeFromIndex(state.session, state.eventLog, nextIndex),
        playback: {
          ...state.playback,
          playbackIndex: nextIndex,
        },
      };
    });
  },

  /**
   * Move to previous interaction
   */
  playbackPrevious: () => {
    simulatorStore.setState((state) => {
      const prevIndex = Math.max(0, state.playback.playbackIndex - 1);

      return {
        ...state,
        session: updateSessionNodeFromIndex(state.session, state.eventLog, prevIndex),
        playback: {
          ...state.playback,
          playbackIndex: prevIndex,
        },
      };
    });
  },

  /**
   * Toggle play/pause
   */
  togglePlayback: () => {
    simulatorStore.setState((state) => {
      // Don't start playing if at end
      if (!state.playback.isPlaying && state.playback.playbackIndex >= state.playback.totalInteractions - 1) {
        return state;
      }

      return {
        ...state,
        playback: {
          ...state.playback,
          isPlaying: !state.playback.isPlaying,
        },
      };
    });
  },

  /**
   * Set playing state directly
   */
  setIsPlaying: (isPlaying: boolean) => {
    simulatorStore.setState((state) => ({
      ...state,
      playback: {
        ...state.playback,
        isPlaying,
      },
    }));
  },

  /**
   * Set playback speed
   */
  setPlaybackSpeed: (speed: number) => {
    simulatorStore.setState((state) => ({
      ...state,
      playback: {
        ...state.playback,
        playbackSpeed: speed,
      },
    }));
  },

  /**
   * Stop playback mode and return to normal simulator state
   */
  stopPlayback: () => {
    // Clear replay cache to prevent memory leaks
    clearReplayCache();

    simulatorStore.setState((state) => ({
      ...state,
      mode: "inactive",
      session: null,
      messages: [],
      activeTimer: null,
      eventLog: [],
      chatState: "idle",
      playback: initialPlaybackState,
    }));
  },
};

// =============================================================================
// SELECTORS
// =============================================================================

/**
 * Selector to check if simulator is active (running or in playback mode).
 * Use this instead of checking `state.isActive` directly.
 */
export const selectIsActive = (state: SimulatorState): boolean =>
  state.mode !== "inactive";

// =============================================================================
// EVENT SUBSCRIPTIONS (with cleanup for HMR)
// =============================================================================

/**
 * Store subscription cleanup functions for HMR and testing.
 */
const simulatorStoreCleanupFunctions: (() => void)[] = [];

/**
 * Setup store event subscriptions.
 */
function setupSimulatorStoreSubscriptions(): void {
  // Clear any existing subscriptions first (HMR safety)
  cleanupSimulatorStoreSubscriptions();

  // Reset simulator when user logs out
  simulatorStoreCleanupFunctions.push(
    storeEventBus.on("user:loggedOut", () => {
      simulatorActions.reset();
    })
  );
}

/**
 * Cleanup simulator store subscriptions.
 * Called during HMR disposal and can be used in tests.
 */
export function cleanupSimulatorStoreSubscriptions(): void {
  simulatorStoreCleanupFunctions.forEach((fn) => fn());
  simulatorStoreCleanupFunctions.length = 0;
}

// Initialize subscriptions
setupSimulatorStoreSubscriptions();

// HMR cleanup: Dispose subscriptions before module is replaced
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    cleanupSimulatorStoreSubscriptions();
  });
}
