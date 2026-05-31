/**
 * LLM Model Configurations
 *
 * Central registry of all LLM models used across the system.
 * Each model includes both ID and provider - they cannot drift apart.
 *
 * @example
 * import { PRIMARY_MODEL, FALLBACK_MODEL } from "@journey/schemas/config/llm/models";
 *
 * const config = {
 *   model: PRIMARY_MODEL,      // { id: "gemini-3-flash-preview", provider: "google-genai" }
 *   fallback: FALLBACK_MODEL,  // { id: "claude-haiku-4-5-20251001", provider: "anthropic" }
 * };
 */

import type { LLMProvider } from "../../llm/providers";

/**
 * Model configuration bundling model ID with its provider
 * This ensures model and provider cannot drift apart
 */
export interface ModelConfig {
  /** Model identifier */
  id: string;
  /** Provider for this model */
  provider: LLMProvider;
  /** Optional display name for UI */
  displayName?: string;
  /**
   * Whether this model supports temperature settings (false = reasoning-only model)
   * When false, MUST use reasoningEffort instead of temperature
   */
  supportsTemperature?: boolean;
  /**
   * Whether this model supports reasoningEffort (thinking budget)
   * When true AND supportsTemperature is also true, we PREFER reasoningEffort
   * This handles hybrid models that support both but work better with explicit reasoning
   */
  supportsReasoning?: boolean;
}

// =============================================================================
// Primary Conversation Models
// =============================================================================

/**
 * Primary model for general conversation and interactions
 * Fast, cost-effective, good quality
 * Uses reasoningEffort: "high" (ultrathink) instead of temperature
 */
export const PRIMARY_MODEL: ModelConfig = {
  id: "gemini-3-flash-preview",
  provider: "google-genai",
  displayName: "Gemini Flash 3",
  supportsTemperature: false,
};

/**
 * Fallback model when primary is unavailable
 * High quality, reliable, different provider for redundancy
 */
export const FALLBACK_MODEL: ModelConfig = {
  id: "claude-haiku-4-5-20251001",
  provider: "anthropic",
  displayName: "Claude Haiku 4.5",
};

// =============================================================================
// Agent Execution Models
// =============================================================================

/**
 * Model for agent node execution
 * Same as primary model - good balance of speed and capability
 * Uses reasoningEffort: "high" (ultrathink) instead of temperature
 */
export const AGENT_MODEL: ModelConfig = {
  id: "gemini-3-flash-preview",
  provider: "google-genai",
  displayName: "Gemini Flash 3",
  supportsTemperature: false,
};

// =============================================================================
// Summarization Models
// =============================================================================

/**
 * Model for conversation summarization
 * Fast and cheap from Groq for cost-effective summarization
 */
export const SUMMARIZATION_MODEL: ModelConfig = {
  id: "llama-3.1-8b-instant",
  provider: "groq",
  displayName: "Llama 3.1 8B (via Groq)",
};

// =============================================================================
// Embedding Model
// =============================================================================

/**
 * Model for text embeddings
 * OpenAI's text-embedding-3-small with 1536 dimensions
 */
export const EMBEDDING_MODEL: ModelConfig = {
  id: "text-embedding-3-small",
  provider: "openai",
  displayName: "Text Embedding 3 Small",
};

// =============================================================================
// Guard Models
// =============================================================================

/**
 * Safety guard model for harmful content detection
 */
export const GUARD_SAFETY_MODEL: ModelConfig = {
  id: "meta-llama/llama-guard-4-12b",
  provider: "groq",
  displayName: "Llama Guard 4 (Safety)",
};

/**
 * Policy compliance guard model
 */
export const GUARD_POLICY_MODEL: ModelConfig = {
  id: "openai/gpt-oss-safeguard-20b",
  provider: "groq",
  displayName: "GPT OSS Safeguard (Policy)",
};

/**
 * Prompt injection detection guard model
 */
export const GUARD_INJECTION_MODEL: ModelConfig = {
  id: "meta-llama/llama-prompt-guard-2-86m",
  provider: "groq",
  displayName: "Llama Prompt Guard (Injection)",
};

/**
 * Spam detection guard model
 */
export const GUARD_SPAM_MODEL: ModelConfig = {
  id: "llama-3.1-8b-instant",
  provider: "groq",
  displayName: "Llama 3.1 8B (Spam)",
};

// =============================================================================
// Question Understanding Models
// =============================================================================

/**
 * Question Understanding Worker 1 - GPT 4O Mini via OpenAI
 */
export const QU_WORKER_1_MODEL: ModelConfig = {
  id: "gpt-4o-mini",
  provider: "openai",
  displayName: "GPT-4O Mini",
};

/**
 * Question Understanding Worker 2 - GPT 4.1 Mini via OpenAI
 */
export const QU_WORKER_2_MODEL: ModelConfig = {
  id: "gpt-4.1-mini",
  provider: "openai",
  displayName: "GPT-4.1 Mini",
};

/**
 * Question Understanding Worker 3 - Claude Haiku via Anthropic
 */
export const QU_WORKER_3_MODEL: ModelConfig = {
  id: "claude-haiku-4-5-20251001",
  provider: "anthropic",
  displayName: "Claude Haiku 4.5",
};

/**
 * Question Understanding Worker 4 - Gemini Flash via Google
 * Uses reasoningEffort: "high" (ultrathink) instead of temperature
 */
export const QU_WORKER_4_MODEL: ModelConfig = {
  id: "gemini-3-flash-preview",
  provider: "google-genai",
  displayName: "Gemini Flash 3",
  supportsTemperature: false,
};

/**
 * Question Understanding Worker 5 - GPT OSS via Groq
 */
export const QU_WORKER_5_MODEL: ModelConfig = {
  id: "openai/gpt-oss-120b",
  provider: "groq",
  displayName: "GPT OSS 120B",
};

/**
 * Question Understanding Evaluator - Claude Haiku via Anthropic
 */
export const QU_EVALUATOR_MODEL: ModelConfig = {
  id: "claude-haiku-4-5",
  provider: "anthropic",
  displayName: "Claude Haiku 4.5",
};

/**
 * Question Understanding Evaluator Backup 1 - Gemini Pro via Google
 */
export const QU_EVALUATOR_BACKUP_1_MODEL: ModelConfig = {
  id: "gemini-2.5-pro",
  provider: "google-genai",
  displayName: "Gemini 2.5 Pro",
};

/**
 * Question Understanding Evaluator Backup 2 - GPT OSS via Groq
 */
export const QU_EVALUATOR_BACKUP_2_MODEL: ModelConfig = {
  id: "openai/gpt-oss-120b",
  provider: "groq",
  displayName: "GPT OSS 120B",
};

