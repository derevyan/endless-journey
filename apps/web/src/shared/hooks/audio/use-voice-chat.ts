/**
 * useVoiceChat Hook
 *
 * Composition hook that combines audio recording, transcription, and TTS playback
 * for voice-enabled chat interactions.
 *
 * @module hooks/audio/use-voice-chat
 */

import { streamSpeech, transcribeAudio } from "@/shared/lib/api";
import { appConfig } from "@/shared/lib/app-config";
import { createLogger, serializeError } from "@journey/logger";
import type { VoiceProfile } from "@journey/schemas";
import { useCallback, useRef, useState } from "react";
import { useAudioPlayer } from "./use-audio-player";
import { useAudioRecorder } from "./use-audio-recorder";

const log = createLogger("audio:voiceChat");

// =============================================================================
// TYPES
// =============================================================================

export type VoiceChatStatus = "idle" | "recording" | "transcribing" | "processing" | "playing";

export interface UseVoiceChatOptions {
  /** Voice for TTS (default: "ash") */
  voice?: VoiceProfile;
  /** Enable TTS for responses (default: true) */
  ttsEnabled?: boolean;
  /** Callback when transcription completes */
  onTranscriptionComplete?: (transcript: string) => void;
  /** Callback when TTS playback completes */
  onPlaybackComplete?: () => void;
  /** Callback on error */
  onError?: (error: Error) => void;
}

export interface UseVoiceChatResult {
  /** Current voice chat status */
  status: VoiceChatStatus;
  /** Whether currently recording */
  isRecording: boolean;
  /** Whether currently playing TTS */
  isPlayingResponse: boolean;
  /** Recording duration in seconds */
  recordingDuration: number;
  /** Audio level for visual feedback (0-1) */
  audioLevel: number;
  /** Current error if any */
  error: string | null;
  /** MediaRecorder instance for visualization */
  mediaRecorder: MediaRecorder | null;
  /** Start recording */
  startRecording: () => Promise<void>;
  /** Stop recording and transcribe */
  stopAndTranscribe: () => Promise<string | null>;
  /** Cancel recording without transcribing */
  cancelRecording: () => void;
  /** Play TTS for text */
  speakText: (text: string) => void;
  /** Interrupt current TTS playback */
  interruptPlayback: () => void;
  /** Reset error state */
  clearError: () => void;
}

// =============================================================================
// HOOK IMPLEMENTATION
// =============================================================================

export function useVoiceChat(options: UseVoiceChatOptions = {}): UseVoiceChatResult {
  const {
    voice = appConfig.audio.defaultVoice as VoiceProfile,
    ttsEnabled = appConfig.audio.ttsEnabledByDefault,
    onTranscriptionComplete,
    onPlaybackComplete,
    onError,
  } = options;

  // State
  const [status, setStatus] = useState<VoiceChatStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  // Refs
  const abortControllerRef = useRef<AbortController | null>(null);

  // Audio recorder hook
  const recorder = useAudioRecorder({
    onRecordingCancelled: () => {
      setStatus("idle");
    },
  });

  // Audio player hook
  const player = useAudioPlayer({
    onPlaybackComplete: () => {
      setStatus("idle");
      onPlaybackComplete?.();
    },
  });

  // Handle errors
  const handleError = useCallback(
    (err: unknown, context: string) => {
      const message = err instanceof Error ? err.message : String(err);
      log.error({ err: serializeError(err) }, `voiceChat:${context}:error`);
      setError(message);
      setStatus("idle");
      onError?.(err instanceof Error ? err : new Error(message));
    },
    [onError]
  );

  // Start recording
  const startRecording = useCallback(async () => {
    try {
      setError(null);

      // Interrupt any playing audio
      if (player.isPlaying) {
        player.interrupt();
      }

      // Cancel any ongoing TTS stream
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }

      await recorder.startRecording();
      setStatus("recording");
      log.debug({}, "voiceChat:recording:started");
    } catch (err) {
      handleError(err, "startRecording");
    }
  }, [handleError, player, recorder]);

  // Stop recording and transcribe
  const stopAndTranscribe = useCallback(async (): Promise<string | null> => {
    try {
      setStatus("transcribing");
      log.debug({}, "voiceChat:transcribing:start");

      const audioBlob = await recorder.stopRecording();
      if (!audioBlob) {
        setStatus("idle");
        return null;
      }

      // Send to transcription API
      const result = await transcribeAudio(audioBlob);
      const transcript = result.transcript;

      log.info({ transcriptLength: transcript.length }, "voiceChat:transcription:complete");

      setStatus("processing");
      onTranscriptionComplete?.(transcript);

      return transcript;
    } catch (err) {
      handleError(err, "transcribe");
      return null;
    }
  }, [handleError, onTranscriptionComplete, recorder]);

  // Cancel recording
  const cancelRecording = useCallback(() => {
    recorder.cancelRecording();
    setStatus("idle");
    log.debug({}, "voiceChat:recording:cancelled");
  }, [recorder]);

  // Play TTS for text
  const speakText = useCallback(
    (text: string) => {
      if (!ttsEnabled || !text) {
        return;
      }

      // Cancel any existing stream
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      setStatus("playing");
      log.debug({ textLength: text.length }, "voiceChat:tts:start");

      abortControllerRef.current = streamSpeech(
        text,
        {
          onChunk: (base64Data, _index) => {
            player.queueStreamChunk(base64Data);
          },
          onComplete: (totalChunks) => {
            log.debug({ totalChunks }, "voiceChat:tts:streamComplete");
            player.flushStream();
            abortControllerRef.current = null;
          },
          onError: (err) => {
            handleError(err, "tts");
            abortControllerRef.current = null;
          },
        },
        { voice }
      );
    },
    [handleError, player, ttsEnabled, voice]
  );

  // Interrupt playback
  const interruptPlayback = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    player.interrupt();
    setStatus("idle");
    log.debug({}, "voiceChat:playback:interrupted");
  }, [player]);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    status,
    isRecording: recorder.isRecording,
    isPlayingResponse: player.isPlaying,
    recordingDuration: recorder.duration,
    audioLevel: recorder.audioLevel,
    error: error || recorder.error || player.error,
    mediaRecorder: recorder.mediaRecorder,
    startRecording,
    stopAndTranscribe,
    cancelRecording,
    speakText,
    interruptPlayback,
    clearError,
  };
}
