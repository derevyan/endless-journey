/**
 * useAudioRecorder Hook
 *
 * Provides audio recording functionality using MediaRecorder API.
 * Optimized for push-to-talk voice input with audio level monitoring.
 *
 * @module hooks/audio/use-audio-recorder
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { createLogger } from "@journey/logger";
import {
  getSupportedMimeType,
  getExtensionFromMimeType,
  calculateAudioLevel,
  smoothAudioLevel,
} from "@/shared/lib/audio-utils";
import { appConfig } from "@/shared/lib/app-config";

const log = createLogger("audio:recorder");

// =============================================================================
// TYPES
// =============================================================================

export interface UseAudioRecorderOptions {
  /** Callback when recording completes */
  onRecordingComplete?: (blob: Blob) => void;
  /** Callback when recording is cancelled */
  onRecordingCancelled?: () => void;
  /** Enable audio level monitoring (default: true) */
  enableAudioLevel?: boolean;
  /** Maximum recording duration in ms (default: from appConfig.audio.maxRecordingDuration) */
  maxDuration?: number;
}

export interface UseAudioRecorderResult {
  /** Whether currently recording */
  isRecording: boolean;
  /** Recording duration in seconds */
  duration: number;
  /** Audio level (0-1) for visual feedback */
  audioLevel: number;
  /** Any error that occurred */
  error: string | null;
  /** MediaRecorder instance for visualization */
  mediaRecorder: MediaRecorder | null;
  /** Start recording audio */
  startRecording: () => Promise<void>;
  /** Stop recording and return the audio blob */
  stopRecording: () => Promise<Blob | null>;
  /** Cancel recording without saving */
  cancelRecording: () => void;
}

// =============================================================================
// HOOK IMPLEMENTATION
// =============================================================================

export function useAudioRecorder(options: UseAudioRecorderOptions = {}): UseAudioRecorderResult {
  const {
    onRecordingComplete,
    onRecordingCancelled,
    enableAudioLevel = true,
    maxDuration = appConfig.audio.maxRecordingDuration,
  } = options;

  // State
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const maxDurationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTimeRef = useRef<number>(0);
  const mimeTypeRef = useRef<string>("");
  const isCancelledRef = useRef(false);
  const isRecordingRef = useRef(false);

  // Cleanup function
  const cleanup = useCallback(() => {
    // Stop animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Stop duration interval
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    // Clear max duration timeout
    if (maxDurationTimeoutRef.current) {
      clearTimeout(maxDurationTimeoutRef.current);
      maxDurationTimeoutRef.current = null;
    }

    // Stop media stream tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    // Close audio context
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => {
        // Ignore close errors
      });
      audioContextRef.current = null;
    }

    analyserRef.current = null;
    dataArrayRef.current = null;
    mediaRecorderRef.current = null;
    isRecordingRef.current = false;
  }, []);

  // Update audio level visualization
  const updateAudioLevel = useCallback(() => {
    if (!analyserRef.current || !dataArrayRef.current || !isRecordingRef.current) {
      return;
    }

    const rawLevel = calculateAudioLevel(analyserRef.current, dataArrayRef.current);
    setAudioLevel((prev) => smoothAudioLevel(prev, rawLevel, 0.3));

    animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
  }, []);

  // Stop recording and return blob
  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    if (!mediaRecorderRef.current || !isRecording) {
      return null;
    }

    return new Promise((resolve) => {
      const mediaRecorder = mediaRecorderRef.current!;

      mediaRecorder.onstop = () => {
        if (isCancelledRef.current) {
          cleanup();
          resolve(null);
          return;
        }

        const extension = getExtensionFromMimeType(mimeTypeRef.current);
        const blob = new Blob(audioChunksRef.current, {
          type: mimeTypeRef.current || "audio/webm",
        });

        const finalDuration = (Date.now() - startTimeRef.current) / 1000;
        log.info({ size: blob.size, duration: finalDuration, extension }, "audio:recorder:stopped");

        cleanup();
        setIsRecording(false);
        setAudioLevel(0);

        onRecordingComplete?.(blob);
        resolve(blob);
      };

      mediaRecorder.stop();
    });
  }, [cleanup, isRecording, onRecordingComplete]);

  // Start recording
  const startRecording = useCallback(async () => {
    try {
      setError(null);
      isCancelledRef.current = false;
      audioChunksRef.current = [];

      log.debug({}, "audio:recorder:requestingPermission");

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      // Get supported MIME type
      mimeTypeRef.current = getSupportedMimeType();
      log.debug({ mimeType: mimeTypeRef.current }, "audio:recorder:mimeType");

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: mimeTypeRef.current || undefined,
      });
      mediaRecorderRef.current = mediaRecorder;

      // Set up audio level monitoring
      if (enableAudioLevel) {
        audioContextRef.current = new AudioContext();
        // Resume AudioContext if suspended (required by browsers after user gesture)
        if (audioContextRef.current.state === "suspended") {
          await audioContextRef.current.resume();
        }
        const source = audioContextRef.current.createMediaStreamSource(stream);
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 256;
        analyserRef.current.smoothingTimeConstant = 0.3;
        source.connect(analyserRef.current);
        // Note: Don't connect to destination - that would play mic through speakers
        dataArrayRef.current = new Uint8Array(analyserRef.current.frequencyBinCount);
      }

      // Handle data available
      mediaRecorder.ondataavailable = (event) => {
        log.debug({ chunkSize: event.data.size }, "audio:recorder:dataAvailable");
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      // Start recording - collect all data on stop for proper webm format
      mediaRecorder.start();
      startTimeRef.current = Date.now();
      isRecordingRef.current = true;
      setIsRecording(true);
      setDuration(0);
      setAudioLevel(0);

      log.info({}, "audio:recorder:started");

      // Start duration tracking
      durationIntervalRef.current = setInterval(() => {
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        setDuration(elapsed);
      }, 100);

      // Start audio level monitoring
      if (enableAudioLevel) {
        animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
      }

      // Set max duration timeout
      maxDurationTimeoutRef.current = setTimeout(() => {
        log.warn({ maxDuration }, "audio:recorder:maxDurationReached");
        stopRecording();
      }, maxDuration);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to start recording";
      log.error({ err }, "audio:recorder:startError");

      if (message.includes("Permission denied") || message.includes("NotAllowedError")) {
        setError("Microphone access denied. Please allow microphone access.");
      } else {
        setError(message);
      }

      cleanup();
    }
  }, [cleanup, enableAudioLevel, maxDuration, stopRecording, updateAudioLevel]);

  // Cancel recording
  const cancelRecording = useCallback(() => {
    if (!isRecording) {
      return;
    }

    log.debug({}, "audio:recorder:cancelled");
    isCancelledRef.current = true;

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    } else {
      cleanup();
    }

    setIsRecording(false);
    setDuration(0);
    setAudioLevel(0);
    onRecordingCancelled?.();
  }, [cleanup, isRecording, onRecordingCancelled]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    isRecording,
    duration,
    audioLevel,
    error,
    mediaRecorder: mediaRecorderRef.current,
    startRecording,
    stopRecording,
    cancelRecording,
  };
}
