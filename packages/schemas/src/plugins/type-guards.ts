/**
 * Plugin Type Guards
 *
 * Centralized type guards for plugin type narrowing.
 * Use these instead of inline `pluginType === "followup"` checks.
 *
 * @module plugins/type-guards
 */

import type { FollowUpPluginData, PluginData } from "./follow-up";
import type { PluginNode } from "./node";

// =============================================================================
// DATA TYPE GUARDS
// =============================================================================

/**
 * Type guard for FollowUpPluginData.
 * Use this to narrow PluginData to FollowUpPluginData.
 *
 * @example
 * ```ts
 * if (isFollowUpPluginData(plugin.data)) {
 *   // TypeScript now knows plugin.data is FollowUpPluginData
 *   const steps = plugin.data.steps;
 * }
 * ```
 */
export function isFollowUpPluginData(data: PluginData): data is FollowUpPluginData {
  return data.pluginType === "followup";
}

// =============================================================================
// PLUGIN NODE TYPE GUARDS
// =============================================================================

/**
 * Type guard for FollowUp plugin nodes.
 * Narrows PluginNode to include FollowUpPluginData.
 *
 * @example
 * ```ts
 * if (isFollowUpPlugin(plugin)) {
 *   // TypeScript knows plugin.data is FollowUpPluginData
 *   const exitPath = plugin.data.exitPath;
 * }
 * ```
 */
export function isFollowUpPlugin(
  plugin: PluginNode
): plugin is PluginNode & { data: FollowUpPluginData } {
  return plugin.data.pluginType === "followup";
}

// =============================================================================
// SAFE ASSERTIONS (with runtime checks)
// =============================================================================

/**
 * Assert that plugin data is FollowUpPluginData.
 * Throws if the assertion fails - use when you're certain about the type.
 *
 * @throws Error if data is not FollowUpPluginData
 *
 * @example
 * ```ts
 * // When you know the plugin type from context (e.g., in a followup-specific handler)
 * const followUpData = assertFollowUpPluginData(plugin.data);
 * ```
 */
export function assertFollowUpPluginData(data: PluginData): FollowUpPluginData {
  // Store pluginType before the type guard check for error message
  const actualType = data.pluginType;
  if (!isFollowUpPluginData(data)) {
    throw new Error(`Expected followup plugin data, got pluginType: ${actualType}`);
  }
  return data;
}
