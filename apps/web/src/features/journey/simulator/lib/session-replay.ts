/**
 * Session Replay Utility
 *
 * Converts session data to simulator-compatible format and provides
 * incremental playback support for stepping through interactions.
 *
 * @module features/simulator/lib/session-replay
 */

import type { JourneyMessage } from "@journey/schemas";
import { EventTypes, type ButtonConfig, type EnhancedUserJourney, type InteractionEvent } from "@journey/schemas";

import type { SessionDetail } from "@/shared/lib/api";

// =============================================================================
// TYPES
// =============================================================================

/** Minimal node structure needed for button label lookup */
export interface NodeWithButtons {
  id: string;
  data: { buttons?: ButtonConfig[]; [key: string]: unknown };
}

// =============================================================================
// BUTTON LABEL LOOKUP WITH CACHING
// =============================================================================

/**
 * WeakMap cache for button label maps.
 * Keyed by nodes array reference - automatically garbage collected when nodes change.
 *
 * Performance benefit:
 * - First lookup: O(n) to build the map
 * - Subsequent lookups: O(1)
 *
 * WeakMap is ideal here because:
 * - Keys are objects (the nodes array)
 * - Cache is automatically cleaned when nodes array is replaced
 * - No manual cache invalidation needed
 */
const buttonLabelCache = new WeakMap<NodeWithButtons[], Map<string, string>>();

/**
 * Build a buttonId -> label map from nodes.
 * Pre-computes all button labels for O(1) lookup.
 */
function buildButtonLabelMap(nodes: NodeWithButtons[]): Map<string, string> {
  const labelMap = new Map<string, string>();
  for (const node of nodes) {
    const buttons = node.data.buttons;
    if (buttons) {
      for (const button of buttons) {
        if (button.id && button.text) {
          labelMap.set(button.id, button.text);
        }
      }
    }
  }
  return labelMap;
}

/**
 * Find a button's display label from journey nodes by its ID.
 * Uses WeakMap caching for O(1) lookups after first access.
 */
function findButtonLabel(nodes: NodeWithButtons[] | undefined, buttonId: string): string | undefined {
  if (!nodes || !buttonId) return undefined;

  // Check cache first
  let labelMap = buttonLabelCache.get(nodes);

  // Cache miss - build the map
  if (!labelMap) {
    labelMap = buildButtonLabelMap(nodes);
    buttonLabelCache.set(nodes, labelMap);
  }

  return labelMap.get(buttonId);
}

// =============================================================================
// TYPES
// =============================================================================

export interface PlaybackMessage {
  id: string;
  message: JourneyMessage;
  timestamp: Date;
  from: "bot" | "user";
  interactionIndex: number;
  interactionType: InteractionEvent["type"];
  nodeId: string;
}

/**
 * Internal state for replay calculation (distinct from store's PlaybackState UI state)
 */
export interface ReplayCalculationState {
  messages: PlaybackMessage[];
  currentNodeId: string;
  currentInteractionIndex: number;
}

// =============================================================================
// CONVERSION FUNCTIONS
// =============================================================================

/**
 * Convert SessionDetail to EnhancedUserJourney format for simulator
 */
export function sessionDetailToEnhancedJourney(
  session: SessionDetail
): EnhancedUserJourney {
  return {
    sessionId: session.id,
    userId: session.telegramUserId,
    platformUserId: session.telegramUserId,
    journeyId: session.journeyId,
    currentNodeId: session.currentNodeId,
    status: (session.status as EnhancedUserJourney["status"]) || "active",
    context: session.context,
    tags: session.tags,
    pendingTimers: [],
    pendingPluginFollowUps: [],
    nodeOutputs: session.nodeOutputs || {},
    startedAt: session.createdAt || new Date().toISOString(),
    updatedAt: session.updatedAt || new Date().toISOString(),
    completedAt: session.completedAt,
    hasStarted: true, // Existing sessions have been started
    history: session.interactions,
  };
}

/**
 * Convert a single interaction event to a playback message
 * @param nodes - Journey nodes to look up button labels from stored buttonId
 */
function interactionToMessage(
  interaction: InteractionEvent,
  index: number,
  nodes?: NodeWithButtons[]
): PlaybackMessage | null {
  const baseMessage = {
    id: interaction.id,
    timestamp: new Date(interaction.timestamp),
    interactionIndex: index,
    interactionType: interaction.type,
    nodeId: interaction.nodeId,
  };

  const payload = interaction.payload as Record<string, unknown>;

  switch (interaction.type) {
    case EventTypes.USER_MESSAGE:
      return {
        ...baseMessage,
        from: "user",
        message: {
          type: "text",
          content: (payload?.text as string) || "",
        },
      };

    case EventTypes.USER_CLICK: {
      const buttonId = (payload?.buttonId as string) || "";
      // Priority: payload.buttonLabel > lookup from nodes > buttonId as fallback
      const buttonLabel =
        (payload?.buttonLabel as string) ||
        findButtonLabel(nodes, buttonId) ||
        buttonId ||
        "button";

      return {
        ...baseMessage,
        from: "user",
        message: {
          type: "text",
          // Prefix with special marker for action detection
          content: `__ACTION__${buttonLabel}`,
        },
      };
    }

    case EventTypes.ENGINE_MESSAGE: {
      const content = (payload?.content as string) || "";
      const buttons = payload?.buttons as
        | Array<{ id: string; label: string }>
        | undefined;
      const media = payload?.media as JourneyMessage["media"] | undefined;

      return {
        ...baseMessage,
        from: "bot",
        message: {
          type: "text",
          content,
          buttons: buttons?.map((b) => ({ id: b.id, label: b.label })),
          media,
        },
      };
    }

    case EventTypes.ENGINE_TRANSITION:
      // Transitions are metadata, not displayed as messages
      // But we track them for node position
      return null;

    case EventTypes.TIMER_EXPIRED:
      return {
        ...baseMessage,
        from: "bot",
        message: {
          type: "text",
          content: `[Timer expired]`,
        },
      };

    case EventTypes.ENGINE_ERROR:
      return {
        ...baseMessage,
        from: "bot",
        message: {
          type: "text",
          content: `[Error: ${(payload?.message as string) || "Unknown error"}]`,
        },
      };

    case EventTypes.SESSION_TAGS:
      // Tags are displayed via TagsCard in enhanced view, not as chat messages
      return null;

    case EventTypes.SESSION_VARIABLES: {
      const operations = payload?.operations as Array<{ op: string; key: string; scope: string; value?: unknown }> | undefined;
      const userCount = payload?.userOperationCount as number | undefined;
      const journeyCount = payload?.journeyOperationCount as number | undefined;
      const globalCount = payload?.globalOperationCount as number | undefined;

      const parts: string[] = [];

      if (operations && operations.length > 0) {
        // Group operations by scope
        const byScope: Record<string, string[]> = { user: [], journey: [], global: [] };
        for (const op of operations) {
          const opStr = op.op === "set" ? op.key : `${op.op}(${op.key})`;
          if (byScope[op.scope]) {
            byScope[op.scope].push(opStr);
          }
        }

        if (byScope.user.length > 0) {
          parts.push(`User: ${byScope.user.join(", ")}`);
        }
        if (byScope.journey.length > 0) {
          parts.push(`Journey: ${byScope.journey.join(", ")}`);
        }
        if (byScope.global.length > 0) {
          parts.push(`Global: ${byScope.global.join(", ")}`);
        }
      } else {
        // Fallback to counts
        if (userCount && userCount > 0) parts.push(`User: ${userCount} var(s)`);
        if (journeyCount && journeyCount > 0) parts.push(`Journey: ${journeyCount} var(s)`);
        if (globalCount && globalCount > 0) parts.push(`Global: ${globalCount} var(s)`);
      }

      if (parts.length === 0) {
        return null; // No variables to show
      }

      return {
        ...baseMessage,
        from: "bot",
        message: {
          type: "text",
          content: `[Variables Set: ${parts.join(" | ")}]`,
        },
      };
    }

    default:
      return null;
  }
}

// =============================================================================
// PLAYBACK FUNCTIONS
// =============================================================================

/**
 * Get interaction at a specific index
 */
export function getInteractionAt(
  interactions: InteractionEvent[],
  index: number
): InteractionEvent | null {
  if (index < 0 || index >= interactions.length) {
    return null;
  }
  return interactions[index];
}

// =============================================================================
// INCREMENTAL REPLAY CACHE
// =============================================================================

/**
 * Cache for incremental replay to avoid O(n) recomputation on each step.
 * Stores the last computed state and allows efficient forward/backward seeking.
 *
 * Optimization: Both nodePositions and messageCountAtIndex are pre-computed
 * during forward iteration to enable O(1) backward seeking.
 */
interface ReplayCache {
  interactions: InteractionEvent[];
  nodes?: NodeWithButtons[];
  lastIndex: number;
  state: ReplayCalculationState;
  // Track node positions at each index for efficient backward seeking
  nodePositions: Map<number, string>;
  // Track cumulative message count at each index for O(1) backward message slicing
  messageCountAtIndex: Map<number, number>;
}

let replayCache: ReplayCache | null = null;

/**
 * Clear the replay cache (call when switching sessions or resetting)
 */
export function clearReplayCache(): void {
  replayCache = null;
}

/**
 * Process a single interaction and update state
 */
function processInteraction(
  interaction: InteractionEvent,
  index: number,
  messages: PlaybackMessage[],
  currentNodeId: string,
  nodes?: NodeWithButtons[]
): { messages: PlaybackMessage[]; currentNodeId: string } {
  let newNodeId = currentNodeId;

  // Track node position from any interaction
  if (interaction.nodeId) {
    newNodeId = interaction.nodeId;
  }

  // Handle transitions specially - they update node position
  if (interaction.type === EventTypes.ENGINE_TRANSITION) {
    const payload = interaction.payload as Record<string, unknown>;
    if (payload?.to) {
      newNodeId = payload.to as string;
    }
    return { messages, currentNodeId: newNodeId };
  }

  // Convert to message
  const message = interactionToMessage(interaction, index, nodes);
  if (message) {
    messages.push(message);
  }

  return { messages, currentNodeId: newNodeId };
}

/**
 * Replay interactions up to a specific index (inclusive)
 * Returns the accumulated messages and current node position.
 *
 * OPTIMIZED: Uses incremental caching for efficient forward/backward seeking.
 * - Forward steps: O(1) - only process new interactions
 * - Backward steps: O(1) - slice from cached messages
 * - Cache miss: O(n) - full recomputation
 *
 * @param nodes - Journey nodes to look up button labels from stored buttonId
 */
export function replayUpToIndex(
  interactions: InteractionEvent[],
  targetIndex: number,
  nodes?: NodeWithButtons[]
): ReplayCalculationState {
  // Clamp target index to valid range
  const maxIndex = Math.min(targetIndex, interactions.length - 1);

  if (maxIndex < 0) {
    return {
      messages: [],
      currentNodeId: "",
      currentInteractionIndex: -1,
    };
  }

  // Check if we can use the cache (must match interactions AND nodes)
  const canUseCache = replayCache !== null &&
    replayCache.interactions === interactions &&
    replayCache.nodes === nodes &&
    replayCache.lastIndex >= 0;

  if (canUseCache && replayCache) {
    const cache = replayCache;

    // CASE 1: Same index - return cached state
    if (cache.lastIndex === maxIndex) {
      return cache.state;
    }

    // CASE 2: Moving forward - incrementally process new interactions
    if (cache.lastIndex < maxIndex) {
      const messages = [...cache.state.messages];
      let currentNodeId = cache.state.currentNodeId;
      let messageCount = messages.length;

      // Process only new interactions
      for (let i = cache.lastIndex + 1; i <= maxIndex; i++) {
        const interaction = interactions[i];
        const prevMessageCount = messages.length;
        const result = processInteraction(interaction, i, messages, currentNodeId, nodes);
        currentNodeId = result.currentNodeId;

        // Track if this interaction added a message
        if (messages.length > prevMessageCount) {
          messageCount = messages.length;
        }

        // Store node position and message count for backward seeking
        cache.nodePositions.set(i, currentNodeId);
        cache.messageCountAtIndex.set(i, messageCount);
      }

      const newState: ReplayCalculationState = {
        messages,
        currentNodeId,
        currentInteractionIndex: maxIndex,
      };

      // Update cache
      cache.lastIndex = maxIndex;
      cache.state = newState;

      return newState;
    }

    // CASE 3: Moving backward - slice messages and lookup node position (O(1) with cache)
    if (cache.lastIndex > maxIndex) {
      // Use cached message count for O(1) lookup
      let messageCount = cache.messageCountAtIndex.get(maxIndex);

      // Fallback: compute message count if not in cache (should rarely happen)
      if (messageCount === undefined) {
        messageCount = 0;
        for (let i = 0; i <= maxIndex; i++) {
          const interaction = interactions[i];
          if (interaction.type !== EventTypes.ENGINE_TRANSITION) {
            const message = interactionToMessage(interaction, i, nodes);
            if (message) messageCount++;
          }
        }
      }

      // Lookup cached node position (should always be available since we built forward first)
      let currentNodeId = cache.nodePositions.get(maxIndex);
      if (currentNodeId === undefined) {
        // Fallback: compute node position for this index
        currentNodeId = "";
        for (let i = 0; i <= maxIndex; i++) {
          const interaction = interactions[i];
          if (interaction.nodeId) {
            currentNodeId = interaction.nodeId;
          }
          if (interaction.type === EventTypes.ENGINE_TRANSITION) {
            const payload = interaction.payload as Record<string, unknown>;
            if (payload?.to) {
              currentNodeId = payload.to as string;
            }
          }
        }
      }

      const newState: ReplayCalculationState = {
        messages: cache.state.messages.slice(0, messageCount),
        currentNodeId,
        currentInteractionIndex: maxIndex,
      };

      // Update cache
      cache.lastIndex = maxIndex;
      cache.state = newState;

      return newState;
    }
  }

  // CASE 4: Cache miss - full recomputation
  const messages: PlaybackMessage[] = [];
  let currentNodeId = "";
  const nodePositions = new Map<number, string>();
  const messageCountAtIndex = new Map<number, number>();

  for (let i = 0; i <= maxIndex; i++) {
    const interaction = interactions[i];
    const result = processInteraction(interaction, i, messages, currentNodeId, nodes);
    currentNodeId = result.currentNodeId;

    // Store both node position and cumulative message count for O(1) backward seeking
    nodePositions.set(i, currentNodeId);
    messageCountAtIndex.set(i, messages.length);
  }

  const state: ReplayCalculationState = {
    messages,
    currentNodeId,
    currentInteractionIndex: maxIndex,
  };

  // Update cache
  replayCache = {
    interactions,
    nodes,
    lastIndex: maxIndex,
    state,
    nodePositions,
    messageCountAtIndex,
  };

  return state;
}

/**
 * Get all messages from interactions (full replay)
 * @param nodes - Journey nodes to look up button labels from stored buttonId
 */
export function getAllMessages(
  interactions: InteractionEvent[],
  nodes?: NodeWithButtons[]
): PlaybackMessage[] {
  if (interactions.length === 0) {
    return [];
  }
  return replayUpToIndex(interactions, interactions.length - 1, nodes).messages;
}

/**
 * Find the current node at a specific interaction index
 */
export function getNodeAtIndex(
  interactions: InteractionEvent[],
  index: number
): string {
  let currentNodeId = "";

  for (let i = 0; i <= Math.min(index, interactions.length - 1); i++) {
    const interaction = interactions[i];

    if (interaction.nodeId) {
      currentNodeId = interaction.nodeId;
    }

    if (interaction.type === EventTypes.ENGINE_TRANSITION) {
      const payload = interaction.payload as Record<string, unknown>;
      if (payload?.to) {
        currentNodeId = payload.to as string;
      }
    }
  }

  return currentNodeId;
}

/**
 * Get the message index that corresponds to an interaction index
 * (since not all interactions produce messages)
 */
export function getMessageIndexForInteraction(
  interactions: InteractionEvent[],
  interactionIndex: number
): number {
  let messageIndex = -1;

  for (let i = 0; i <= Math.min(interactionIndex, interactions.length - 1); i++) {
    const interaction = interactions[i];
    // Skip transitions as they don't produce messages
    if (interaction.type !== EventTypes.ENGINE_TRANSITION) {
      const message = interactionToMessage(interaction, i);
      if (message) {
        messageIndex++;
      }
    }
  }

  return messageIndex;
}

/**
 * Format timestamp for display
 */
export function formatInteractionTime(timestamp: string | Date): string {
  const date = typeof timestamp === "string" ? new Date(timestamp) : timestamp;
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/**
 * Get human-readable interaction type label
 */
export function getInteractionTypeLabel(type: InteractionEvent["type"]): string {
  switch (type) {
    case EventTypes.USER_MESSAGE:
      return "User Message";
    case EventTypes.USER_CLICK:
      return "Button Click";
    case EventTypes.ENGINE_MESSAGE:
      return "Bot Message";
    case EventTypes.ENGINE_TRANSITION:
      return "Transition";
    case EventTypes.TIMER_EXPIRED:
      return "Timer";
    case EventTypes.ENGINE_ERROR:
      return "Error";
    case EventTypes.SESSION_TAGS:
      return "Tags";
    case EventTypes.SESSION_VARIABLES:
      return "Variables";
    default:
      return "Unknown";
  }
}
