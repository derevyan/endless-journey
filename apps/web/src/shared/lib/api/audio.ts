/**
 * Audio API Client
 *
 * Client functions for speech-to-text and text-to-speech endpoints.
 *
 * @module lib/api/audio
 */

import { getExtensionFromMimeType } from "@/shared/lib/audio-utils";
import { createLogger, serializeError } from "@journey/logger";
import { BadRequestError, ServiceUnavailableError } from "@journey/schemas";
import type { VoiceProfile } from "@journey/schemas";
import type { VoicesResponse } from "@journey/schemas/config";
import { apiUrl } from "./base";

const log = createLogger("api:audio");

// =============================================================================
// TYPES
// =============================================================================

export interface TranscriptionResult {
  transcript: string;
  language?: string;
  duration?: number;
}

export interface TTSStreamEvent {
  type: "audio_chunk" | "audio_complete" | "error";
  data: AudioChunkData | AudioCompleteData | ErrorData;
}

interface AudioChunkData {
  index: number;
  data: string; // Base64 encoded PCM16
}

interface AudioCompleteData {
  totalChunks: number;
}

interface ErrorData {
  message: string;
}

export interface TTSOptions {
  voice?: VoiceProfile;
}

export interface TTSStreamCallbacks {
  onChunk: (base64Data: string, index: number) => void;
  onComplete: (totalChunks: number) => void;
  onError: (error: Error) => void;
}

// =============================================================================
// TRANSCRIPTION
// =============================================================================

/**
 * Transcribe audio to text
 *
 * @param audioBlob - Audio blob from MediaRecorder
 * @param filename - Optional filename hint
 * @returns Transcription result
 */
export async function transcribeAudio(audioBlob: Blob, filename?: string): Promise<TranscriptionResult> {
  log.debug({ size: audioBlob.size, type: audioBlob.type }, "api:audio:transcribe:start");

  try {
    const formData = new FormData();

    // Determine filename from blob type
    const extension = getExtensionFromMimeType(audioBlob.type);
    const actualFilename = filename || `audio.${extension}`;

    formData.append("audio", audioBlob, actualFilename);

    const response = await fetch(`${apiUrl}/api/llm/audio/transcribe`, {
      method: "POST",
      credentials: "include",
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
      throw new BadRequestError(errorData.error || "Transcription failed", {
        status: response.status,
      });
    }

    const result = await response.json();
    log.info({ transcriptLength: result.transcript?.length, language: result.language }, "api:audio:transcribe:success");

    return result as TranscriptionResult;
  } catch (error) {
    log.error({ err: serializeError(error) }, "api:audio:transcribe:error");
    throw error;
  }
}

// =============================================================================
// TEXT-TO-SPEECH (Streaming)
// =============================================================================

/**
 * Generate streaming speech from text via SSE
 *
 * @param text - Text to convert to speech
 * @param callbacks - Callbacks for stream events
 * @param options - TTS options
 * @returns AbortController to cancel the stream
 */
export function streamSpeech(text: string, callbacks: TTSStreamCallbacks, options: TTSOptions = {}): AbortController {
  const abortController = new AbortController();

  log.debug({ textLength: text.length, voice: options.voice }, "api:audio:tts:stream:start");

  (async () => {
    try {
      const response = await fetch(`${apiUrl}/api/llm/audio/tts/stream`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          voice: options.voice,
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new ServiceUnavailableError(errorData.error || "TTS streaming failed", {
          status: response.status,
        });
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new BadRequestError("No response body from TTS stream");
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events from buffer
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep incomplete line in buffer

        let currentEvent = "";
        let currentData = "";

        for (const line of lines) {
          if (line.startsWith("event:")) {
            currentEvent = line.slice(6).trim();
          } else if (line.startsWith("data:")) {
            currentData = line.slice(5).trim();
          } else if (line === "" && currentEvent && currentData) {
            // Empty line signals end of event
            try {
              const data = JSON.parse(currentData);

              if (currentEvent === "audio_chunk") {
                log.trace({ index: data.index, chunkSize: data.data?.length }, "api:audio:tts:stream:chunkReceived");
                callbacks.onChunk(data.data, data.index);
              } else if (currentEvent === "audio_complete") {
                log.info({ totalChunks: data.totalChunks }, "api:audio:tts:stream:complete");
                callbacks.onComplete(data.totalChunks);
              } else if (currentEvent === "error") {
                throw new ServiceUnavailableError(data.message || "TTS stream error");
              }
            } catch (parseError) {
              if (parseError instanceof SyntaxError) {
                log.warn({ currentData }, "api:audio:tts:stream:parseError");
              } else {
                throw parseError;
              }
            }

            currentEvent = "";
            currentData = "";
          }
        }
      }
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        log.debug({}, "api:audio:tts:stream:aborted");
        return;
      }

      log.error({ err: serializeError(error) }, "api:audio:tts:stream:error");
      callbacks.onError(error instanceof Error ? error : new Error(String(error)));
    }
  })();

  return abortController;
}

// =============================================================================
// TEXT-TO-SPEECH (Non-streaming)
// =============================================================================

/**
 * Generate complete speech audio (non-streaming)
 *
 * @param text - Text to convert to speech
 * @param options - TTS options
 * @returns Audio as ArrayBuffer (mp3)
 */
export async function generateSpeech(text: string, options: TTSOptions = {}): Promise<ArrayBuffer> {
  log.debug({ textLength: text.length, voice: options.voice }, "api:audio:tts:start");

  try {
    const response = await fetch(`${apiUrl}/api/llm/audio/tts`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        voice: options.voice,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
      throw new ServiceUnavailableError(errorData.error || "TTS generation failed", {
        status: response.status,
      });
    }

    const audioBuffer = await response.arrayBuffer();
    log.info({ audioSize: audioBuffer.byteLength }, "api:audio:tts:success");

    return audioBuffer;
  } catch (error) {
    log.error({ err: serializeError(error) }, "api:audio:tts:error");
    throw error;
  }
}

// =============================================================================
// VOICE DISCOVERY
// =============================================================================

/**
 * Fetch available ElevenLabs voices
 *
 * Returns voices from ElevenLabs API with fallback to hardcoded list.
 */
export async function getElevenLabsVoices(refresh = false): Promise<VoicesResponse> {
  log.debug({ refresh }, "api:voices:elevenlabs:start");

  const url = refresh ? `${apiUrl}/api/llm/voices/elevenlabs?refresh=true` : `${apiUrl}/api/llm/voices/elevenlabs`;

  try {
    const response = await fetch(url, {
      method: "GET",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch voices: ${response.status}`);
    }

    const data = (await response.json()) as VoicesResponse;
    log.info({ voiceCount: data.voices.length, source: data.source }, "api:voices:elevenlabs:success");

    return data;
  } catch (error) {
    log.error({ err: serializeError(error) }, "api:voices:elevenlabs:error");
    throw error;
  }
}
