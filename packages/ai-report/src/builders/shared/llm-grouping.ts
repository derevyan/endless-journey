/**
 * Shared LLM Grouping
 *
 * Consolidates LLM event grouping logic used by conversation-builder and workflow-builder.
 *
 * @module @journey/ai-report/builders/shared/llm-grouping
 */

import type { LLMUsageRecord } from "../conversation-builder";

/**
 * Group LLM usage events by module name.
 *
 * Module typically corresponds to the agent node label or ID.
 * Events are grouped but NOT sorted - caller should sort if needed.
 *
 * Used by: conversation-builder, workflow-builder
 */
export function groupLLMEventsByModule(
  events: LLMUsageRecord[]
): Map<string, LLMUsageRecord[]> {
  const grouped = new Map<string, LLMUsageRecord[]>();

  for (const event of events) {
    const module = event.module || "unknown";
    const existing = grouped.get(module);
    if (existing) {
      existing.push(event);
    } else {
      grouped.set(module, [event]);
    }
  }

  return grouped;
}

/**
 * Sort LLM events by creation timestamp.
 *
 * @param events - Array of LLM usage records to sort
 * @returns Sorted array (mutates input)
 */
export function sortLLMEventsByTimestamp(events: LLMUsageRecord[]): LLMUsageRecord[] {
  return events.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

/**
 * Get LLM events for a specific node, checking both label and ID.
 *
 * @param groupedEvents - Pre-grouped events from groupLLMEventsByModule
 * @param nodeLabel - Node label to match
 * @param nodeId - Node ID to match as fallback
 * @returns Array of matching events (empty if none found)
 */
export function getLLMEventsForNode(
  groupedEvents: Map<string, LLMUsageRecord[]>,
  nodeLabel: string | undefined,
  nodeId: string
): LLMUsageRecord[] {
  // Try label first, then fall back to ID
  const byLabel = nodeLabel ? groupedEvents.get(nodeLabel) : undefined;
  const byId = groupedEvents.get(nodeId);
  return byLabel || byId || [];
}

/**
 * Find an LLM event matching a specific timestamp (within tolerance).
 *
 * Useful for correlating agent responses with LLM events when
 * index-based matching is unreliable.
 *
 * @param events - Array of LLM usage records
 * @param targetTimestamp - Target timestamp to match
 * @param toleranceMs - Tolerance in milliseconds (default: 5000ms)
 * @returns Matching event or undefined
 */
export function findLLMEventByTimestamp(
  events: LLMUsageRecord[],
  targetTimestamp: string | Date,
  toleranceMs: number = 5000
): LLMUsageRecord | undefined {
  const targetTime = new Date(targetTimestamp).getTime();

  // Find closest event within tolerance
  let bestMatch: LLMUsageRecord | undefined;
  let bestDiff = Infinity;

  for (const event of events) {
    const eventTime = new Date(event.createdAt).getTime();
    const diff = Math.abs(eventTime - targetTime);

    if (diff <= toleranceMs && diff < bestDiff) {
      bestMatch = event;
      bestDiff = diff;
    }
  }

  return bestMatch;
}
