/**
 * Simulator Feature
 *
 * Central export for all simulator-related functionality.
 * Provides journey simulation, playback, and simulator capabilities.
 *
 * Uses backend-only mode for 100% production parity.
 *
 * @module features/simulator
 */

// Context - Primary API for simulator access
export {
  SimulatorProvider,
  useSimulatorContext,
  useSimulatorContextOptional,
  type SimulatorContextValue,
  type SimulatorDebugState,
} from "./context";

// Store - Authoritative source for shared types (PlaybackState, PendingFollowUp)
export { simulatorActions, simulatorStore, selectIsActive, type PendingFollowUp, type PlaybackState } from "./store";

// Hooks
export {
  usePlaybackTimer,
  useSimulatorMode,
  useSimulatorPath,
  useBackendSimulator,
  // Selectors for granular state access
  useSimulatorActive,
  useSimulatorMessages,
  useSimulatorActiveTimer,
  useSimulatorEventLog,
  useSimulatorPlayback,
  useSimulatorSessionState,
  useSimulatorChatState,
  simulatorSelectors,
  type SimulatorModeState,
  type SimulatorPath,
  type PendingTimerInfo,
} from "./hooks";

// Utilities
export {
  clearReplayCache,
  formatInteractionTime,
  getAllMessages,
  getInteractionAt,
  getInteractionTypeLabel,
  getMessageIndexForInteraction,
  getNodeAtIndex,
  replayUpToIndex,
  sessionDetailToEnhancedJourney,
  type PlaybackMessage,
  type ReplayCalculationState,
} from "./lib";

// Components
export {
  ChatBubble,
  ChatInput,
  ConsolePanelContainer,
  EventLogPanel,
  JourneyChat,
  NoChatMessages,
  PlaybackControls,
  ProcessingIndicator,
  SimulatorControls,
  TimerDisplay,
  WaitingForUserIndicator,
  type ActiveTimer,
  type ChatBubbleProps,
  type ChatInputProps,
  type ChatState,
  type JourneyChatMessage,
  type JourneyChatProps,
} from "./components";
