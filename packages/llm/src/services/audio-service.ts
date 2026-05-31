/**
 * Audio Service - Multi-Provider Speech-to-Text and Text-to-Speech
 *
 * Features:
 * - STT: Transcribe audio using OpenAI (gpt-4o-transcribe) or ElevenLabs (Scribe)
 * - TTS: Generate speech using OpenAI (tts-1) or ElevenLabs (eleven_flash_v2_5)
 * - Provider abstraction for easy switching
 * - Proper error handling consistent with LLM service
 *
 * @module services/audio-service
 */

import { createLogger } from "@journey/logger";
import type { VoiceProfile } from "@journey/schemas";

import { getSTTProvider, getTTSProvider } from "../providers/audio-registry";
import type { AudioProvider, AudioFormat } from "../providers/types";

const log = createLogger("llm:audio");

// ============================================================================
// Types
// ============================================================================

export interface STTConfig {
  /** Model to use for transcription. Default: provider-specific */
  model?: string;
  /** Language hint (ISO 639-1 code). Optional. */
  language?: string;
  /** Prompt to guide transcription style. Optional. */
  prompt?: string;
  /** Organization ID for usage tracking (optional) */
  organizationId?: string;
  /** Journey session ID for linking to journey context (optional) */
  journeySessionId?: string;
  /** Journey ID for linking to journey context (optional) */
  journeyId?: string;
  /** Provider to use (default: from AUDIO_CONFIG) */
  provider?: AudioProvider;
}

export interface TTSConfig {
  /** Model to use for TTS. Default: provider-specific */
  model?: string;
  /** Voice to use. Default: "ash" for OpenAI, "Rachel" for ElevenLabs */
  voice?: VoiceProfile | string;
  /** Audio format. Default: "pcm16" for streaming */
  format?: AudioFormat;
  /** Organization ID for usage tracking (optional) */
  organizationId?: string;
  /** Journey session ID for linking to journey context (optional) */
  journeySessionId?: string;
  /** Journey ID for linking to journey context (optional) */
  journeyId?: string;
  /** Provider to use (default: from AUDIO_CONFIG) */
  provider?: AudioProvider;
}

export interface STTResult {
  /** Transcribed text */
  transcript: string;
  /** Detected language (if available) */
  language?: string;
  /** Duration of audio in seconds */
  duration?: number;
}

export interface TTSStreamCallbacks {
  /** Called for each audio chunk received */
  onAudioChunk: (chunk: Uint8Array, index: number) => void;
  /** Called when streaming completes */
  onComplete: (totalChunks: number) => void;
  /** Called on error */
  onError: (error: Error) => void;
}

// ============================================================================
// Speech-to-Text (STT)
// ============================================================================

/**
 * Transcribe audio to text
 *
 * Uses the configured provider (OpenAI or ElevenLabs) for transcription.
 *
 * @param audioBuffer - Audio data as Buffer (webm, wav, mp3, etc.)
 * @param filename - Original filename with extension (helps with format detection)
 * @param config - Optional configuration including provider selection
 * @returns Transcription result
 *
 * @example
 * // Use default provider (OpenAI)
 * const result = await transcribeAudio(audioBuffer, "recording.webm");
 *
 * // Use ElevenLabs
 * const result = await transcribeAudio(audioBuffer, "recording.webm", { provider: "elevenlabs" });
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  filename: string = "audio.webm",
  config: STTConfig = {}
): Promise<STTResult> {
  const provider = getSTTProvider({ provider: config.provider });

  log.debug({ provider: provider.name, filename, bufferSize: audioBuffer.length }, "audio:transcribe:start");

  return provider.transcribe(audioBuffer, filename, {
    model: config.model,
    language: config.language,
    prompt: config.prompt,
    organizationId: config.organizationId,
    journeySessionId: config.journeySessionId,
    journeyId: config.journeyId,
  });
}

// ============================================================================
// Text-to-Speech (TTS) - Streaming
// ============================================================================

/**
 * Generate streaming speech from text
 *
 * Uses the configured provider for TTS streaming.
 *
 * @param text - Text to convert to speech
 * @param config - TTS configuration including provider selection
 * @param callbacks - Callbacks for streaming events
 *
 * @example
 * await generateSpeechStream(
 *   "Hello, world!",
 *   { voice: "nova" },
 *   {
 *     onAudioChunk: (chunk, idx) => sendToClient(chunk),
 *     onComplete: (total) => console.log(`Sent ${total} chunks`),
 *     onError: (err) => console.error(err),
 *   }
 * );
 */
export async function generateSpeechStream(
  text: string,
  config: TTSConfig = {},
  callbacks: TTSStreamCallbacks
): Promise<void> {
  const provider = getTTSProvider({ provider: config.provider });
  const voice = config.voice ?? "ash";

  log.debug({ provider: provider.name, voice, textLength: text.length }, "audio:tts:stream:start");

  try {
    const generator = provider.speakStream(text, {
      model: config.model,
      voice,
      format: config.format ?? "pcm16",
      organizationId: config.organizationId,
      journeySessionId: config.journeySessionId,
      journeyId: config.journeyId,
    });

    let chunkIndex = 0;
    for await (const chunk of generator) {
      callbacks.onAudioChunk(chunk, chunkIndex);
      chunkIndex++;
    }

    log.info({ provider: provider.name, totalChunks: chunkIndex }, "audio:tts:stream:complete");
    callbacks.onComplete(chunkIndex);
  } catch (error) {
    log.error({ provider: provider.name, error }, "audio:tts:stream:error");
    callbacks.onError(error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * Generate streaming speech using async iterator pattern
 *
 * @param text - Text to convert to speech
 * @param config - TTS configuration including provider selection
 * @yields Audio chunks as Uint8Array
 *
 * @example
 * for await (const chunk of generateSpeechIterator("Hello!")) {
 *   sendToClient(chunk);
 * }
 */
export async function* generateSpeechIterator(
  text: string,
  config: TTSConfig = {}
): AsyncGenerator<Uint8Array, void, unknown> {
  const provider = getTTSProvider({ provider: config.provider });
  const voice = config.voice ?? "ash";

  log.debug({ provider: provider.name, voice, textLength: text.length }, "audio:tts:iterator:start");

  const generator = provider.speakStream(text, {
    model: config.model,
    voice,
    format: config.format ?? "pcm16",
    organizationId: config.organizationId,
    journeySessionId: config.journeySessionId,
    journeyId: config.journeyId,
  });

  let chunkCount = 0;
  for await (const chunk of generator) {
    yield chunk;
    chunkCount++;
  }

  log.info({ provider: provider.name, totalChunks: chunkCount }, "audio:tts:iterator:complete");
}

// ============================================================================
// Non-streaming TTS (for simpler use cases)
// ============================================================================

/**
 * Generate complete speech audio (non-streaming)
 *
 * Uses the configured provider for TTS.
 *
 * @param text - Text to convert to speech
 * @param config - TTS configuration including provider selection
 * @returns Complete audio as ArrayBuffer
 *
 * @example
 * // Use default provider
 * const audio = await generateSpeech("Hello, world!");
 *
 * // Use ElevenLabs
 * const audio = await generateSpeech("Hello!", { provider: "elevenlabs", voice: "21m00Tcm4TlvDq8ikWAM" });
 */
export async function generateSpeech(text: string, config: TTSConfig = {}): Promise<ArrayBuffer> {
  const provider = getTTSProvider({ provider: config.provider });
  const voice = config.voice ?? "ash";

  log.debug({ provider: provider.name, voice, textLength: text.length }, "audio:tts:start");

  const result = await provider.speak(text, {
    model: config.model,
    voice,
    format: config.format,
    organizationId: config.organizationId,
    journeySessionId: config.journeySessionId,
    journeyId: config.journeyId,
  });

  log.info({ provider: provider.name, audioSize: result.byteLength }, "audio:tts:complete");

  return result;
}

// ============================================================================
// Re-exports for convenience
// ============================================================================

export { getSTTProvider, getTTSProvider, isProviderAvailable, getAvailableProviders } from "../providers/audio-registry";
export type { AudioProvider, AudioFormat } from "../providers/types";
