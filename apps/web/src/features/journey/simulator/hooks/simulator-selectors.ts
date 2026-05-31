/**
 * Simulator Selectors - Granular state access for simulator
 *
 * These hooks provide focused access to specific slices of simulator state,
 * preventing unnecessary re-renders when only specific data is needed.
 *
 * Pattern: Instead of `useSimulator()` which returns 20+ values and subscribes
 * to everything, use these focused hooks for better render performance.
 *
 * @module features/simulator/hooks/simulator-selectors
 */

import { useStore } from "@tanstack/react-store";
import { simulatorActions, simulatorStore, selectIsActive } from "../store";

// ============================================================================
// Selectors - Pure functions for extracting state slices
// ============================================================================

export const simulatorSelectors = {
  /** Session active state (derived from mode) */
  isActive: selectIsActive,

  /** All messages */
  messages: (state: typeof simulatorStore.state) => state.messages,

  /** Active timer (if any) */
  activeTimer: (state: typeof simulatorStore.state) => state.activeTimer,

  /** Current session info */
  session: (state: typeof simulatorStore.state) => state.session,

  /** Event log */
  eventLog: (state: typeof simulatorStore.state) => state.eventLog,

  /** Chat input state */
  chatState: (state: typeof simulatorStore.state) => state.chatState,

  /** Playback state */
  playback: (state: typeof simulatorStore.state) => state.playback,

  /** Pending follow-ups */
  pendingFollowUps: (state: typeof simulatorStore.state) => state.pendingFollowUps,

  /** Combined session state */
  sessionState: (state: typeof simulatorStore.state) => ({
    isActive: selectIsActive(state),
    messages: state.messages,
    activeTimer: state.activeTimer,
    session: state.session,
    eventLog: state.eventLog,
    chatState: state.chatState,
  }),

  /** Combined playback state */
  playbackState: (state: typeof simulatorStore.state) => ({
    playback: state.playback,
    isPlaying: state.playback?.isPlaying ?? false,
    playbackIndex: state.playback?.playbackIndex ?? 0,
    playbackSpeed: state.playback?.playbackSpeed ?? 1,
  }),
};

// ============================================================================
// Focused Hooks - For components that only need specific state
// ============================================================================

/**
 * Hook for session active state only.
 * Use when you only need to know if simulator is running.
 */
export function useSimulatorActive() {
  return useStore(simulatorStore, simulatorSelectors.isActive);
}

/**
 * Hook for messages only.
 * Use in chat components that only display messages.
 */
export function useSimulatorMessages() {
  return useStore(simulatorStore, simulatorSelectors.messages);
}

/**
 * Hook for active timer only.
 * Use in timer display components.
 */
export function useSimulatorActiveTimer() {
  return useStore(simulatorStore, simulatorSelectors.activeTimer);
}

/**
 * Hook for event log only.
 * Use in console/event log components.
 */
export function useSimulatorEventLog() {
  return useStore(simulatorStore, simulatorSelectors.eventLog);
}

/**
 * Hook for playback state + controls.
 * Use in playback control components.
 *
 * Returns state and stable action references.
 */
export function useSimulatorPlayback() {
  const playbackState = useStore(simulatorStore, simulatorSelectors.playbackState);

  return {
    // State
    ...playbackState,

    // Actions (already stable references)
    playbackNext: simulatorActions.playbackNext,
    playbackPrevious: simulatorActions.playbackPrevious,
    setPlaybackIndex: simulatorActions.setPlaybackIndex,
    togglePlayback: simulatorActions.togglePlayback,
    setPlaybackSpeed: simulatorActions.setPlaybackSpeed,
    stopPlayback: simulatorActions.stopPlayback,
  };
}

/**
 * Hook for combined session state (no controls).
 * Use when you need to read session state but don't need to control it.
 */
export function useSimulatorSessionState() {
  return useStore(simulatorStore, simulatorSelectors.sessionState);
}

/**
 * Hook for chat state only.
 * Use in chat input components.
 */
export function useSimulatorChatState() {
  return useStore(simulatorStore, simulatorSelectors.chatState);
}
