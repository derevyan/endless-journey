/**
 * OpenAI Audio Provider
 *
 * Implements STT (gpt-4o-transcribe) and TTS (tts-1, tts-1-hd) using OpenAI API.
 *
 * @module providers/openai-audio
 */

import { createLogger, serializeError } from "@journey/logger";
import { ChatOpenAI } from "@langchain/openai";
import { AUDIO_CONFIG } from "@journey/schemas/config";
import { getModelMetadata, LLM_SERVICE_NAMES } from "@journey/schemas";
import type { VoiceProfile } from "@journey/schemas";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { getOpenAIClient } from "../clients/openai";
import { classifyError } from "../errors";
import { LLMError, LLMAuthError } from "../types";
import { getUsageTrackingAdapter } from "../adapters/usage-tracking-context";
import type { STTProvider, TTSProvider, STTProviderConfig, TTSProviderConfig, STTResult } from "./types";

const log = createLogger("llm:audio:openai");

// =============================================================================
// OpenAI STT Provider
// =============================================================================

export class OpenAISTTProvider implements STTProvider {
  readonly name = "openai" as const;

  async transcribe(audio: Buffer, filename: string = "audio.webm", config: STTProviderConfig = {}): Promise<STTResult> {
    const startTime = Date.now();
    const model = config.model ?? AUDIO_CONFIG.stt.id;
    const mimeType = getMimeType(filename);

    log.debug({ model, filename, bufferSize: audio.length, mimeType }, "openai:stt:start");

    // Create temporary file for the audio
    const ext = filename.split(".").pop() || "webm";
    const tempDir = os.tmpdir();
    const tempFilePath = path.join(tempDir, `audio_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`);

    try {
      const client = getOpenAIClient();

      // Write buffer to temp file
      fs.writeFileSync(tempFilePath, audio);

      const fileSize = fs.statSync(tempFilePath).size;
      log.debug({ tempFilePath, fileSize, ext }, "openai:stt:tempFileWritten");

      const fileStream = fs.createReadStream(tempFilePath);

      const response = await client.audio.transcriptions.create({
        model,
        file: fileStream,
        language: config.language,
        prompt: config.prompt,
      });

      const text = typeof response === "string" ? response : response.text;
      const durationMs = Date.now() - startTime;

      log.info({ model, durationMs, textLength: text.length }, "openai:stt:complete");

      // Track usage
      if (config.organizationId) {
        this.trackSTTUsage(audio, model, text, durationMs, filename, config);
      }

      return {
        transcript: text,
        language: undefined,
        duration: undefined,
      };
    } catch (error) {
      log.error({ err: serializeError(error), model }, "openai:stt:error");
      return wrapAudioError(error, model);
    } finally {
      // Clean up temp file
      try {
        fs.unlinkSync(tempFilePath);
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  private trackSTTUsage(
    audio: Buffer,
    model: string,
    text: string,
    durationMs: number,
    filename: string,
    config: STTProviderConfig
  ): void {
    const adapter = getUsageTrackingAdapter();
    if (!adapter.isReady?.()) return;

    const estimatedDurationSec = estimateAudioDuration(audio.length, filename);
    const modelMeta = getModelMetadata(model);

    if (!modelMeta) {
      log.warn({ model }, "openai:stt:modelNotFound:usingDefaultPricing");
    }

    const perSecCost = modelMeta?.pricing.perSecond ?? 0.0001;
    const costUSD = estimatedDurationSec * perSecCost;

    log.debug({ model, estimatedDurationSec, costUSD }, "openai:stt:costCalculated");

    adapter.recordUsage(
      { promptTokens: 0, completionTokens: 0, totalTokens: 0, costUSD },
      {
        organizationId: config.organizationId!,
        journeySessionId: config.journeySessionId,
        journeyId: config.journeyId,
        service: LLM_SERVICE_NAMES.AUDIO_SERVICE,
        module: "stt",
        model,
        provider: "openai",
        durationMs,
        outputContent: text,
        finishReason: "stop",
        metadata: {
          audioSizeBytes: audio.length,
          transcriptLength: text.length,
          estimatedDurationSec,
          costUSD,
        },
      }
    );
  }
}

// =============================================================================
// OpenAI TTS Provider
// =============================================================================

export class OpenAITTSProvider implements TTSProvider {
  readonly name = "openai" as const;

  async speak(text: string, config: TTSProviderConfig): Promise<ArrayBuffer> {
    const startTime = Date.now();
    const model = config.model ?? AUDIO_CONFIG.tts.nonStream.id;
    const voice = (config.voice ?? "ash") as VoiceProfile;

    log.debug({ model, voice, textLength: text.length }, "openai:tts:start");

    try {
      const client = getOpenAIClient();

      const response = await client.audio.speech.create({
        model,
        voice,
        input: text,
        response_format: "opus", // Opus format for Telegram compatibility
      });

      const audioBuffer = await response.arrayBuffer();
      const durationMs = Date.now() - startTime;

      log.info({ model, voice, durationMs, audioSize: audioBuffer.byteLength }, "openai:tts:complete");

      // Track usage
      if (config.organizationId) {
        this.trackTTSUsage(text, model, voice, durationMs, audioBuffer.byteLength, config);
      }

      return audioBuffer;
    } catch (error) {
      log.error({ err: serializeError(error), model }, "openai:tts:error");
      wrapAudioError(error, model);
    }
  }

  async *speakStream(text: string, config: TTSProviderConfig): AsyncGenerator<Uint8Array, void, unknown> {
    const startTime = Date.now();
    const model = config.model ?? AUDIO_CONFIG.tts.stream.id;
    const voice = (config.voice ?? "ash") as VoiceProfile;
    const format = config.format ?? "pcm16";

    log.debug({ model, voice, format, textLength: text.length }, "openai:tts:stream:start");

    try {
      const llm = createTTSClient(model, voice, format);
      const stream = await llm.stream(text);
      let chunkCount = 0;

      for await (const chunk of stream) {
        const audioData = (chunk.additional_kwargs as { audio?: { data?: string } })?.audio?.data;

        if (audioData) {
          const audioBuffer = Buffer.from(audioData, "base64");
          yield new Uint8Array(audioBuffer);
          chunkCount++;
        }
      }

      const durationMs = Date.now() - startTime;

      log.info({ model, voice, durationMs, totalChunks: chunkCount }, "openai:tts:stream:complete");

      // Track usage
      if (config.organizationId) {
        this.trackTTSStreamUsage(text, model, voice, durationMs, chunkCount, config);
      }
    } catch (error) {
      log.error({ err: serializeError(error), model }, "openai:tts:stream:error");
      throw error;
    }
  }

  private trackTTSUsage(
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
      log.warn({ model }, "openai:tts:modelNotFound:usingDefaultPricing");
    }

    const perCharCost = modelMeta?.pricing.perCharacter ?? 0.000015;
    const costUSD = text.length * perCharCost;

    log.debug({ model, inputCharacters: text.length, costUSD }, "openai:tts:costCalculated");

    adapter.recordUsage(
      { promptTokens: 0, completionTokens: 0, totalTokens: 0, costUSD },
      {
        organizationId: config.organizationId!,
        journeySessionId: config.journeySessionId,
        journeyId: config.journeyId,
        service: LLM_SERVICE_NAMES.AUDIO_SERVICE,
        module: "tts",
        model,
        provider: "openai",
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

  private trackTTSStreamUsage(
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
      log.warn({ model }, "openai:tts:stream:modelNotFound:usingDefaultPricing");
    }

    const perCharCost = modelMeta?.pricing.perCharacter ?? 0.000015;
    const costUSD = text.length * perCharCost;

    log.debug({ model, inputCharacters: text.length, costUSD }, "openai:tts:stream:costCalculated");

    adapter.recordUsage(
      { promptTokens: 0, completionTokens: 0, totalTokens: 0, costUSD },
      {
        organizationId: config.organizationId!,
        journeySessionId: config.journeySessionId,
        journeyId: config.journeyId,
        service: LLM_SERVICE_NAMES.AUDIO_SERVICE,
        module: "tts-stream",
        model,
        provider: "openai",
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
 * Create a ChatOpenAI client configured for TTS streaming
 */
function createTTSClient(model: string, voice: VoiceProfile, format: string): ChatOpenAI {
  return new ChatOpenAI({
    model,
    modalities: ["text", "audio"],
    audio: {
      voice,
      format,
    },
  } as ConstructorParameters<typeof ChatOpenAI>[0]);
}

/**
 * Estimate audio duration from buffer size based on format
 */
function estimateAudioDuration(bufferSize: number, filename: string): number {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "webm";

  const bytesPerSecond: Record<string, number> = {
    webm: 16000,
    ogg: 16000,
    mp3: 16000,
    wav: 88200,
    m4a: 16000,
    flac: 100000,
    oga: 16000,
  };

  const bps = bytesPerSecond[ext] ?? 16000;
  return bufferSize / bps;
}

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

/**
 * Wrap audio errors into typed LLM errors
 */
function wrapAudioError(error: unknown, model: string): never {
  const classification = classifyError(error);

  if (classification.type === "auth") {
    throw new LLMAuthError(model, error);
  }

  throw new LLMError(classification.message, model, "AUDIO_ERROR", error);
}

// =============================================================================
// Singleton Instances
// =============================================================================

let openaiSTTProvider: OpenAISTTProvider | null = null;
let openaiTTSProvider: OpenAITTSProvider | null = null;

export function getOpenAISTTProvider(): OpenAISTTProvider {
  if (!openaiSTTProvider) {
    openaiSTTProvider = new OpenAISTTProvider();
  }
  return openaiSTTProvider;
}

export function getOpenAITTSProvider(): OpenAITTSProvider {
  if (!openaiTTSProvider) {
    openaiTTSProvider = new OpenAITTSProvider();
  }
  return openaiTTSProvider;
}
