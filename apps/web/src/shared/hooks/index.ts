/**
 * Shared Hooks
 * @module shared/hooks
 */
export { useDebounce } from "./use-debounce";
export { useDebouncedHover } from "./use-debounced-hover";
export { useDialogState, useSimpleDialogState } from "./use-dialog-state";
export { useIsMobile } from "./use-mobile";
export { useSignOut } from "./use-sign-out";

// SSE connection hook
export {
  useSSEConnection,
  type SSEConnectionConfig,
  type SSEConnectionStatus,
  type UseSSEConnectionOptions,
  type UseSSEConnectionResult,
} from "./use-sse-connection";

// Event stream hook (built on SSE connection)
export {
  useEventStream,
  type UseEventStreamOptions,
  type UseEventStreamResult,
} from "./use-event-stream";

// Audio hooks
export {
  useAudioRecorder,
  useAudioPlayer,
  useVoiceChat,
  type UseAudioRecorderOptions,
  type UseAudioRecorderResult,
  type UseAudioPlayerOptions,
  type UseAudioPlayerResult,
  type UseVoiceChatOptions,
  type UseVoiceChatResult,
  type VoiceChatStatus,
} from "./audio";

// Form field hooks (Phase 4: Pluggable Feature System)
export { useDurationField, type DurationFieldState } from "./use-duration-field";

// Navigation protection
export {
  useUnsavedChangesProtection,
  type UseUnsavedChangesProtectionOptions,
  type UseUnsavedChangesProtectionReturn,
} from "./use-unsaved-changes-protection";

// Variable tooltip state management
export {
  useVariableTooltip,
  type HoveredVariable,
  type UseVariableTooltipResult,
} from "./use-variable-tooltip";
