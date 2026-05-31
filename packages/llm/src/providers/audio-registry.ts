/**
 * Audio Provider Registry
 *
 * Factory functions for getting STT and TTS providers.
 * Supports multiple providers (OpenAI, ElevenLabs) with easy extensibility.
 *
 * @module providers/audio-registry
 *
 * @example
 * // Get default providers (from AUDIO_CONFIG)
 * const sttProvider = getSTTProvider();
 * const ttsProvider = getTTSProvider();
 *
 * // Get specific provider
 * const elevenLabsTTS = getTTSProvider({ provider: "elevenlabs" });
 */

import { AUDIO_CONFIG } from "@journey/schemas/config";
import { createLogger } from "@journey/logger";

import type { AudioProvider, STTProvider, TTSProvider, GetProviderOptions } from "./types";
import { getOpenAISTTProvider, getOpenAITTSProvider } from "./openai-audio";
import { getElevenLabsSTTProvider, getElevenLabsTTSProvider } from "./elevenlabs-audio";

const log = createLogger("llm:audio:registry");

// =============================================================================
// Provider Registry
// =============================================================================

// Lazy-loaded provider getters to avoid circular dependencies
type ProviderGetter<T> = () => T;

const sttProviders: Record<AudioProvider, ProviderGetter<STTProvider>> = {
  openai: getOpenAISTTProvider,
  elevenlabs: getElevenLabsSTTProvider,
};

const ttsProviders: Record<AudioProvider, ProviderGetter<TTSProvider>> = {
  openai: getOpenAITTSProvider,
  elevenlabs: getElevenLabsTTSProvider,
};

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Get the default STT provider from configuration
 */
function getDefaultSTTProvider(): AudioProvider {
  // Check if providers config exists (new format)
  const config = AUDIO_CONFIG as { providers?: { stt?: AudioProvider } };
  if (config.providers?.stt) {
    return config.providers.stt;
  }
  // Fall back to OpenAI (current behavior)
  return "openai";
}

/**
 * Get the default TTS provider from configuration
 */
function getDefaultTTSProvider(): AudioProvider {
  const config = AUDIO_CONFIG as { providers?: { tts?: AudioProvider } };
  if (config.providers?.tts) {
    return config.providers.tts;
  }
  return "openai";
}

/**
 * Get an STT provider
 *
 * @param options - Provider options
 * @returns STT provider instance
 *
 * @example
 * // Get default provider
 * const provider = getSTTProvider();
 *
 * // Get specific provider
 * const openaiSTT = getSTTProvider({ provider: "openai" });
 */
export function getSTTProvider(options: GetProviderOptions = {}): STTProvider {
  const providerName = options.provider ?? getDefaultSTTProvider();

  const providerGetter = sttProviders[providerName];
  if (!providerGetter) {
    log.error({ provider: providerName }, "audio:registry:stt:unknownProvider");
    throw new Error(`Unknown STT provider: ${providerName}`);
  }

  log.debug({ provider: providerName }, "audio:registry:stt:getProvider");
  return providerGetter();
}

/**
 * Get a TTS provider
 *
 * @param options - Provider options
 * @returns TTS provider instance
 *
 * @example
 * // Get default provider
 * const provider = getTTSProvider();
 *
 * // Get specific provider
 * const elevenLabsTTS = getTTSProvider({ provider: "elevenlabs" });
 */
export function getTTSProvider(options: GetProviderOptions = {}): TTSProvider {
  const providerName = options.provider ?? getDefaultTTSProvider();

  const providerGetter = ttsProviders[providerName];
  if (!providerGetter) {
    log.error({ provider: providerName }, "audio:registry:tts:unknownProvider");
    throw new Error(`Unknown TTS provider: ${providerName}`);
  }

  log.debug({ provider: providerName }, "audio:registry:tts:getProvider");
  return providerGetter();
}

/**
 * Check if a provider is available (API key configured)
 */
export function isProviderAvailable(provider: AudioProvider): boolean {
  switch (provider) {
    case "openai":
      return !!process.env.OPENAI_API_KEY;
    case "elevenlabs":
      return !!process.env.ELEVENLABS_API_KEY;
    default:
      return false;
  }
}

/**
 * Get list of available providers (those with API keys configured)
 */
export function getAvailableProviders(): AudioProvider[] {
  const providers: AudioProvider[] = ["openai", "elevenlabs"];
  return providers.filter(isProviderAvailable);
}
