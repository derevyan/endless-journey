/**
 * Simulator Utilities
 *
 * @module features/simulator/lib
 */

export {
  deduplicateEvents,
  mergeEventLogs,
  createEventId,
  MAX_EVENT_LOG_SIZE,
} from "./event-utils";

export {
  simulatorApi,
  SimulatorApiError,
  isSimulatorApiError,
  type CreateSessionRequest,
  type CreateSessionResponse,
  type ExecuteEventRequest,
  type SimulatorInputEvent,
} from "./simulator-api-client";

export {
  isTimerScheduledPayload,
  isTimerFiredPayload,
  isTimerCancelledPayload,
  isMessagePayload,
  isTransitionPayload,
  isInteractionPayload,
  getNodeIdFromPayload,
  type TimerScheduledPayload,
  type TimerFiredPayload,
  type TimerCancelledPayload,
  type MessagePayload,
  type TransitionPayload,
  type InteractionPayload,
} from "./event-validators";

export {
  sessionDetailToEnhancedJourney,
  replayUpToIndex,
  getAllMessages,
  getNodeAtIndex,
  getInteractionAt,
  getMessageIndexForInteraction,
  formatInteractionTime,
  getInteractionTypeLabel,
  clearReplayCache,
  type PlaybackMessage,
  type ReplayCalculationState,
  type NodeWithButtons,
} from "./session-replay";

export { telegramToMarkdown } from "./telegram-markdown";
