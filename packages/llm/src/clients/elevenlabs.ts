/**
 * ElevenLabs API Client
 *
 * Provides functions to interact with ElevenLabs API for TTS and STT.
 * Uses the xi-api-key header for authentication.
 *
 * @module clients/elevenlabs
 */

import { LLMAuthError } from "../types";

// =============================================================================
// Constants
// =============================================================================

export const ELEVENLABS_BASE_URL = "https://api.elevenlabs.io/v1";

// =============================================================================
// Client Management
// =============================================================================

let elevenLabsApiKey: string | null = null;

/**
 * Get the ElevenLabs API key from environment
 *
 * @throws LLMAuthError if ELEVENLABS_API_KEY is not set
 */
export function getElevenLabsApiKey(): string {
  if (!elevenLabsApiKey) {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      throw new LLMAuthError("elevenlabs", new Error("ELEVENLABS_API_KEY environment variable is not set"));
    }
    elevenLabsApiKey = apiKey;
  }
  return elevenLabsApiKey;
}

/**
 * Get headers for ElevenLabs API requests (JSON)
 */
export function getElevenLabsHeaders(): Record<string, string> {
  return {
    "xi-api-key": getElevenLabsApiKey(),
    "Content-Type": "application/json",
  };
}

/**
 * Get headers for ElevenLabs API requests (multipart/form-data)
 * Note: Don't set Content-Type for FormData - browser/fetch will set it automatically
 */
export function getElevenLabsFormHeaders(): Record<string, string> {
  return {
    "xi-api-key": getElevenLabsApiKey(),
  };
}

/**
 * Clear the cached API key
 *
 * Useful for testing or when API keys change at runtime.
 */
export function clearElevenLabsApiKey(): void {
  elevenLabsApiKey = null;
}

/**
 * Check if ElevenLabs API key is configured
 */
export function isElevenLabsConfigured(): boolean {
  return !!process.env.ELEVENLABS_API_KEY;
}

// =============================================================================
// Audio Format Mapping
// =============================================================================

/**
 * Map internal audio format to ElevenLabs output_format parameter
 */
export function mapToElevenLabsFormat(format: string): string {
  const formatMap: Record<string, string> = {
    mp3: "mp3_44100_128",
    pcm16: "pcm_24000",
    wav: "pcm_44100",
    opus: "opus_48000_64", // OGG/Opus for Telegram voice messages
  };
  return formatMap[format] ?? "mp3_44100_128";
}
