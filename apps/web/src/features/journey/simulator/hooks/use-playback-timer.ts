/**
 * usePlaybackTimer - Auto-playback timer for session replay
 *
 * Handles automatic advancement through interactions based on playback speed.
 * Pauses at end of session and cleans up on unmount.
 *
 * @module features/simulator/hooks/use-playback-timer
 */

import { useStore } from "@tanstack/react-store";
import { useCallback, useEffect, useRef } from "react";

import { createLogger, serializeError } from "@journey/logger";

import { simulatorActions, simulatorStore } from "../store";

const log = createLogger("use-playback-timer");

// Base interval in ms (for 1x speed)
const BASE_INTERVAL_MS = 2000;

export function usePlaybackTimer() {
  const isPlaying = useStore(simulatorStore, (state) => state.playback.isPlaying);
  const playbackSpeed = useStore(simulatorStore, (state) => state.playback.playbackSpeed);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Stable callback that reads current state inside
  const advancePlayback = useCallback(() => {
    try {
      const state = simulatorStore.state;
      const { playbackIndex, totalInteractions } = state.playback;

      // Check if at end
      if (playbackIndex >= totalInteractions - 1) {
        simulatorActions.setIsPlaying(false);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        return;
      }

      simulatorActions.playbackNext();
    } catch (error) {
      // Log error and stop playback to prevent infinite error loop
      log.error({ err: serializeError(error) }, "playback:advanceFailed");

      // Stop playback to prevent the interval from continuing to fail
      simulatorActions.setIsPlaying(false);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Don't start if not playing
    if (!isPlaying) {
      return;
    }

    // Calculate interval based on speed
    // 0.5x = 4000ms, 1x = 2000ms, 2x = 1000ms
    const intervalMs = BASE_INTERVAL_MS / playbackSpeed;

    // Start the interval - only recreated when isPlaying or playbackSpeed changes
    intervalRef.current = setInterval(advancePlayback, intervalMs);

    // Cleanup on unmount or when dependencies change
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isPlaying, playbackSpeed, advancePlayback]);
}
