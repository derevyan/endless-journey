/**
 * State Reconstruction Utility
 *
 * Reconstructs session state at any playback position by replaying events.
 * Used by the State Inspector panel in Impersonate mode to show variable values,
 * tags, and current node at each step.
 *
 * @module features/simulator/lib/state-reconstruction
 */

import { EventTypes, type InteractionEvent } from "@journey/schemas";

// =============================================================================
// TYPES
// =============================================================================

export interface ReconstructedState {
  /** Current node ID at this point in the event log */
  currentNodeId: string;
  /** Variables organized by scope */
  variables: {
    user: Record<string, unknown>;
    journey: Record<string, unknown>;
    global: Record<string, unknown>;
  };
  /** Tags at this point */
  tags: string[];
}

interface VariableOperation {
  op: string;
  key: string;
  scope: "user" | "journey" | "global";
  value?: unknown;
  amount?: number;
}

// =============================================================================
// CACHE
// =============================================================================

/**
 * Cache for reconstructed states.
 * Maps eventLog array reference -> Map of index -> state.
 * Using WeakMap ensures cache is garbage collected when eventLog changes.
 */
const stateCache = new WeakMap<InteractionEvent[], Map<number, ReconstructedState>>();

/**
 * Get or create cache for a specific event log.
 */
function getCache(eventLog: InteractionEvent[]): Map<number, ReconstructedState> {
  let cache = stateCache.get(eventLog);
  if (!cache) {
    cache = new Map();
    stateCache.set(eventLog, cache);
  }
  return cache;
}

// =============================================================================
// VARIABLE OPERATIONS
// =============================================================================

/**
 * Apply a single variable operation to the state.
 * Handles all operation types: set, delete, increment, decrement, push, pop, merge.
 */
function applyVariableOperation(
  variables: Record<string, unknown>,
  op: VariableOperation
): void {
  switch (op.op) {
    case "set":
      variables[op.key] = op.value;
      break;

    case "delete":
      delete variables[op.key];
      break;

    case "increment": {
      const current = typeof variables[op.key] === "number" ? variables[op.key] : 0;
      variables[op.key] = (current as number) + (op.amount ?? 1);
      break;
    }

    case "decrement": {
      const current = typeof variables[op.key] === "number" ? variables[op.key] : 0;
      variables[op.key] = (current as number) - (op.amount ?? 1);
      break;
    }

    case "push": {
      const arr = Array.isArray(variables[op.key]) ? variables[op.key] : [];
      variables[op.key] = [...(arr as unknown[]), op.value];
      break;
    }

    case "pop": {
      if (Array.isArray(variables[op.key])) {
        const arr = [...(variables[op.key] as unknown[])];
        arr.pop();
        variables[op.key] = arr;
      }
      break;
    }

    case "merge": {
      const current = typeof variables[op.key] === "object" && variables[op.key] !== null
        ? variables[op.key]
        : {};
      variables[op.key] = { ...(current as Record<string, unknown>), ...(op.value as Record<string, unknown>) };
      break;
    }
  }
}

// =============================================================================
// STATE RECONSTRUCTION
// =============================================================================

/**
 * Initial empty state used as baseline for reconstruction.
 */
function createInitialState(): ReconstructedState {
  return {
    currentNodeId: "",
    variables: {
      user: {},
      journey: {},
      global: {},
    },
    tags: [],
  };
}

/**
 * Reconstruct session state at a specific event index.
 *
 * Replays events from 0 to targetIndex to compute:
 * - currentNodeId from the last ENGINE_TRANSITION
 * - variables from all SESSION_VARIABLES operations
 * - tags from all SESSION_TAGS events
 *
 * Results are cached per event log to avoid O(n) replay on every call.
 *
 * @param eventLog - The event log to replay
 * @param targetIndex - Index to reconstruct state at (0 = after first event)
 * @returns Reconstructed state at that index
 */
export function reconstructStateAtIndex(
  eventLog: InteractionEvent[],
  targetIndex: number
): ReconstructedState {
  // Handle empty or invalid cases
  if (!eventLog || eventLog.length === 0 || targetIndex < 0) {
    return createInitialState();
  }

  // Clamp index to valid range
  const clampedIndex = Math.min(targetIndex, eventLog.length - 1);

  // Check cache
  const cache = getCache(eventLog);
  const cached = cache.get(clampedIndex);
  if (cached) {
    // Deep clone to prevent caller mutations from corrupting cache
    return structuredClone(cached);
  }

  // Find the closest cached state before our target
  let startIndex = 0;
  let state = createInitialState();

  for (let i = clampedIndex - 1; i >= 0; i--) {
    const cachedState = cache.get(i);
    if (cachedState) {
      // Deep clone to avoid mutating cache
      state = structuredClone(cachedState);
      startIndex = i + 1;
      break;
    }
  }

  // Replay events from startIndex to targetIndex
  for (let i = startIndex; i <= clampedIndex; i++) {
    const event = eventLog[i];
    applyEventToState(state, event);
  }

  // Cache a deep clone to prevent caller mutations from corrupting cache
  cache.set(clampedIndex, structuredClone(state));

  return state;
}

/**
 * Apply a single event to the state.
 */
function applyEventToState(state: ReconstructedState, event: InteractionEvent): void {
  switch (event.type) {
    case EventTypes.ENGINE_TRANSITION: {
      const payload = event.payload as { to?: string; from?: string };
      if (payload?.to) {
        state.currentNodeId = payload.to;
      }
      break;
    }

    case EventTypes.SESSION_VARIABLES: {
      const payload = event.payload as { operations?: VariableOperation[] };
      if (payload?.operations) {
        for (const op of payload.operations) {
          const scopeVars = state.variables[op.scope];
          if (scopeVars) {
            applyVariableOperation(scopeVars, op);
          }
        }
      }
      break;
    }

    case EventTypes.SESSION_TAGS: {
      const payload = event.payload as {
        addTags?: string[];
        removeTags?: string[];
      };

      const tagsToAdd = payload?.addTags || [];
      const tagsToRemove = payload?.removeTags || [];

      if (tagsToAdd && tagsToAdd.length > 0) {
        for (const tag of tagsToAdd) {
          if (!state.tags.includes(tag)) {
            state.tags.push(tag);
          }
        }
      }
      if (tagsToRemove && tagsToRemove.length > 0) {
        state.tags = state.tags.filter((t) => !tagsToRemove.includes(t));
      }
      break;
    }

  }
}

/**
 * Clear the state cache for a specific event log.
 * Call this when the event log is reset or cleared.
 */
export function clearStateCache(eventLog: InteractionEvent[]): void {
  stateCache.delete(eventLog);
}
