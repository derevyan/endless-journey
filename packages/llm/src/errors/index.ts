/**
 * Error Classification Module
 *
 * Provides provider-aware error detection and classification for LLM errors.
 *
 * Features:
 * - SDK-specific error detection (OpenAI, Anthropic, Google)
 * - Fallback string matching for unknown errors
 * - Circuit breaker error handling
 * - Retry strategy suggestions
 *
 * @example
 * ```typescript
 * import { classifyError, isRetryableError } from "@journey/llm/errors";
 *
 * try {
 *   await generateChatResponse(prompt, messages, config);
 * } catch (error) {
 *   const classification = classifyError(error);
 *
 *   if (classification.type === "rate_limit") {
 *     // Wait and retry with backoff
 *     await delay(classification.retryAfterMs ?? 1000);
 *   } else if (classification.type === "auth") {
 *     // Don't retry, notify user about API key issue
 *   } else if (classification.retryable) {
 *     // Generic retry logic
 *   }
 * }
 * ```
 */

// Main classifier functions (public API)
export { classifyError, isRetryableError, getErrorType, getRetryAfterMs } from "./classifier";

// Types (public API)
export type { LLMErrorType, ErrorClassification } from "./types";
