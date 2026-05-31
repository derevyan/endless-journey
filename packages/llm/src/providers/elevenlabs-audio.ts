/**
 * ElevenLabs Audio Provider
 *
 * Implements STT (Scribe) and TTS using ElevenLabs API.
 * - TTS Streaming: eleven_flash_v2_5 (~75ms latency)
 * - TTS Quality: eleven_multilingual_v2 (29 languages)
 * - STT: scribe_v1 (99 languages)
 *
 * @module providers/elevenlabs-audio
 */

import { createLogger, serializeError } from "@journey/logger";
import { getModelMetadata, LLM_SERVICE_NAMES } from "@journey/schemas";

import {
  ELEVENLABS_BASE_URL,
  getElevenLabsApiKey,
  getElevenLabsHeaders,
  mapToElevenLabsFormat,
} from "../clients/elevenlabs";
import { LLMError } from "../types";
import { getUsageTrackingAdapter } from "../adapters/usage-tracking-context";
import type { STTProvider, TTSProvider, STTProviderConfig, TTSProviderConfig, STTResult } from "./types";

const log = createLogger("llm:audio:elevenlabs");

// =============================================================================
// Default Models
// =============================================================================

const DEFAULT_STT_MODEL = "scribe_v1";
const DEFAULT_TTS_MODEL = "eleven_multilingual_v2";
const DEFAULT_TTS_STREAM_MODEL = "eleven_flash_v2_5";
const DEFAULT_VOICE = "21m00Tcm4TlvDq8ikWAM"; // Rachel

// =============================================================================
// ElevenLabs STT Provider
// =============================================================================

export class ElevenLabsSTTProvider implements STTProvider {
  readonly name = "elevenlabs" as const;

  async transcribe(audio: Buffer, filename: string = "audio.webm", config: STTProviderConfig = {}): Promise<STTResult> {
    const startTime = Date.now();
    const model = config.model ?? DEFAULT_STT_MODEL;

    log.debug({ model, filename, bufferSize: audio.length }, "elevenlabs:stt:start");

    try {
      // Create FormData with audio file
      const formData = new FormData();
      const blob = new Blob([audio], { type: getMimeType(filename) });
      formData.append("audio", blob, filename);
      formData.append("model_id", model);

      if (config.language) {
        formData.append("language_code", config.language);
      }

      const response = await fetch(`${ELEVENLABS_BASE_URL}/speech-to-text`, {
        method: "POST",
        headers: {
          "xi-api-key": getElevenLabsApiKey(),
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        log.error({ status: response.status, error: errorText }, "elevenlabs:stt:apiError");
        throw new LLMError(`ElevenLabs STT failed: ${response.status} - ${errorText}`, model, "AUDIO_ERROR");
      }

      const result = (await response.json()) as {
        text: string;
        language_code?: string;
        audio_duration?: number;
      };

      const durationMs = Date.now() - startTime;

      log.info(
        {
          model,
          durationMs,
          textLength: result.text.length,
          language: result.language_code,
        },
        "elevenlabs:stt:complete"
      );

      // Track usage
      if (config.organizationId) {
        this.trackUsage(audio.length, model, result.text, durationMs, result.audio_duration, config);
      }

      return {
        transcript: result.text,
        language: result.language_code,
        duration: result.audio_duration,
      };
    } catch (error) {
      if (error instanceof LLMError) throw error;
      log.error({ err: serializeError(error), model }, "elevenlabs:stt:error");
      throw new LLMError(`ElevenLabs STT failed: ${error instanceof Error ? error.message : String(error)}`, model, "AUDIO_ERROR", error);
    }
  }

  private trackUsage(
    audioSize: number,
    model: string,
    text: string,
    durationMs: number,
    audioDuration: number | undefined,
    config: STTProviderConfig
  ): void {
    const adapter = getUsageTrackingAdapter();
    if (!adapter.isReady?.()) return;

    const modelMeta = getModelMetadata(model);
    if (!modelMeta) {
      log.warn({ model }, "elevenlabs:stt:modelNotFound:usingDefaultPricing");
    }

    // ElevenLabs STT (Scribe) pricing: ~$0.01/min = $0.000167/sec
    // See: https://elevenlabs.io/docs/overview/capabilities/speech-to-text
    const estimatedDurationSec = audioDuration ?? audioSize / 16000;
    const perSecCost = modelMeta?.pricing.perSecond ?? 0.000167;
    const costUSD = estimatedDurationSec * perSecCost;

    log.debug({ model, estimatedDurationSec, costUSD }, "elevenlabs:stt:costCalculated");

    adapter.recordUsage(
      { promptTokens: 0, completionTokens: 0, totalTokens: 0, costUSD },
      {
        organizationId: config.organizationId!,
        journeySessionId: config.journeySessionId,
        journeyId: config.journeyId,
        service: LLM_SERVICE_NAMES.AUDIO_SERVICE,
        module: "stt",
        model,
        provider: "elevenlabs",
        durationMs,
        outputContent: text,
        finishReason: "stop",
        metadata: {
          audioSizeBytes: audioSize,
          transcriptLength: text.length,
          estimatedDurationSec,
          costUSD,
        },
      }
    );
  }
}

// =============================================================================
// ElevenLabs TTS Provider
// =============================================================================

export class ElevenLabsTTSProvider implements TTSProvider {
  readonly name = "elevenlabs" as const;

  async speak(text: string, config: TTSProviderConfig): Promise<ArrayBuffer> {
    const startTime = Date.now();
    const model = config.model ?? DEFAULT_TTS_MODEL;
    const voice = config.voice ?? DEFAULT_VOICE;
    const outputFormat = mapToElevenLabsFormat(config.format ?? "mp3");

    log.debug({ model, voice, outputFormat, textLength: text.length }, "elevenlabs:tts:start");

    try {
      const response = await fetch(`${ELEVENLABS_BASE_URL}/text-to-speech/${voice}`, {
        method: "POST",
        headers: getElevenLabsHeaders(),
        body: JSON.stringify({
          text,
          model_id: model,
          output_format: outputFormat,
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0,
            use_speaker_boost: true,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        log.error({ status: response.status, error: errorText }, "elevenlabs:tts:apiError");
        throw new LLMError(`ElevenLabs TTS failed: ${response.status} - ${errorText}`, model, "AUDIO_ERROR");
      }

      const audioBuffer = await response.arrayBuffer();
      const durationMs = Date.now() - startTime;

      log.info(
        {
          model,
          voice,
          durationMs,
          audioSize: audioBuffer.byteLength,
        },
        "elevenlabs:tts:complete"
      );

      // Track usage
      if (config.organizationId) {
        this.trackUsage(text, model, voice, durationMs, audioBuffer.byteLength, config);
      }

      return audioBuffer;
    } catch (error) {
      if (error instanceof LLMError) throw error;
      log.error({ err: serializeError(error), model }, "elevenlabs:tts:error");
      throw new LLMError(`ElevenLabs TTS failed: ${error instanceof Error ? error.message : String(error)}`, model, "AUDIO_ERROR", error);
    }
  }

  async *speakStream(text: string, config: TTSProviderConfig): AsyncGenerator<Uint8Array, void, unknown> {
    const startTime = Date.now();
    const model = config.model ?? DEFAULT_TTS_STREAM_MODEL;
    const voice = config.voice ?? DEFAULT_VOICE;
    // Use pcm_24000 for streaming to match OpenAI's format
    const outputFormat = "pcm_24000";

    log.debug({ model, voice, outputFormat, textLength: text.length }, "elevenlabs:tts:stream:start");

    try {
      const response = await fetch(`${ELEVENLABS_BASE_URL}/text-to-speech/${voice}/stream`, {
        method: "POST",
        headers: getElevenLabsHeaders(),
        body: JSON.stringify({
          text,
          model_id: model,
          output_format: outputFormat,
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        log.error({ status: response.status, error: errorText }, "elevenlabs:tts:stream:apiError");
        throw new LLMError(`ElevenLabs TTS stream failed: ${response.status} - ${errorText}`, model, "AUDIO_ERROR");
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new LLMError("No response body for ElevenLabs TTS stream", model, "AUDIO_ERROR");
      }

      let chunkCount = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        yield value;
        chunkCount++;
      }

      const durationMs = Date.now() - startTime;

      log.info(
        {
          model,
          voice,
          durationMs,
          totalChunks: chunkCount,
        },
        "elevenlabs:tts:stream:complete"
      );

      // Track usage
      if (config.organizationId) {
        this.trackStreamUsage(text, model, voice, durationMs, chunkCount, config);
      }
    } catch (error) {
      if (error instanceof LLMError) throw error;
      log.error({ err: serializeError(error), model }, "elevenlabs:tts:stream:error");
      throw error;
    }
  }

  private trackUsage(
    text: string,
    model: string,
    voice: string,
    durationMs: number,
    audioSize: number,
    config: TTSProviderConfig
  ): void {
    const adapter = getUsageTrackingAdapter();
    if (!adapter.isReady?.()) return;

    const modelMeta = getModelMetadata(model);
    if (!modelMeta) {
      log.warn({ model }, "elevenlabs:tts:modelNotFound:usingDefaultPricing");
    }

    // ElevenLabs TTS pricing: Starter tier = $5/30k chars = $0.000167/char
    // See: https://elevenlabs.io/pricing/api
    const perCharCost = modelMeta?.pricing.perCharacter ?? 0.000167;
    const costUSD = text.length * perCharCost;

    log.debug({ model, inputCharacters: text.length, costUSD }, "elevenlabs:tts:costCalculated");

    adapter.recordUsage(
      { promptTokens: 0, completionTokens: 0, totalTokens: 0, costUSD },
      {
        organizationId: config.organizationId!,
        journeySessionId: config.journeySessionId,
        journeyId: config.journeyId,
        service: LLM_SERVICE_NAMES.AUDIO_SERVICE,
        module: "tts",
        model,
        provider: "elevenlabs",
        durationMs,
        metadata: {
          inputCharacters: text.length,
          prompt: text,
          audioSizeBytes: audioSize,
          voice,
          costUSD,
        },
      }
    );
  }

  private trackStreamUsage(
    text: string,
    model: string,
    voice: string,
    durationMs: number,
    chunkCount: number,
    config: TTSProviderConfig
  ): void {
    const adapter = getUsageTrackingAdapter();
    if (!adapter.isReady?.()) return;

    const modelMeta = getModelMetadata(model);
    if (!modelMeta) {
      log.warn({ model }, "elevenlabs:tts:stream:modelNotFound:usingDefaultPricing");
    }

    // ElevenLabs TTS pricing: Starter tier = $5/30k chars = $0.000167/char
    const perCharCost = modelMeta?.pricing.perCharacter ?? 0.000167;
    const costUSD = text.length * perCharCost;

    log.debug({ model, inputCharacters: text.length, costUSD }, "elevenlabs:tts:stream:costCalculated");

    adapter.recordUsage(
      { promptTokens: 0, completionTokens: 0, totalTokens: 0, costUSD },
      {
        organizationId: config.organizationId!,
        journeySessionId: config.journeySessionId,
        journeyId: config.journeyId,
        service: LLM_SERVICE_NAMES.AUDIO_SERVICE,
        module: "tts-stream",
        model,
        provider: "elevenlabs",
        durationMs,
        metadata: {
          inputCharacters: text.length,
          prompt: text,
          totalChunks: chunkCount,
          voice,
          costUSD,
        },
      }
    );
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get MIME type from filename
 */
function getMimeType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    webm: "audio/webm",
    wav: "audio/wav",
    mp3: "audio/mpeg",
    m4a: "audio/m4a",
    ogg: "audio/ogg",
    flac: "audio/flac",
  };
  return mimeTypes[ext ?? ""] ?? "audio/webm";
}

// =============================================================================
// Singleton Instances
// =============================================================================

let elevenLabsSTTProvider: ElevenLabsSTTProvider | null = null;
let elevenLabsTTSProvider: ElevenLabsTTSProvider | null = null;

export function getElevenLabsSTTProvider(): ElevenLabsSTTProvider {
  if (!elevenLabsSTTProvider) {
    elevenLabsSTTProvider = new ElevenLabsSTTProvider();
  }
  return elevenLabsSTTProvider;
}

export function getElevenLabsTTSProvider(): ElevenLabsTTSProvider {
  if (!elevenLabsTTSProvider) {
    elevenLabsTTSProvider = new ElevenLabsTTSProvider();
  }
  return elevenLabsTTSProvider;
}
