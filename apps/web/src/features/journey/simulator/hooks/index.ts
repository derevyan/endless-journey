/**
 * Simulator Hooks
 *
 * Backend-only simulator mode for 100% production parity.
 *
 * @module features/simulator/hooks
 */

// Main backend simulator hook
export { useBackendSimulator, type PendingTimerInfo } from "./use-backend-simulator";
export type { SimulatorDebugState } from "@journey/schemas";

// Supporting hooks
export { useSimulatorMode, type SimulatorModeState } from "./use-simulator-mode";
export { usePlaybackTimer } from "./use-playback-timer";
export { useSimulatorPath, type SimulatorPath } from "./use-simulator-path";

// Persona hooks
export {
  usePersonas,
  usePersona,
  useCreatePersona,
  useDeletePersona,
  useResetPersona,
  useCleanupAllTestData,
  personaKeys,
  type Persona,
  type CreatePersonaRequest,
} from "./use-personas";

// Granular selectors for focused state access (prevents over-subscription)
export {
  simulatorSelectors,
  useSimulatorActive,
  useSimulatorMessages,
  useSimulatorActiveTimer,
  useSimulatorEventLog,
  useSimulatorPlayback,
  useSimulatorSessionState,
  useSimulatorChatState,
} from "./simulator-selectors";
