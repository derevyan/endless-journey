/**
 * Configuration Module
 *
 * Exports unified configuration for LLM services and question understanding.
 *
 * Primary exports:
 * - New LLM configuration from ./llm (domain-based, type-safe)
 */

// ============================================================================
// New Unified LLM Configuration (Type-Safe, No Deprecation)
// ============================================================================
// Provider registry and utilities (from canonical llm/providers.ts)
export {
  LLM_PROVIDER_VALUES,
  LLM_PROVIDER_METADATA,
  isValidLLMProvider,
  getLLMProviderMetadata,
  type LLMProvider,
} from "../llm/providers";

// Model configurations
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
} from "./llm/models";

// Service configurations
export {
  AUDIO_CONFIG,
  EMBEDDING_CONFIG,
  INTENT_CONFIG,
  // ElevenLabs models (from essential-models.ts, re-exported via services.ts)
  ELEVENLABS_TTS_MODELS,
  ELEVENLABS_STT_MODELS,
  getVoicesForProvider,
  getDefaultVoiceForProvider,
  type AudioProvider,
  type VoiceCategory,
  type VoiceInfo,
  type VoicesResponse,
  type ElevenLabsTtsModelId,
  type ElevenLabsSttModelId,
  type ElevenLabsModelConfig,
} from "./llm/services";

// Guard configurations
export {
  type LLMGuardWorkerConfig,
  type GuardsConfig,
  GUARD_WORKERS,
  GUARDS_CONFIG,
} from "./llm/guards";

// Question understanding configuration
export {
  type QUWorkerConfig,
  type QUEvaluatorConfig,
  type QUFallbackConfig,
  type QuestionUnderstandingConfigType,
  QU_WORKERS,
  QU_EVALUATOR,
  QU_FALLBACK,
  QUESTION_UNDERSTANDING_CONFIG,
} from "./llm/question-understanding";

// Top-level configuration
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
} from "./llm/defaults";

