import type { ModelProvider, ModelCategory } from "./providers";

/**
 * Audio model UI metadata (TTS/STT only)
 * Used for model selection dropdowns and descriptions
 */
export interface AudioModelMetadata {
  /** UI display label for model selection */
  label: string;
  /** Model description for tooltips/help text */
  description: string;
  /** Number of supported languages (for display) */
  languages?: number;
  /** Whether model is experimental/alpha */
  experimental?: boolean;
  /** Audio model type */
  type: "tts" | "stt";
}

/**
 * Model metadata entry (lightweight format for runtime lookups)
 * Browser-safe: Contains only data, no Node.js dependencies
 */
export interface ModelMetadata {
  id: string;
  displayName: string;
  provider: ModelProvider;
  /** Model category: "llm" for chat/completion, "audio" for TTS/STT */
  category: ModelCategory;
  supportsTemperature: boolean;
  /**
   * Whether to use reasoningEffort even when temperature is supported.
   * For hybrid models that support both, we prefer reasoningEffort when true.
   */
  supportsReasoning?: boolean;
  capabilities: {
    reasoning: boolean;
    vision: boolean;
    toolCalling: boolean;
  };
  contextWindow: number;
  outputLimit: number;
  pricing: {
    input: number; // per million tokens
    output: number;
    cacheRead?: number;
    cacheWrite?: number;
    perCharacter?: number; // For TTS (cost per character in USD)
    perSecond?: number; // For STT (cost per second of audio in USD)
  };
  /** Audio-specific UI metadata (only for TTS/STT models) */
  audio?: AudioModelMetadata;
}
