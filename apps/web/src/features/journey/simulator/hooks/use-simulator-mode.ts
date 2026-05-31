/**
 * useSimulatorMode - Hook for accessing simulator mode state
 *
 * Provides a clean interface for components to check the current simulator mode
 * without needing to access the raw store state or perform manual comparisons.
 *
 * @module features/simulator/hooks/use-simulator-mode
 */

import { useStore } from "@tanstack/react-store";

import { simulatorStore, type SimulatorMode } from "../store";

export interface SimulatorModeState {
  /** Current simulator mode */
  mode: SimulatorMode;

  /** True when simulator is not active (mode === 'inactive') */
  isInactive: boolean;

  /** True when in simulator mode - live simulation with running engine */
  isSimulatorMode: boolean;

  /** True when in playback mode - read-only session replay */
  isPlaybackMode: boolean;

  /** True when simulator is active (simulator or playback mode) */
  isActive: boolean;
}

/**
 * Hook to get the current simulator mode with derived boolean flags.
 *
 * This replaces scattered `playback?.isReadOnly` checks throughout the codebase
 * with a single, explicit mode check.
 *
 * @example
 * ```tsx
 * const { isPlaybackMode, isSimulatorMode } = useSimulatorMode();
 *
 * if (isPlaybackMode) {
 *   // Show playback controls
 * } else if (isSimulatorMode) {
 *   // Show simulator mode controls
 * }
 * ```
 */
export function useSimulatorMode(): SimulatorModeState {
  const mode = useStore(simulatorStore, (s) => s.mode);

  return {
    mode,
    isInactive: mode === "inactive",
    isSimulatorMode: mode === "simulator",
    isPlaybackMode: mode === "playback",
    isActive: mode !== "inactive",
  };
}
