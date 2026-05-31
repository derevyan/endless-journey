import { z } from "zod";

// =============================================================================
// LLM PROVIDERS (Chat/Completion Models)
// =============================================================================

/**
 * Pure LLM providers for chat and completion models.
 *
 * These names match LangChain's provider identifiers exactly, eliminating
 * the need for runtime mapping between user-friendly names and LangChain names.
 *
 * - openai: OpenAI (GPT-4, GPT-4o, o1, o3, etc.)
 * - anthropic: Anthropic (Claude Sonnet, Opus, Haiku)
 * - google-genai: Google Gemini
 * - groq: Groq (Llama, Mixtral on fast inference)
 *
 * @example
 * import { LLMProviderSchema, type LLMProvider } from "@journey/schemas";
 *
 * const config = { provider: "google-genai" as LLMProvider, model: "gemini-2.0-flash" };
 */
export const LLMProviderSchema = z.enum(["openai", "anthropic", "google-genai", "groq", "cerebras"]);

/**
 * LLM Provider type - use for chat/completion model operations.
 *
 * @example
 * function initChatModel(provider: LLMProvider, model: string): BaseChatModel { ... }
 */
export type LLMProvider = z.infer<typeof LLMProviderSchema>;

/**
 * Array of all supported LLM provider values.
 * Useful for iteration and validation.
 */
export const LLM_PROVIDER_VALUES = LLMProviderSchema.options;

// =============================================================================
// AUDIO PROVIDERS (TTS/STT)
// =============================================================================

/**
 * Audio providers for text-to-speech and speech-to-text services.
 *
 * - openai: OpenAI TTS/Whisper
 * - elevenlabs: ElevenLabs high-quality TTS
 *
 * @example
 * import { AudioProviderSchema, type AudioProvider } from "@journey/schemas";
 *
 * const voiceConfig = { provider: "elevenlabs" as AudioProvider, voiceId: "..." };
 */
export const AudioProviderSchema = z.enum(["openai", "elevenlabs"]);

/**
 * Audio Provider type - use for TTS/STT operations.
 *
 * @example
 * function getVoices(provider: AudioProvider): Voice[] { ... }
 */
export type AudioProvider = z.infer<typeof AudioProviderSchema>;

/**
 * Array of all supported audio provider values.
 */
export const AUDIO_PROVIDER_VALUES = AudioProviderSchema.options;

// =============================================================================
// MODEL PROVIDERS (Union for Model Registry)
// =============================================================================

/**
 * All model providers - union of LLM and audio providers.
 *
 * Used for ModelMetadata.provider where a model can be either LLM or audio.
 * Use LLMProvider or AudioProvider for operations that only work with one type.
 *
 * @example
 * interface ModelMetadata {
 *   provider: ModelProvider; // Can be any provider
 *   category: ModelCategory; // Distinguishes LLM vs audio
 * }
 */
export const ModelProviderSchema = z.enum([
  "openai",
  "anthropic",
  "google-genai",
  "groq",
  "cerebras",
  "elevenlabs",
]);

/**
 * Model Provider type - union of all providers for model registry.
 */
export type ModelProvider = z.infer<typeof ModelProviderSchema>;

/**
 * Array of all model provider values.
 */
export const MODEL_PROVIDER_VALUES = ModelProviderSchema.options;

// =============================================================================
// MODEL CATEGORY
// =============================================================================

/**
 * Model category for filtering models by capability type.
 *
 * - llm: Chat/completion models (GPT, Claude, Gemini, etc.)
 * - audio: TTS/STT models (ElevenLabs, OpenAI TTS)
 *
 * @example
 * const llmModels = models.filter(m => m.category === "llm");
 * const audioModels = models.filter(m => m.category === "audio");
 */
export const ModelCategorySchema = z.enum(["llm", "audio"]);

export type ModelCategory = z.infer<typeof ModelCategorySchema>;

// =============================================================================
// REASONING EFFORT (for o1/o3 models)
// =============================================================================

/**
 * Reasoning effort level for reasoning models (o1, o3, etc.)
 *
 * These models don't support temperature - use reasoningEffort instead:
 * - low: Faster responses, minimal reasoning
 * - medium: Balanced (default)
 * - high: Thorough reasoning, more tokens
 *
 * @example
 * const config = { model: "o1", reasoningEffort: "high" };
 */
export const ReasoningEffortSchema = z.enum(["low", "medium", "high"]);
export type ReasoningEffort = z.infer<typeof ReasoningEffortSchema>;

// =============================================================================
// PROVIDER METADATA & HELPERS
// =============================================================================

/**
 * LLM Provider metadata for display and capability checking
 */
export const LLM_PROVIDER_METADATA: Record<
  LLMProvider,
  {
    name: string;
    displayName: string;
    supportsStreaming: boolean;
    supportsTools: boolean;
  }
> = {
  openai: {
    name: "openai",
    displayName: "OpenAI",
    supportsStreaming: true,
    supportsTools: true,
  },
  anthropic: {
    name: "anthropic",
    displayName: "Anthropic",
    supportsStreaming: true,
    supportsTools: true,
  },
  "google-genai": {
    name: "google-genai",
    displayName: "Google Gemini",
    supportsStreaming: true,
    supportsTools: true,
  },
  groq: {
    name: "groq",
    displayName: "Groq",
    supportsStreaming: true,
    supportsTools: true,
  },
  cerebras: {
    name: "cerebras",
    displayName: "Cerebras",
    supportsStreaming: true,
    supportsTools: true,
  },
};

/**
 * Audio Provider metadata for display
 */
export const AUDIO_PROVIDER_METADATA: Record<
  AudioProvider,
  {
    name: string;
    displayName: string;
    supportsTTS: boolean;
    supportsSTT: boolean;
  }
> = {
  openai: {
    name: "openai",
    displayName: "OpenAI",
    supportsTTS: true,
    supportsSTT: true,
  },
  elevenlabs: {
    name: "elevenlabs",
    displayName: "ElevenLabs",
    supportsTTS: true,
    supportsSTT: false,
  },
};

/**
 * Type guard to check if a string is a valid LLM provider
 *
 * @example
 * if (isValidLLMProvider(provider)) {
 *   // provider is now type LLMProvider
 *   initChatModel(provider, model);
 * }
 */
export function isValidLLMProvider(provider: unknown): provider is LLMProvider {
  return typeof provider === "string" && LLM_PROVIDER_VALUES.includes(provider as LLMProvider);
}

/**
 * Type guard to check if a string is a valid audio provider
 */
export function isValidAudioProvider(provider: unknown): provider is AudioProvider {
  return typeof provider === "string" && AUDIO_PROVIDER_VALUES.includes(provider as AudioProvider);
}

/**
 * Type guard to check if a string is a valid model provider (any type)
 */
export function isValidModelProvider(provider: unknown): provider is ModelProvider {
  return typeof provider === "string" && MODEL_PROVIDER_VALUES.includes(provider as ModelProvider);
}

/**
 * Get LLM provider metadata
 * @throws Error if provider is not a valid LLM provider
 */
export function getLLMProviderMetadata(provider: LLMProvider) {
  const metadata = LLM_PROVIDER_METADATA[provider];
  if (!metadata) {
    throw new Error(`Unknown LLM provider: ${provider}`);
  }
  return metadata;
}

/**
 * Get audio provider metadata
 * @throws Error if provider is not a valid audio provider
 */
export function getAudioProviderMetadata(provider: AudioProvider) {
  const metadata = AUDIO_PROVIDER_METADATA[provider];
  if (!metadata) {
    throw new Error(`Unknown audio provider: ${provider}`);
  }
  return metadata;
}
