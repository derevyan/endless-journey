/**
 * useAudioPlayer Hook
 *
 * Provides audio playback functionality using Web Audio API.
 * Supports streaming PCM16 chunks for real-time TTS playback.
 *
 * @module hooks/audio/use-audio-player
 */

import { base64ToUint8Array, createAudioBufferFromPCM16, mergeAudioChunks, PCM16_CONFIG } from "@/shared/lib/audio-utils";
import { createLogger } from "@journey/logger";
import { useCallback, useEffect, useRef, useState } from "react";

const log = createLogger("audio:player");

// =============================================================================
// TYPES
// =============================================================================

export interface UseAudioPlayerOptions {
  /** Audio sample rate (default: 24000 for OpenAI TTS) */
  sampleRate?: number;
  /** Callback when playback completes */
  onPlaybackComplete?: () => void;
  /** Callback when playback is interrupted */
  onPlaybackInterrupted?: () => void;
}

export interface UseAudioPlayerResult {
  /** Whether audio is currently playing */
  isPlaying: boolean;
  /** Any error that occurred */
  error: string | null;
  /** Play complete audio from ArrayBuffer */
  play: (audioData: ArrayBuffer) => void;
  /** Queue a streaming PCM16 chunk (base64 encoded) */
  queueStreamChunk: (base64Chunk: string) => void;
  /** Flush any remaining queued audio and finalize */
  flushStream: () => void;
  /** Stop playback immediately */
  stop: () => void;
  /** Interrupt playback (for new incoming audio) */
  interrupt: () => void;
}

// =============================================================================
// HOOK IMPLEMENTATION
// =============================================================================

export function useAudioPlayer(options: UseAudioPlayerOptions = {}): UseAudioPlayerResult {
  const { sampleRate = PCM16_CONFIG.sampleRate, onPlaybackComplete, onPlaybackInterrupted } = options;

  // State
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const streamChunksRef = useRef<Uint8Array[]>([]);
  const isStreamingRef = useRef(false);
  const playbackQueueRef = useRef<AudioBuffer[]>([]);
  const isPlayingQueueRef = useRef(false);

  // Get or create AudioContext
  const getAudioContext = useCallback((): AudioContext => {
    if (!audioContextRef.current || audioContextRef.current.state === "closed") {
      audioContextRef.current = new AudioContext({ sampleRate });
    }
    return audioContextRef.current;
  }, [sampleRate]);

  // Play audio buffer from queue
  const playNextFromQueue = useCallback(() => {
    if (playbackQueueRef.current.length === 0) {
      isPlayingQueueRef.current = false;
      if (!isStreamingRef.current) {
        setIsPlaying(false);
        log.debug({}, "audio:player:queueEmpty");
        onPlaybackComplete?.();
      }
      return;
    }

    isPlayingQueueRef.current = true;
    const audioContext = getAudioContext();
    const buffer = playbackQueueRef.current.shift()!;

    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    currentSourceRef.current = source;

    source.onended = () => {
      currentSourceRef.current = null;
      playNextFromQueue();
    };

    source.start();
  }, [getAudioContext, onPlaybackComplete]);

  // Play complete audio from ArrayBuffer (e.g., mp3 file)
  const play = useCallback(
    async (audioData: ArrayBuffer) => {
      try {
        setError(null);
        const audioContext = getAudioContext();

        // Resume context if suspended (browser autoplay policy)
        if (audioContext.state === "suspended") {
          await audioContext.resume();
        }

        // Decode the audio data
        const audioBuffer = await audioContext.decodeAudioData(audioData.slice(0));

        log.debug({ duration: audioBuffer.duration, channels: audioBuffer.numberOfChannels }, "audio:player:decodedAudio");

        // Stop any current playback
        if (currentSourceRef.current) {
          currentSourceRef.current.stop();
          currentSourceRef.current = null;
        }

        // Create and play source
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);
        currentSourceRef.current = source;
        setIsPlaying(true);

        source.onended = () => {
          currentSourceRef.current = null;
          setIsPlaying(false);
          log.debug({}, "audio:player:playbackComplete");
          onPlaybackComplete?.();
        };

        source.start();
        log.info({ duration: audioBuffer.duration }, "audio:player:started");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to play audio";
        log.error({ err }, "audio:player:playError");
        setError(message);
        setIsPlaying(false);
      }
    },
    [getAudioContext, onPlaybackComplete]
  );

  // Queue a streaming PCM16 chunk
  const queueStreamChunk = useCallback(
    (base64Chunk: string) => {
      try {
        const chunk = base64ToUint8Array(base64Chunk);
        streamChunksRef.current.push(chunk);
        isStreamingRef.current = true;
        setIsPlaying(true);

        // Process chunks in batches for smoother playback
        // Wait until we have enough data (roughly 100ms of audio at 24kHz mono 16-bit = 4800 bytes)
        const totalBytes = streamChunksRef.current.reduce((sum, c) => sum + c.length, 0);

        if (totalBytes >= 4800) {
          const merged = mergeAudioChunks(streamChunksRef.current);
          streamChunksRef.current = [];

          const audioContext = getAudioContext();

          // Resume context if needed
          if (audioContext.state === "suspended") {
            audioContext.resume();
          }

          const audioBuffer = createAudioBufferFromPCM16(audioContext, merged, sampleRate);
          playbackQueueRef.current.push(audioBuffer);

          log.trace({ bufferDuration: audioBuffer.duration, queueLength: playbackQueueRef.current.length }, "audio:player:chunkQueued");

          // Start playing if not already
          if (!isPlayingQueueRef.current) {
            playNextFromQueue();
          }
        }
      } catch (err) {
        log.error({ err }, "audio:player:chunkError");
      }
    },
    [getAudioContext, playNextFromQueue, sampleRate]
  );

  // Flush remaining stream chunks
  const flushStream = useCallback(() => {
    isStreamingRef.current = false;

    if (streamChunksRef.current.length > 0) {
      const merged = mergeAudioChunks(streamChunksRef.current);
      streamChunksRef.current = [];

      if (merged.length > 0) {
        const audioContext = getAudioContext();
        const audioBuffer = createAudioBufferFromPCM16(audioContext, merged, sampleRate);
        playbackQueueRef.current.push(audioBuffer);

        log.debug({ bufferDuration: audioBuffer.duration }, "audio:player:flushedRemaining");

        if (!isPlayingQueueRef.current) {
          playNextFromQueue();
        }
      }
    } else if (!isPlayingQueueRef.current && playbackQueueRef.current.length === 0) {
      // Nothing to flush and nothing playing
      setIsPlaying(false);
      onPlaybackComplete?.();
    }

    log.debug({}, "audio:player:streamFlushed");
  }, [getAudioContext, onPlaybackComplete, playNextFromQueue, sampleRate]);

  // Stop playback
  const stop = useCallback(() => {
    if (currentSourceRef.current) {
      try {
        currentSourceRef.current.stop();
      } catch {
        // Ignore errors if already stopped
      }
      currentSourceRef.current = null;
    }

    // Clear queues
    playbackQueueRef.current = [];
    streamChunksRef.current = [];
    isStreamingRef.current = false;
    isPlayingQueueRef.current = false;

    setIsPlaying(false);
    log.debug({}, "audio:player:stopped");
  }, []);

  // Interrupt playback (for new audio)
  const interrupt = useCallback(() => {
    if (isPlaying) {
      log.debug({}, "audio:player:interrupted");
      stop();
      onPlaybackInterrupted?.();
    }
  }, [isPlaying, onPlaybackInterrupted, stop]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stop();
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close().catch(() => {
          // Ignore close errors
        });
      }
    };
  }, [stop]);

  return {
    isPlaying,
    error,
    play,
    queueStreamChunk,
    flushStream,
    stop,
    interrupt,
  };
}
