/**
 * Usage Tracking Adapter Interface
 *
 * Defines an abstract interface for LLM usage tracking, decoupling
 * the tracking mechanism from the database implementation.
 *
 * This allows:
 * - Testing with mock adapters
 * - Different storage backends (DB, analytics, logs)
 * - Portable usage tracking in non-server contexts
 *
 * @module services/usage-tracking-adapter
 */

import type { TokenUsage, UsageContext } from "@journey/schemas";

// =============================================================================
// ADAPTER INTERFACE
// =============================================================================

/**
 * Usage tracking adapter interface
 *
 * Implement this interface to provide custom usage tracking storage.
 * The default implementation uses the database via usageTrackingService.
 */
export interface UsageTrackingAdapter {
  /**
   * Record a usage event
   *
   * @param usage - Token usage from LLM response
   * @param context - Context dimensions (org, journey, service, etc.)
   */
  recordUsage(usage: TokenUsage, context: UsageContext): void;

  /**
   * Initialize the adapter (optional)
   * Called on service startup
   */
  initialize?(): void;

  /**
   * Shutdown the adapter (optional)
   * Called on service shutdown, should flush pending events
   */
  shutdown?(): Promise<void>;

  /**
   * Check if the adapter is ready
   */
  isReady?(): boolean;
}

// =============================================================================
// NOOP ADAPTER (for testing/disabled tracking)
// =============================================================================

/**
 * No-op adapter that discards all usage events
 * Useful for testing or when tracking is disabled
 */
export class NoopUsageAdapter implements UsageTrackingAdapter {
  recordUsage(): void {
    // Intentionally empty - discard events
  }

  isReady(): boolean {
    return true;
  }
}

// =============================================================================
// LOGGING ADAPTER (for debugging)
// =============================================================================

import { createLogger } from "@journey/logger";

const log = createLogger("llm:usage-adapter");

/**
 * Logging adapter that outputs usage events to the logger
 * Useful for debugging or when you want usage in logs
 */
export class LoggingUsageAdapter implements UsageTrackingAdapter {
  recordUsage(usage: TokenUsage, context: UsageContext): void {
    log.info(
      {
        service: context.service,
        model: context.model,
        provider: context.provider,
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        totalTokens: usage.totalTokens,
        costUSD: usage.costUSD,
        durationMs: context.durationMs,
        organizationId: context.organizationId,
        journeyId: context.journeyId,
      },
      "usage:recorded"
    );
  }

  isReady(): boolean {
    return true;
  }
}

// =============================================================================
// COMPOSITE ADAPTER (multiple backends)
// =============================================================================

/**
 * Composite adapter that forwards to multiple backends
 * Useful for both database storage and logging
 */
export class CompositeUsageAdapter implements UsageTrackingAdapter {
  private adapters: UsageTrackingAdapter[];

  constructor(adapters: UsageTrackingAdapter[]) {
    this.adapters = adapters;
  }

  recordUsage(usage: TokenUsage, context: UsageContext): void {
    for (const adapter of this.adapters) {
      adapter.recordUsage(usage, context);
    }
  }

  initialize(): void {
    for (const adapter of this.adapters) {
      adapter.initialize?.();
    }
  }

  async shutdown(): Promise<void> {
    await Promise.all(this.adapters.map((a) => a.shutdown?.()));
  }

  isReady(): boolean {
    return this.adapters.every((a) => a.isReady?.() ?? true);
  }
}
