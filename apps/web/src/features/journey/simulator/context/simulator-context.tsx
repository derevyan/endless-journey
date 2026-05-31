/**
 * Simulator Context
 *
 * Provides simulator state and actions to child components via React Context.
 * Eliminates prop drilling from UnifiedLayout → JourneyChat/SimulatorControls.
 *
 * Backend-only mode: Runs SessionEngine on server for 100% production parity.
 *
 * @module features/simulator/context/simulator-context
 */

import { createContext, useContext, useMemo, type ReactNode } from "react";

import type { SimulatorDebugState } from "@journey/schemas";

import { useBackendSimulator } from "../hooks/use-backend-simulator";
import { usePlaybackTimer } from "../hooks/use-playback-timer";

/**
 * Type representing all simulator state and actions.
 * Derived from the useBackendSimulator hook return type.
 */
export type SimulatorContextValue = ReturnType<typeof useBackendSimulator>;

/**
 * Context for simulator state and actions.
 * null when used outside of SimulatorProvider.
 */
const SimulatorContext = createContext<SimulatorContextValue | null>(null);

interface SimulatorProviderProps {
  children: ReactNode;
  /**
   * Journey ID for the simulator session.
   */
  journeyId: string;
  /**
   * Optional error handler for simulator errors.
   */
  onError?: (error: Error) => void;
}

/**
 * Provider component that creates simulator instance and provides it to children.
 *
 * The simulator runs on the backend server providing:
 * - 100% production parity (same engine, same DB, same timers)
 * - Debug superpowers (_debug state in every event)
 * - Session persistence (survives page refresh)
 * - Skip timer (time travel using real timer infrastructure)
 *
 * @example
 * ```tsx
 * <SimulatorProvider journeyId={journeyId}>
 *   <JourneyChat />
 *   <SimulatorControls />
 * </SimulatorProvider>
 * ```
 */
export function SimulatorProvider({
  children,
  journeyId,
  onError,
}: SimulatorProviderProps) {
  const simulator = useBackendSimulator({
    journeyId,
    onError,
  });

  // Enable auto-playback for session replay (impersonation mode)
  usePlaybackTimer();

  // Memoize context value to prevent unnecessary consumer re-renders.
  // Note: Only include state values that change. Callbacks from useCallback are stable
  // and don't need to be in the dependency array.
  const contextValue = useMemo(() => simulator, [simulator]);

  return <SimulatorContext.Provider value={contextValue}>{children}</SimulatorContext.Provider>;
}

/**
 * Hook to access simulator context.
 * Must be used within a SimulatorProvider.
 *
 * @throws Error if used outside SimulatorProvider
 *
 * @example
 * ```tsx
 * function ChatComponent() {
 *   const { messages, sendMessage, isActive } = useSimulatorContext();
 *   // Use simulator state and actions directly
 * }
 * ```
 */
export function useSimulatorContext(): SimulatorContextValue {
  const context = useContext(SimulatorContext);
  if (!context) {
    throw new Error("useSimulatorContext must be used within a SimulatorProvider");
  }
  return context;
}

/**
 * Optional hook that returns null instead of throwing when used outside provider.
 * Useful for components that may or may not be within a simulator context.
 */
export function useSimulatorContextOptional(): SimulatorContextValue | null {
  return useContext(SimulatorContext);
}

// Re-export types for convenience
export type { SimulatorDebugState };
