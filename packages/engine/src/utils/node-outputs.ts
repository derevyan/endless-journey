/**
 * Node Output Utilities
 *
 * Functions for storing and retrieving node execution results.
 * Enables cross-node data referencing via {{nodes.NodeLabel.field}} syntax.
 */

import type { EnhancedUserJourney, JourneyNodeData } from "@journey/schemas";
import {
  sanitizeNodeLabel,
  RESERVED_NODE_OUTPUT_PREFIXES,
} from "@journey/schemas";
import type { SessionStateManager } from "../state/session-state-manager";

export { sanitizeNodeLabel, RESERVED_NODE_OUTPUT_PREFIXES };

/**
 * Store node output in session
 *
 * Stores the output data with metadata so it can be referenced by node label.
 * The output is indexed by sanitized label for easy lookup via {{nodes.Label.field}}.
 *
 * @param session - Session to store output in
 * @param node - Node that produced the output
 * @param data - Output data to store
 * @param stateManager - Optional state manager for centralized mutations
 *
 * @example
 * ```ts
 * const result = await executeWebhook(...);
 * storeNodeOutput(session, node, result, stateManager);
 * // Later: {{nodes.Get_Customer.email}}
 * ```
 */
export function storeNodeOutput(
  session: EnhancedUserJourney,
  node: JourneyNodeData,
  data: unknown,
  stateManager?: SessionStateManager,
  outputKey?: string
): void {
  // Use sanitized label, falling back to node ID if label is empty
  const sanitizedLabel = sanitizeNodeLabel(node.data.label || "");
  const key = outputKey ?? (sanitizedLabel || `node_${node.id}`);

  const output = {
    nodeId: node.id,
    nodeLabel: node.data.label,
    nodeType: node.data.type,
    executedAt: new Date().toISOString(),
    data,
  };

  if (stateManager) {
    stateManager.setNodeOutput(key, output);
  } else {
    // Direct mutation fallback for tests without stateManager
    if (!session.nodeOutputs) {
      session.nodeOutputs = {};
    }
    session.nodeOutputs[key] = output;
  }
}

/**
 * Get node output by label or ID
 *
 * @param session - Session to search
 * @param labelOrId - Node label (will be sanitized) or node ID
 * @returns Output data or undefined if not found
 *
 * @example
 * ```ts
 * const output = getNodeOutput(session, "Get Customer");
 * // Returns the data stored by the "Get Customer" node
 * ```
 */
export function getNodeOutput(session: EnhancedUserJourney, labelOrId: string): unknown {
  if (!session.nodeOutputs) {
    return undefined;
  }

  // Try by sanitized label first
  const byLabel = session.nodeOutputs[sanitizeNodeLabel(labelOrId)];
  if (byLabel) {
    return byLabel.data;
  }

  // Try by node ID
  for (const output of Object.values(session.nodeOutputs)) {
    if (output.nodeId === labelOrId) {
      return output.data;
    }
  }

  return undefined;
}

/**
 * State management methods interface
 * Matches the state methods on ExecutionContext
 */
export interface StateMethods<TState = unknown> {
  getState<T = TState>(): T | undefined;
  setState<T = TState>(state: T): void;
  hasState(): boolean;
  clearState(): void;
}

/**
 * Create state management methods for a node
 *
 * Used by session-engine and tests to create the state methods
 * that are part of ExecutionContext.
 *
 * @param session - Session to store state in
 * @param nodeId - Node ID for state key
 * @param nodeType - Node type for output metadata
 * @param stateManager - Optional state manager for centralized mutations
 * @returns State management methods
 *
 * @example
 * ```ts
 * const context: ExecutionContext = {
 *   session,
 *   node,
 *   ...createStateMethods(session, node.id, node.data.type, stateManager),
 * };
 * ```
 */
export function createStateMethods(
  session: EnhancedUserJourney,
  nodeId: string,
  nodeType: string,
  stateManager?: SessionStateManager
): StateMethods {
  const stateKey = `__state_${nodeId}`;

  return {
    getState<T>(): T | undefined {
      const output = session.nodeOutputs?.[stateKey];
      return output?.data as T | undefined;
    },

    setState<T>(state: T): void {
      const output = {
        nodeId,
        nodeLabel: stateKey,
        nodeType,
        executedAt: new Date().toISOString(),
        data: state,
      };

      if (stateManager) {
        stateManager.setNodeOutput(stateKey, output);
      } else {
        // Direct mutation fallback for tests without stateManager
        if (!session.nodeOutputs) {
          session.nodeOutputs = {};
        }
        session.nodeOutputs[stateKey] = output;
      }
    },

    hasState(): boolean {
      return !!session.nodeOutputs?.[stateKey];
    },

    clearState(): void {
      if (stateManager) {
        stateManager.clearNodeOutput(stateKey);
      } else if (session.nodeOutputs) {
        delete session.nodeOutputs[stateKey];
      }
    },
  };
}
