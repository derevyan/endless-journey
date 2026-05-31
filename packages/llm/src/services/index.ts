/**
 * Services barrel export
 *
 * Re-exports all service functions, types, and singletons from this directory.
 */

// LLM Service (main chat/structured output)
export {
  generateStructuredOutput,
  generateChatResponse,
  generateChatResponseStream,
  generateChatResponseIterator,
  clearModelCache,
  type LLMConfig,
  type LLMResponse,
  type TokenUsage,
  type ChatMessage,
  type StreamCallbacks,
} from "./llm-service";

// Audio Service (STT/TTS)
// Note: VoiceProfile type is canonical in @journey/schemas (import from there)
export {
  transcribeAudio,
  generateSpeechStream,
  generateSpeechIterator,
  generateSpeech,
  type STTConfig,
  type TTSConfig,
  type STTResult,
  type TTSStreamCallbacks,
} from "./audio-service";

// Embedding Service
export {
  generateEmbedding,
  generateEmbeddings,
  type EmbeddingConfig,
  type EmbeddingResult,
} from "./embedding-service";

// Model Registry Service
export { modelRegistryService, type ModelMetadata } from "./model-registry-service";

// Guard Service (LLM-based guardrails)
export {
  evaluateGuards,
  type GuardWorkerResult,
  type GuardEvaluationResult,
  type GuardEvaluationOptions,
} from "./guard-service";

// Usage Tracking Service
export { usageTrackingService } from "./usage-tracking-service";
export {
  type UsageTrackingAdapter,
  NoopUsageAdapter,
  LoggingUsageAdapter,
  CompositeUsageAdapter,
} from "./usage-tracking-adapter";

// Question Understanding Service
export {
  executeQuestionUnderstanding,
  DEFAULT_WORKER_SYSTEM_PROMPT,
  DEFAULT_EVALUATOR_SYSTEM_PROMPT,
  type WorkerContext,
  type WorkerOutput,
  type EvaluatorOutput,
} from "./question-understanding";
