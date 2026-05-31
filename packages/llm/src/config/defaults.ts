/**
 * Internal LLM Package Defaults
 *
 * Configuration values used within the @journey/llm package.
 *
 * Configuration Hierarchy:
 * 1. @journey/schemas/app-defaults.ts  (canonical source for app-wide defaults)
 * 2. @journey/llm/config/app-defaults.ts  (re-exports from schemas)
 * 3. @journey/llm/config/defaults.ts  (this file - package-specific defaults)
 *
 * Use @journey/llm/config to import all defaults.
 */

import { AUDIO_CONFIG } from "@journey/schemas/config";

// =============================================================================
// LLM Service Defaults
// =============================================================================

/**
 * Core LLM service configuration
 */
export const LLM_DEFAULTS = {
  /** Temperature for structured output (low for consistency) */
  TEMPERATURE_STRUCTURED: 0.3,
  /** Temperature for chat responses (higher for creativity) */
  TEMPERATURE_CHAT: 0.7,
  /** Default retry count */
  MAX_RETRIES: 2,
  /** Max agent loop iterations */
  MAX_ITERATIONS: 10,
} as const;

// =============================================================================
// Audio Service Defaults
// =============================================================================

/**
 * Audio service (STT/TTS) configuration
 */
export const AUDIO_DEFAULTS = {
  /** Default model for speech-to-text */
  STT_MODEL: AUDIO_CONFIG.stt.id,
  /** Default model for streaming text-to-speech */
  TTS_MODEL_STREAM: AUDIO_CONFIG.tts.stream.id,
  /** Default model for non-streaming text-to-speech */
  TTS_MODEL: AUDIO_CONFIG.tts.nonStream.id,
  /** Default voice */
  VOICE: "ash" as const,
  /** Default audio format */
  FORMAT: "pcm16" as const,
} as const;

// =============================================================================
// Middleware Defaults
// =============================================================================

/**
 * Built-in middleware configuration
 */
export const MIDDLEWARE_DEFAULTS = {
  /** Human-in-the-loop timeout in milliseconds (5 minutes) */
  HITL_TIMEOUT_MS: 300000,
  /** PII masking character */
  PII_MASK_CHAR: "*",
  /** Number of characters to keep visible when masking */
  PII_MASK_KEEP_LAST: 4,
  /** Default redaction text */
  PII_REDACTION_TEXT: "[REDACTED]",
  /** Summarization temperature (low for consistency) */
  SUMMARIZATION_TEMPERATURE: 0.3,
  /** Default context window for summarization */
  SUMMARIZATION_CONTEXT_WINDOW: 128000,
  /** Default summary max tokens */
  SUMMARIZATION_MAX_TOKENS: 400,
  /** Default summary prefix */
  SUMMARIZATION_PREFIX: "[Summary of previous conversation]\n",
  /** Default messages to keep after summarization */
  SUMMARIZATION_KEEP_MESSAGES: 6,
} as const;

// =============================================================================
// Tool Retry Defaults
// =============================================================================

/**
 * Tool retry configuration
 */
export const RETRY_DEFAULTS = {
  /** Maximum retry attempts */
  MAX_RETRIES: 2,
  /** Initial delay before first retry (ms) */
  INITIAL_DELAY_MS: 500,
  /** Backoff multiplier */
  BACKOFF_FACTOR: 2.0,
  /** Initial delay for agent tool retry (ms) */
  AGENT_INITIAL_DELAY_MS: 1000,
} as const;

// =============================================================================
// External Tool Defaults
// =============================================================================

/**
 * External tool configuration
 */
export const EXTERNAL_TOOL_DEFAULTS = {
  /** Tavily search max retries */
  TAVILY_MAX_RETRIES: 2,
  /** Tavily search max results */
  TAVILY_MAX_RESULTS: 5,
  /** Tavily search depth */
  TAVILY_SEARCH_DEPTH: "basic" as const,
} as const;
