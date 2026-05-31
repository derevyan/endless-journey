/**
 * Audio Provider Types
 *
 * Defines interfaces for multi-provider audio services (STT/TTS).
 * Enables switching between OpenAI, ElevenLabs, and future providers.
 *
 * @module providers/types
 */

// =============================================================================
// Provider Types
// =============================================================================

/**
 * Supported audio providers
 */
export type AudioProvider = "openai" | "elevenlabs";

/**
 * Audio output formats supported across providers
 */
export type AudioFormat = "pcm16" | "mp3" | "opus" | "wav";

// =============================================================================
// STT (Speech-to-Text) Provider Interface
// =============================================================================

/**
 * Configuration for STT transcription
 */
export interface STTProviderConfig {
  /** Model ID for transcription (provider-specific) */
  model?: string;
  /** Language hint (ISO 639-1 code) */
  language?: string;
  /** Prompt to guide transcription style */
  prompt?: string;
  /** Organization ID for usage tracking */
  organizationId?: string;
  /** Journey session ID for linking to journey context */
  journeySessionId?: string;
  /** Journey ID for linking to journey context */
  journeyId?: string;
}

/**
 * Result of STT transcription
 */
export interface STTResult {
  /** Transcribed text */
  transcript: string;
  /** Detected language (if available) */
  language?: string;
  /** Audio duration in seconds */
  duration?: number;
}

/**
 * Speech-to-Text provider interface
 */
export interface STTProvider {
  /** Provider identifier */
  readonly name: AudioProvider;

  /**
   * Transcribe audio to text
   *
   * @param audio - Audio data as Buffer
   * @param filename - Original filename with extension
   * @param config - Transcription configuration
   * @returns Transcription result
   */
  transcribe(audio: Buffer, filename: string, config: STTProviderConfig): Promise<STTResult>;
}

// =============================================================================
// TTS (Text-to-Speech) Provider Interface
// =============================================================================

/**
 * Configuration for TTS generation
 */
export interface TTSProviderConfig {
  /** Model ID for TTS (provider-specific) */
  model?: string;
  /** Voice ID (provider-specific) */
  voice: string;
  /** Output audio format */
  format?: AudioFormat;
  /** Instructions for emotional/tonal control (OpenAI gpt-4o-mini-tts only) */
  instructions?: string;
  /** Organization ID for usage tracking */
  organizationId?: string;
  /** Journey session ID for linking to journey context */
  journeySessionId?: string;
  /** Journey ID for linking to journey context */
  journeyId?: string;
}

/**
 * Text-to-Speech provider interface
 */
export interface TTSProvider {
  /** Provider identifier */
  readonly name: AudioProvider;

  /**
   * Generate complete speech audio (non-streaming)
   *
   * @param text - Text to convert to speech
   * @param config - TTS configuration
   * @returns Audio data as ArrayBuffer
   */
  speak(text: string, config: TTSProviderConfig): Promise<ArrayBuffer>;

  /**
   * Generate streaming speech audio
   *
   * @param text - Text to convert to speech
   * @param config - TTS configuration
   * @yields Audio chunks as Uint8Array
   */
  speakStream(text: string, config: TTSProviderConfig): AsyncGenerator<Uint8Array, void, unknown>;
}

// =============================================================================
// Provider Factory Types
// =============================================================================

/**
 * Options for getting a provider
 */
export interface GetProviderOptions {
  /** Override the default provider */
  provider?: AudioProvider;
}

/**
 * Audio provider configuration for a specific provider
 */
export interface AudioProviderConfig {
  stt: {
    id: string;
    provider: AudioProvider;
  };
  tts: {
    stream: {
      id: string;
      provider: AudioProvider;
    };
    nonStream: {
      id: string;
      provider: AudioProvider;
    };
  };
  voices: ReadonlyArray<{
    id: string;
    label: string;
    gender: "male" | "female" | "neutral";
  }>;
  defaultVoice: string;
}
