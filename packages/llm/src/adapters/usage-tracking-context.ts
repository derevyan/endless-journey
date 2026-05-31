/**
 * Usage Tracking Context
 *
 * Global adapter pattern for usage tracking, mirroring model-registry-context.ts.
 * Allows usage tracking to be optional and swappable in different runtime contexts.
 *
 * Default: NoopUsageAdapter (portable, no dependencies)
 * Server: DatabaseUsageAdapter (with @journey/db)
 *
 * @module adapters/usage-tracking-context
 */

import { createLogger } from "@journey/logger";
import { NoopUsageAdapter, type UsageTrackingAdapter } from "../services/usage-tracking-adapter";

const log = createLogger("llm:adapters:usageTracking");

// =============================================================================
// GLOBAL ADAPTER SINGLETON
// =============================================================================

let globalAdapter: UsageTrackingAdapter = new NoopUsageAdapter();

/**
 * Set the global usage tracking adapter
 *
 * Call this during server startup to configure usage tracking.
 * In portable contexts (browser/edge), the default NoopUsageAdapter is used.
 *
 * @param adapter - The usage tracking adapter to use
 *
 * @example
 * // In server startup
 * import { DatabaseUsageAdapter } from "@journey/llm/server";
 * setUsageTrackingAdapter(new DatabaseUsageAdapter());
 */
export function setUsageTrackingAdapter(adapter: UsageTrackingAdapter): void {
  globalAdapter = adapter;
  log.info({}, "llm:adapters:usageTracking:set");
}

/**
 * Get the global usage tracking adapter
 *
 * @returns The currently configured usage tracking adapter
 */
export function getUsageTrackingAdapter(): UsageTrackingAdapter {
  return globalAdapter;
}
