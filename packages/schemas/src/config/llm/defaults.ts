/**
 * Unified LLM Configuration
 *
 * Top-level configuration that composes all domain-specific configs.
 * This is the primary export for LLM configuration across the system.
 *
 * Architecture:
 * - References domain configs (models, services, guards, QU)
 * - No duplication - each setting defined once
 * - Type-safe composition
 * - Easy to maintain - change a domain config, top-level updates automatically
 *
 * @example
 * import { llmConfig } from "@journey/schemas/config/llm";
 *
 * // Access any config section
 * const conversationModel = llmConfig.conversation.model;        // ModelConfig
 * const audioSTT = llmConfig.audio.stt;                          // ModelConfig
 * const guardsEnabled = llmConfig.guards.enabled;                // boolean
 * const questionUnderstanding = llmConfig.questionUnderstanding; // QU config
 */

import { LLM_PROVIDER_VALUES } from "../../llm/providers";
import {
  PRIMARY_MODEL,
  FALLBACK_MODEL,
  AGENT_MODEL,
  SUMMARIZATION_MODEL,
  EMBEDDING_MODEL,
} from "./models";
import { AUDIO_CONFIG, EMBEDDING_CONFIG, INTENT_CONFIG } from "./services";
import { GUARDS_CONFIG } from "./guards";
import { QUESTION_UNDERSTANDING_CONFIG } from "./question-understanding";
import type { ModelConfig } from "./models";
import type { GuardsConfig } from "./guards";
import type { QuestionUnderstandingConfigType } from "./question-understanding";
import type { ReasoningEffort } from "../../llm/providers";

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * Audio configuration type
 */
export type AudioConfigType = typeof AUDIO_CONFIG;

/**
 * Embedding configuration type
 */
export type EmbeddingConfigType = typeof EMBEDDING_CONFIG;

/**
 * Intent classification configuration type
 */
export type IntentConfigType = typeof INTENT_CONFIG;

/**
 * Providers configuration type
 */
export interface ProvidersConfigType {
  readonly supported: readonly (typeof LLM_PROVIDER_VALUES)[number][];
}

/**
 * Agent configuration type
 * Note: Uses reasoningEffort instead of temperature for reasoning models like gemini-3-flash-preview
 */
export interface AgentConfigType {
  model: ModelConfig;
  reasoningEffort: ReasoningEffort;
  maxRetries: number;
  maxIterations: number;
  timeoutSeconds: number;
}

/**
 * Conversation configuration type
 * Uses reasoningEffort instead of temperature for Gemini Flash 3 (ultrathink mode)
 */
export interface ConversationConfigType {
  model: ModelConfig;
  fallback: ModelConfig;
  reasoningEffort: ReasoningEffort;
  maxTokens: number;
  maxMessages: number;
}

/**
 * Summarization configuration type
 */
export interface SummarizationConfigType {
  model: ModelConfig;
  triggerMessages: number;
  keepMessages: number;
  temperature: number;
}

/**
 * Complete LLM configuration type
 */
export type LLMConfigType = {
  conversation: ConversationConfigType;
  agent: AgentConfigType;
  summarization: SummarizationConfigType;
  audio: AudioConfigType;
  embedding: EmbeddingConfigType;
  intent: IntentConfigType;
  guards: GuardsConfig;
  questionUnderstanding: QuestionUnderstandingConfigType;
  providers: ProvidersConfigType;
};

// =============================================================================
// Configuration Composition
// =============================================================================

/**
 * Unified LLM Configuration
 *
 * Single source of truth for all LLM settings.
 * References domain configs to prevent duplication.
 *
 * Structure:
 * - conversation: Primary chat model and fallback
 * - agent: Agent execution model
 * - summarization: Conversation summarization model
 * - audio: STT/TTS models
 * - embedding: Text embedding model
 * - intent: Intent classification model
 * - guards: Content moderation guards
 * - questionUnderstanding: Multi-model question understanding pipeline
 * - providers: Supported LLM providers
 */
export const llmConfig = {
  /**
   * Conversation Configuration
   * Primary model for user conversations and interactions
   * Uses reasoningEffort: "high" (ultrathink) for Gemini Flash 3
   */
  conversation: {
    model: PRIMARY_MODEL,
    fallback: FALLBACK_MODEL,
    reasoningEffort: "high",
    maxTokens: 2000,
    maxMessages: 12,
  } satisfies ConversationConfigType,

  /**
   * Agent Configuration
   * Model and parameters for agent node execution
   * Note: Uses reasoningEffort for gemini-3-flash-preview (reasoning model)
   */
  agent: {
    model: AGENT_MODEL,
    reasoningEffort: "high",
    maxRetries: 2,
    maxIterations: 10,
    timeoutSeconds: 60,
  } satisfies AgentConfigType,

  /**
   * Summarization Configuration
   * Model and strategy for conversation summarization
   */
  summarization: {
    model: SUMMARIZATION_MODEL,
    triggerMessages: 20,
    keepMessages: 6,
    temperature: 0.3,
  } satisfies SummarizationConfigType,

  /**
   * Audio Configuration
   * Speech-to-text and text-to-speech models
   */
  audio: AUDIO_CONFIG,

  /**
   * Embedding Configuration
   * Text embedding model and dimensions
   */
  embedding: EMBEDDING_CONFIG,

  /**
   * Intent Classification Configuration
   * Model and parameters for intent classification
   */
  intent: INTENT_CONFIG,

  /**
   * Guards Configuration
   * Content moderation guards and system prompts
   */
  guards: GUARDS_CONFIG,

  /**
   * Question Understanding Configuration
   * Multi-model pipeline for question understanding
   */
  questionUnderstanding: QUESTION_UNDERSTANDING_CONFIG,

  /**
   * Providers Configuration
   * List of supported LLM providers
   */
  providers: {
    supported: [...LLM_PROVIDER_VALUES],
  },
} as const satisfies LLMConfigType;

// Note: Type exports for AudioConfigType, EmbeddingConfigType, IntentConfigType
// are handled via services.ts - no need to re-export here
