/**
 * LLM Configuration Module
 *
 * Exports all configuration defaults for the @journey/llm package.
 */

// App-level config (directly from @journey/schemas - no re-export layer)
export { llmConfig } from "@journey/schemas";

// Provider type (canonical from provider registry)
export type { LLMProvider as SupportedLLMProvider } from "@journey/schemas";

// Internal package defaults (used within @journey/llm)
export {
  LLM_DEFAULTS,
  AUDIO_DEFAULTS,
  MIDDLEWARE_DEFAULTS,
  RETRY_DEFAULTS,
  EXTERNAL_TOOL_DEFAULTS,
} from "./defaults";

// Essential models (browser-safe, no Node.js dependencies)
// Re-exported from @journey/schemas (single source of truth)
export {
  ESSENTIAL_MODELS,
  getEssentialModelIds,
  type EssentialModelId,
} from "@journey/schemas";
