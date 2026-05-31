/**
 * LLM Usage Registry
 *
 * Registry of LLM services and models for display and filtering.
 * Single source of truth for UI components showing LLM usage data.
 *
 * @module llm/usage-registry
 */

// =============================================================================
// BADGE VARIANT TYPE
// =============================================================================

export type LlmBadgeVariant = "default" | "secondary" | "destructive" | "outline";

// =============================================================================
// LLM SERVICE NAMES (Single Source of Truth)
// =============================================================================

/**
 * Service name constants - use these instead of hardcoded strings.
 * This ensures TypeScript catches typos and unknown services.
 */
export const LLM_SERVICE_NAMES = {
  AGENT_WORKFLOW: "agent-workflow",
  AUDIO_SERVICE: "audio-service",
  QUESTION_UNDERSTANDING: "question-understanding",
  GUARD_SERVICE: "guard-service",
  EMBEDDING_SERVICE: "embedding-service",
  LLM_SERVICE: "llm-service",
  MINDSTATE: "mindstate",
  CONTENT_GENERATION: "content-generation",
  SUMMARIZER: "summarizer",
  CLASSIFIER: "classifier",
  EVALUATOR: "evaluator",
} as const;

export type LlmServiceName = (typeof LLM_SERVICE_NAMES)[keyof typeof LLM_SERVICE_NAMES];

// =============================================================================
// LLM SERVICES REGISTRY
// =============================================================================

/**
 * Registry of known LLM services with UI metadata.
 * Uses LLM_SERVICE_NAMES constants as keys.
 */
export const LLM_SERVICES: Record<LlmServiceName, { label: string; variant: LlmBadgeVariant; description: string }> = {
  [LLM_SERVICE_NAMES.AGENT_WORKFLOW]: { label: "agent-workflow", variant: "default", description: "Main agent workflow executor" },
  [LLM_SERVICE_NAMES.AUDIO_SERVICE]: { label: "audio-service", variant: "secondary", description: "STT/TTS voice processing" },
  [LLM_SERVICE_NAMES.QUESTION_UNDERSTANDING]: { label: "question-understanding", variant: "secondary", description: "Analyzes user questions" },
  [LLM_SERVICE_NAMES.GUARD_SERVICE]: { label: "guard-service", variant: "outline", description: "Input/output safety guards" },
  [LLM_SERVICE_NAMES.EMBEDDING_SERVICE]: { label: "embedding-service", variant: "outline", description: "Text embedding generation" },
  [LLM_SERVICE_NAMES.LLM_SERVICE]: { label: "llm-service", variant: "outline", description: "Generic LLM calls" },
  [LLM_SERVICE_NAMES.MINDSTATE]: { label: "mindstate", variant: "outline", description: "Mindstate analysis service" },
  [LLM_SERVICE_NAMES.CONTENT_GENERATION]: { label: "content-generation", variant: "secondary", description: "Generates dynamic content" },
  [LLM_SERVICE_NAMES.SUMMARIZER]: { label: "summarizer", variant: "outline", description: "Summarizes conversations" },
  [LLM_SERVICE_NAMES.CLASSIFIER]: { label: "classifier", variant: "outline", description: "Classifies user intent" },
  [LLM_SERVICE_NAMES.EVALUATOR]: { label: "evaluator", variant: "outline", description: "Evaluates responses" },
};

export type LlmServiceType = keyof typeof LLM_SERVICES;

/**
 * Get all LLM services for filter dropdowns
 */
export function getLlmServices(): { label: string; value: string; variant: LlmBadgeVariant; description: string }[] {
  return Object.entries(LLM_SERVICES).map(([value, meta]) => ({
    label: meta.label,
    value,
    variant: meta.variant,
    description: meta.description,
  }));
}

/**
 * Get display label for a service
 */
export function getLlmServiceLabel(service: string): string {
  return LLM_SERVICES[service as LlmServiceType]?.label ?? service;
}

/**
 * Get badge variant for a service
 */
export function getLlmServiceVariant(service: string): LlmBadgeVariant {
  return LLM_SERVICES[service as LlmServiceType]?.variant ?? "outline";
}

// =============================================================================
// LLM PROVIDERS REGISTRY
// =============================================================================

/**
 * Registry of known LLM providers.
 */
export const LLM_PROVIDERS = {
  openai: { label: "OpenAI", variant: "default" as const },
  anthropic: { label: "Anthropic", variant: "secondary" as const },
  "google-genai": { label: "Google AI", variant: "outline" as const },
  azure: { label: "Azure OpenAI", variant: "outline" as const },
} as const;

export type LlmProviderType = keyof typeof LLM_PROVIDERS;

/**
 * Get all LLM providers for filter dropdowns
 */
export function getLlmProviders(): { label: string; value: string; variant: LlmBadgeVariant }[] {
  return Object.entries(LLM_PROVIDERS).map(([value, meta]) => ({
    label: meta.label,
    value,
    variant: meta.variant,
  }));
}

/**
 * Get display label for a provider
 */
export function getLlmProviderLabel(provider: string): string {
  return LLM_PROVIDERS[provider as LlmProviderType]?.label ?? provider;
}

/**
 * Get badge variant for a provider
 */
export function getLlmProviderVariant(provider: string): LlmBadgeVariant {
  return LLM_PROVIDERS[provider as LlmProviderType]?.variant ?? "outline";
}

// =============================================================================
// COST FORMATTING
// =============================================================================

/**
 * Format cost in USD for display
 */
export function formatCostUSD(cost: string | number): string {
  const numCost = typeof cost === "string" ? parseFloat(cost) : cost;
  if (isNaN(numCost) || numCost === 0) return "$0.00";
  if (numCost < 0.01) return `$${numCost.toFixed(4)}`;
  return `$${numCost.toFixed(2)}`;
}

/**
 * Format token count for display
 */
export function formatTokenCount(tokens: number): string {
  if (tokens < 1000) return tokens.toString();
  if (tokens < 1000000) return `${(tokens / 1000).toFixed(1)}K`;
  return `${(tokens / 1000000).toFixed(2)}M`;
}

/**
 * Format duration in milliseconds for display
 */
export function formatDuration(ms: number | null | undefined): string {
  if (ms == null) return "-";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}
