/**
 * LLM Configuration Public API
 *
 * Exports all LLM configuration components for use throughout the system.
 *
 * @example
 * // Import individual components
 * import { PRIMARY_MODEL, AUDIO_CONFIG, llmConfig } from "@journey/schemas/config/llm";
 *
 * // Or import provider types from canonical location
 * import { LLMProviderSchema, type LLMProvider } from "@journey/schemas";
 * import { GUARD_WORKERS } from "@journey/schemas/config/llm/guards";
 */

// Re-export provider types from canonical location (llm/providers.ts)
export {
  LLM_PROVIDER_VALUES,
  LLM_PROVIDER_METADATA,
  isValidLLMProvider,
  getLLMProviderMetadata,
  type LLMProvider,
} from "../../llm/providers";

// Re-export model configurations
export {
  type ModelConfig,
  PRIMARY_MODEL,
  FALLBACK_MODEL,
  AGENT_MODEL,
  SUMMARIZATION_MODEL,
  EMBEDDING_MODEL,
  GUARD_SAFETY_MODEL,
  GUARD_POLICY_MODEL,
  GUARD_INJECTION_MODEL,
  GUARD_SPAM_MODEL,
  QU_WORKER_1_MODEL,
  QU_WORKER_2_MODEL,
  QU_WORKER_3_MODEL,
  QU_WORKER_4_MODEL,
  QU_WORKER_5_MODEL,
  QU_EVALUATOR_MODEL,
  QU_EVALUATOR_BACKUP_1_MODEL,
  QU_EVALUATOR_BACKUP_2_MODEL,
} from "./models";

// Re-export service configurations
export {
  AUDIO_CONFIG,
  EMBEDDING_CONFIG,
  INTENT_CONFIG,
} from "./services";

// Re-export guards configuration
export {
  type LLMGuardWorkerConfig,
  type GuardsConfig,
  GUARD_WORKERS,
  GUARDS_CONFIG,
} from "./guards";

// Re-export question understanding configuration
export {
  type QUWorkerConfig,
  type QUEvaluatorConfig,
  type QUFallbackConfig,
  type QuestionUnderstandingConfigType,
  QU_WORKERS,
  QU_EVALUATOR,
  QU_FALLBACK,
  QUESTION_UNDERSTANDING_CONFIG,
} from "./question-understanding";

// Re-export top-level configuration
export {
  llmConfig,
  type LLMConfigType,
  type AudioConfigType,
  type EmbeddingConfigType,
  type IntentConfigType,
  type AgentConfigType,
  type ConversationConfigType,
  type SummarizationConfigType,
  type ProvidersConfigType,
} from "./defaults";
