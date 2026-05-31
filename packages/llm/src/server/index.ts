/**
 * Server-only exports for @journey/llm
 *
 * This entrypoint includes Node.js-specific dependencies:
 * - model-registry-service (uses ESSENTIAL_MODELS from @journey/schemas)
 * - usage-tracking-service (@journey/db for PostgreSQL)
 * - audio-service (node:fs for temp files)
 * - usage-tracking middleware (database adapter)
 *
 * Import from "@journey/llm/server" in backend code only.
 * Do NOT import in browser or edge worker environments.
 */

import { createLogger } from "@journey/logger";
import { setUsageTrackingAdapter } from "../adapters/usage-tracking-context";
import { usageTrackingService } from "../services/usage-tracking-service";

const log = createLogger("llm:server");

// Model Registry Service (pre-compiled model metadata)
export {
  modelRegistryService,
  type ModelMetadata,
} from "../services/model-registry-service";

// Usage Tracking Service
export { usageTrackingService } from "../services/usage-tracking-service";
export {
  type UsageTrackingAdapter,
  NoopUsageAdapter,
  LoggingUsageAdapter,
  CompositeUsageAdapter,
} from "../services/usage-tracking-adapter";

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
} from "../services/audio-service";

// Server-only middleware (requires database adapter)
export {
  createUsageTrackingMiddleware,
  type UsageTrackingMiddlewareConfig,
} from "../middleware/builtin/usage-tracking";

// Server-only adapter implementations
// Note: Use EssentialModelAdapter from @journey/llm/adapters for both edge and server

// Adapter context (global singleton)
export {
  setModelRegistryAdapter,
  getModelRegistryAdapter,
} from "../adapters/model-registry-context";

export {
  setUsageTrackingAdapter,
  getUsageTrackingAdapter,
} from "../adapters/usage-tracking-context";

/**
 * Initialize server-side LLM services
 *
 * Call this during application startup to configure:
 * - Usage tracking adapter (for recording token usage and costs)
 *
 * @example
 * ```typescript
 * import { initializeServerServices } from "@journey/llm/server";
 *
 * // During app startup
 * initializeServerServices();
 * ```
 */
export function initializeServerServices(): void {
  // Set the usage tracking service as the global adapter
  // This allows all LLM services to record usage to the database
  setUsageTrackingAdapter(usageTrackingService);

  // Initialize the service (starts background flush interval)
  // CRITICAL: Without this, isReady() returns false and all tracking is skipped
  usageTrackingService.initialize();

  log.info(
    {
      bufferSize: 100,
      flushIntervalMs: 5000,
    },
    "llm:server:initialized - Usage tracking active"
  );
}
