/**
 * LLM Service-Specific Configurations
 *
 * Configurations for specialized LLM services:
 * - Audio (STT/TTS) - OpenAI and ElevenLabs
 * - Embeddings - OpenAI only
 * - Intent Classification - Groq
 *
 * @example
 * import { AUDIO_CONFIG, EMBEDDING_CONFIG, INTENT_CONFIG } from "@journey/schemas/config/llm/services";
 *
 * const sttModel = AUDIO_CONFIG.stt;          // { id: "gpt-4o-transcribe", provider: "openai" }
 * const embeddingModel = EMBEDDING_CONFIG.model; // { id: "text-embedding-3-small", provider: "openai" }
 */

import type { ModelConfig } from "./models";

// =============================================================================
// Audio Provider Type
// =============================================================================

export type AudioProvider = "openai" | "elevenlabs";

// =============================================================================
// Voice Discovery Types
// =============================================================================

/**
 * Voice category from ElevenLabs API
 */
export type VoiceCategory = "premade" | "cloned" | "generated" | "professional";

/**
 * Voice information returned by voice discovery APIs
 */
export interface VoiceInfo {
  id: string;
  label: string;
  gender?: string;
  preview_url?: string;
  /** Voice category (from ElevenLabs v2 API) */
  category?: VoiceCategory;
}

/**
 * Response from voice discovery endpoints
 */
export interface VoicesResponse {
  voices: VoiceInfo[];
  source: "api" | "hardcoded" | "cached";
}

// ElevenLabs TTS/STT models are now auto-generated in essential-models.ts
// Re-export for backward compatibility
export {
  ELEVENLABS_TTS_MODELS,
  ELEVENLABS_STT_MODELS,
  type ElevenLabsTtsModelId,
  type ElevenLabsSttModelId,
  type ElevenLabsModelConfig,
} from "../../llm/essential-models";

// =============================================================================
// Audio Service Configuration
// =============================================================================

/**
 * Audio service configuration for Speech-to-Text (STT) and Text-to-Speech (TTS)
 * Supports multiple providers: OpenAI and ElevenLabs
 */
export const AUDIO_CONFIG = {
  /**
   * Default provider selection for STT and TTS
   * Can be different for each service type
   */
  providers: {
    stt: "openai" as AudioProvider,
    tts: "openai" as AudioProvider,
  },

  /**
   * Speech-to-Text model for transcribing audio (default/legacy)
   * gpt-4o-transcribe: High accuracy, supports multiple languages
   */
  stt: {
    id: "gpt-4o-transcribe",
    provider: "openai",
  } as ModelConfig,

  /**
   * Text-to-Speech models (default/legacy)
   */
  tts: {
    /**
     * Streaming TTS model for real-time audio generation
     * tts-1: Supports streaming for low-latency responses
     */
    stream: {
      id: "tts-1",
      provider: "openai",
    } as ModelConfig,

    /**
     * Non-streaming TTS model (fallback or batch processing)
     * tts-1-hd: High-definition version for better quality
     */
    nonStream: {
      id: "tts-1-hd",
      provider: "openai",
    } as ModelConfig,
  },

  /**
   * OpenAI-specific configuration
   */
  openai: {
    stt: { id: "gpt-4o-transcribe", provider: "openai" as const },
    tts: {
      stream: { id: "tts-1", provider: "openai" as const },
      nonStream: { id: "tts-1-hd", provider: "openai" as const },
    },
    voices: [
      { id: "alloy", label: "Alloy", gender: "neutral" as const },
      { id: "ash", label: "Ash", gender: "male" as const },
      { id: "coral", label: "Coral", gender: "female" as const },
      { id: "echo", label: "Echo", gender: "male" as const },
      { id: "fable", label: "Fable", gender: "neutral" as const },
      { id: "nova", label: "Nova", gender: "female" as const },
      { id: "onyx", label: "Onyx", gender: "male" as const },
      { id: "sage", label: "Sage", gender: "female" as const },
      { id: "shimmer", label: "Shimmer", gender: "female" as const },
    ],
    defaultVoice: "ash",
  },

  /**
   * ElevenLabs-specific configuration
   */
  elevenlabs: {
    stt: { id: "scribe_v1", provider: "elevenlabs" as const },
    tts: {
      stream: { id: "eleven_flash_v2_5", provider: "elevenlabs" as const }, // ~75ms latency
      nonStream: { id: "eleven_multilingual_v2", provider: "elevenlabs" as const }, // Best quality
    },
    voices: [
      { id: "21m00Tcm4TlvDq8ikWAM", label: "Rachel", gender: "female" as const },
      { id: "ErXwobaYiN019PkySvjV", label: "Antoni", gender: "male" as const },
      { id: "EXAVITQu4vr4xnSDxMaL", label: "Bella", gender: "female" as const },
      { id: "MF3mGyEYCl7XYWbV9V6O", label: "Elli", gender: "female" as const },
      { id: "TxGEqnHWrfWFTfGW9XjX", label: "Josh", gender: "male" as const },
      { id: "VR6AewLTigWG4xSOukaG", label: "Arnold", gender: "male" as const },
      { id: "pNInz6obpgDQGcFmaJgB", label: "Adam", gender: "male" as const },
      { id: "yoZ06aMxZJJ28mfd3POQ", label: "Sam", gender: "male" as const },
    ],
    defaultVoice: "21m00Tcm4TlvDq8ikWAM", // Rachel
  },
} as const;

/**
 * Get voices for a specific provider
 */
export function getVoicesForProvider(provider: AudioProvider) {
  return AUDIO_CONFIG[provider]?.voices ?? [];
}

/**
 * Get default voice for a specific provider
 */
export function getDefaultVoiceForProvider(provider: AudioProvider): string {
  return AUDIO_CONFIG[provider]?.defaultVoice ?? "ash";
}

// =============================================================================
// Embedding Service Configuration
// =============================================================================

/**
 * Text embedding model configuration
 * Note: Embeddings are currently OpenAI-only
 */
export const EMBEDDING_CONFIG = {
  /**
   * Text embedding model with configuration
   * text-embedding-3-small: 1536 dimensions, cost-effective, high quality
   */
  model: {
    id: "text-embedding-3-small",
    provider: "openai",
    /** Embedding dimension output size */
    dimensions: 1536,
  } as ModelConfig & { dimensions: number },
} as const;

// =============================================================================
// Intent Classification Configuration
// =============================================================================

/**
 * Intent classification service configuration
 * Uses Groq's gpt-oss-120b for fast, cost-effective intent classification
 */
export const INTENT_CONFIG = {
  /**
   * Model used for intent classification
   * gpt-oss-120b via Groq: Fast, accurate, cost-effective
   */
  model: {
    id: "openai/gpt-oss-120b",
    provider: "groq",
  } as ModelConfig,

  /**
   * Temperature for intent classification
   * Low temperature (0.1) for consistent, deterministic results
   */
  temperature: 0.1,

  /**
   * Maximum tokens for intent classification response
   * Intent classifications are typically short (under 200 tokens)
   */
  maxTokens: 200,

  /**
   * Retry configuration for intent classification
   * Retries up to 2 times on failure
   */
  maxRetries: 2,
} as const;
