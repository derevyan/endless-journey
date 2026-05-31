/**
 * Variable Builder
 *
 * Builds variable change history from interaction events.
 * Extracts session.variables events and formats them for the report.
 *
 * @module @journey/ai-report/builders/variable-builder
 */

import type { VariableChangeDetail, VariableChangeOperation } from "../schemas";
import type { InteractionRecord, NodeInfo } from "./journey-log-builder";

/**
 * Variable change payload from interaction events.
 */
interface VariableChangePayload {
  key?: string;
  value?: unknown;
  previousValue?: unknown;
  scope?: string;
  scopeId?: string;
  // Batch changes format (multiple changes in one event)
  changes?: Array<{
    key: string;
    value: unknown;
    previousValue?: unknown;
    operation?: string;
  }>;
  operationCount?: number;
}

/**
 * Build variable change details from interactions.
 *
 * Extracts `session.variables` events and converts them to VariableChangeDetail.
 *
 * @param interactions - All interaction records for the session
 * @param nodeMap - Map of node IDs to node info
 */
export function buildVariableChanges(
  interactions: InteractionRecord[],
  nodeMap: Map<string, NodeInfo>
): VariableChangeDetail[] {
  const variableChanges: VariableChangeDetail[] = [];

  // Filter to only variable change events
  const variableEvents = interactions.filter((i) => i.eventType === "session.variables");

  // Group by timestamp and nodeId to batch changes that happened together
  const grouped = new Map<string, InteractionRecord[]>();
  for (const event of variableEvents) {
    const key = `${event.timestamp}-${event.nodeId || "system"}`;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(event);
  }

  for (const [, events] of grouped) {
    const firstEvent = events[0];
    if (!firstEvent) continue;

    const nodeInfo = firstEvent.nodeId ? nodeMap.get(firstEvent.nodeId) : undefined;
    const changes: VariableChangeOperation[] = [];

    for (const event of events) {
      const payload = event.payload as VariableChangePayload;

      // Handle batch changes format
      if (payload.changes && Array.isArray(payload.changes)) {
        for (const change of payload.changes) {
          changes.push({
            key: change.key,
            previousValue: change.previousValue,
            newValue: change.value,
            operation: inferOperation(change.previousValue, change.value, change.operation),
          });
        }
      }
      // Handle single change format
      else if (payload.key !== undefined) {
        changes.push({
          key: payload.key,
          previousValue: payload.previousValue,
          newValue: payload.value,
          operation: inferOperation(payload.previousValue, payload.value),
        });
      }
    }

    if (changes.length > 0) {
      variableChanges.push({
        timestamp: firstEvent.timestamp,
        nodeId: firstEvent.nodeId || "system",
        nodeLabel: nodeInfo?.label,
        changes,
      });
    }
  }

  // Sort by timestamp
  variableChanges.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  return variableChanges;
}

/**
 * Infer the operation type from before/after values.
 */
function inferOperation(
  previousValue: unknown,
  newValue: unknown,
  explicitOp?: string
): VariableChangeOperation["operation"] {
  // Use explicit operation if provided
  if (explicitOp) {
    const validOps = ["set", "increment", "decrement", "append", "remove", "clear"];
    if (validOps.includes(explicitOp)) {
      return explicitOp as VariableChangeOperation["operation"];
    }
  }

  // Infer operation from values
  if (newValue === null || newValue === undefined) {
    return "clear";
  }

  if (previousValue === null || previousValue === undefined) {
    return "set";
  }

  // Check for numeric increment/decrement
  if (typeof previousValue === "number" && typeof newValue === "number") {
    if (newValue > previousValue) return "increment";
    if (newValue < previousValue) return "decrement";
  }

  // Check for array append/remove
  if (Array.isArray(previousValue) && Array.isArray(newValue)) {
    if (newValue.length > previousValue.length) return "append";
    if (newValue.length < previousValue.length) return "remove";
  }

  // Default to set
  return "set";
}

/**
 * Build variable changes from raw context diffs.
 *
 * Alternative method when interaction events don't have full variable tracking.
 * Compares two context snapshots and generates change records.
 *
 * @param beforeContext - Context state before
 * @param afterContext - Context state after
 * @param timestamp - When the change occurred
 * @param nodeId - Node that caused the change
 * @param nodeLabel - Optional node label
 */
export function buildVariableChangesFromContextDiff(
  beforeContext: Record<string, unknown>,
  afterContext: Record<string, unknown>,
  timestamp: string,
  nodeId: string,
  nodeLabel?: string
): VariableChangeDetail | null {
  const changes: VariableChangeOperation[] = [];
  const allKeys = new Set([...Object.keys(beforeContext), ...Object.keys(afterContext)]);

  for (const key of allKeys) {
    const previousValue = beforeContext[key];
    const newValue = afterContext[key];

    // Skip if values are the same
    if (JSON.stringify(previousValue) === JSON.stringify(newValue)) {
      continue;
    }

    changes.push({
      key,
      previousValue,
      newValue,
      operation: inferOperation(previousValue, newValue),
    });
  }

  if (changes.length === 0) {
    return null;
  }

  return {
    timestamp,
    nodeId,
    nodeLabel,
    changes,
  };
}
