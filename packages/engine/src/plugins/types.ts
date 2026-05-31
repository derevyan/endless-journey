/**
 * Plugin Handler Types
 *
 * Defines interfaces for plugin handlers that extend node functionality.
 * Plugin handlers follow the Strategy pattern, similar to NodeHandler.
 *
 * Supports two plugin categories:
 * 1. **Node Plugins** - Attached to specific nodes (e.g., follow-up)
 * 2. **Global Plugins** - Lifecycle observers (e.g., analytics)
 */

import type { createLogger } from "@journey/logger";
import type {
  EnhancedUserJourney,
  FollowUpSequence,
  PluginData,
  JourneyConfig,
  JourneyNodeData,
} from "@journey/schemas";
import type { SessionStateManager } from "../state/session-state-manager";
import type { EngineServices, MessagingAdapter } from "../types";

/**
 * Context for plugin follow-up timers.
 *
 * With embedded plugins, plugins don't have their own IDs.
 * Instead we use a synthetic pluginId: `{parentNodeId}-plugin-{pluginIndex}`
 * This maintains compatibility with the timer service.
 */
export interface PluginFollowUpTimerContext {
  /**
   * Synthetic plugin ID for timer identification.
   * Format: `{parentNodeId}-plugin-{pluginIndex}`
   */
  pluginId: string;
  /** Parent node ID (the node the plugin is attached to) */
  parentNodeId: string;
  /** Index in node.data.plugins array */
  pluginIndex: number;
  /** Current step index in the sequence */
  stepIndex: number;
  /** The full follow-up sequence configuration */
  sequence: FollowUpSequence;
  /**
   * Timer type distinguishes between:
   * - "send": Delay BEFORE sending the follow-up message
   * - "response": Wait AFTER sending for user response (before exit transition)
   */
  timerType: "send" | "response";
}

/**
 * Result from a plugin handler's execute method
 */
export type PluginExecuteResult =
  | { action: "scheduled"; timerId: string }
  | { action: "noop" }
  | { action: "error"; message: string };

/**
 * Result from a plugin handler's timeout handler
 */
export type PluginTimeoutResult =
  | { action: "continue" }
  | { action: "transition"; targetNodeId: string; trigger: string }
  | { action: "complete" };

/**
 * Plugin handler interface (Strategy pattern for plugins)
 *
 * Each plugin type implements this interface.
 * Handlers are registered in the PluginRegistry and looked up by pluginType.
 *
 * With embedded plugins, handlers receive:
 * - pluginData: The plugin config directly (not wrapped in PluginNode)
 * - parentNodeId: The node containing this plugin
 * - pluginIndex: Position in node.data.plugins array (for identification)
 */
export interface PluginHandler<T extends PluginData = PluginData> {
  /** The plugin type this handler processes (e.g., "followup") */
  readonly pluginType: string;

  /**
   * Called when the parent node executes.
   *
   * For follow-up plugins, this schedules the first timer.
   *
   * @param pluginData - The plugin config data (embedded in node.data.plugins)
   * @param parentNodeId - ID of the parent node that just executed
   * @param pluginIndex - Index in node.data.plugins array
   * @param context - Execution context with services
   * @returns Result indicating what action was taken
   */
  onParentExecute(
    pluginData: T,
    parentNodeId: string,
    pluginIndex: number,
    context: PluginExecutionContext
  ): Promise<PluginExecuteResult>;

  /**
   * Handle timeout for a plugin timer.
   *
   * @param timerId - The timer ID that fired
   * @param context - Plugin execution context
   * @returns Result indicating next action (continue, transition, or complete)
   */
  onTimeout?(timerId: string, context: PluginExecutionContext): Promise<PluginTimeoutResult>;
}

/**
 * Execution context for plugin handlers.
 *
 * Similar to ExecutionContext but focused on plugin needs.
 */
export interface PluginExecutionContext {
  /** Current session state */
  session: EnhancedUserJourney;

  /** State manager for centralized session mutations */
  stateManager: SessionStateManager;

  /** Messaging adapter for sending messages */
  adapter: MessagingAdapter;

  /** Engine services */
  services: EngineServices;

  /** Logger instance */
  log: ReturnType<typeof createLogger>;

  /** Organization ID for scoped operations */
  organizationId?: string;

  /** Plugin service for lookup */
  pluginService: PluginService;
}

/**
 * Context for plugin lifecycle hooks.
 */
export interface PluginActivationContext {
  /** Journey identifiers */
  journeyId: string;
  journey: JourneyConfig;
  organizationId?: string;

  /** Parent node and plugin data */
  node: JourneyNodeData;
  plugin: PluginData;
  pluginId: string;
  pluginIndex: number;

  /** Engine services */
  services: EngineServices;

  /** Logger instance */
  log: ReturnType<typeof createLogger>;
}

// Re-export plugin ID utilities from schemas (single source of truth)
export { generatePluginId, parsePluginId } from "@journey/schemas";

/**
 * Plugin service interface for looking up plugins.
 *
 * With embedded plugins, plugins are stored in node.data.plugins.
 * This service provides access to plugin configs and timer context.
 */
export interface PluginService {
  /**
   * Get all plugin configs embedded in a node.
   *
   * @param parentNodeId - The parent node ID
   * @returns Array of plugin configs (from node.data.plugins)
   */
  getPluginsForNode(parentNodeId: string): PluginData[];

  /**
   * Get the plugin follow-up context for a timer.
   *
   * @param timerId - The timer ID
   * @returns Plugin follow-up context or undefined
   */
  getPluginFollowUpContext(timerId: string): PluginFollowUpTimerContext | undefined;

  /**
   * Check if a timer is a plugin follow-up timer.
   *
   * @param timerId - The timer ID
   * @returns True if this is a plugin follow-up timer
   */
  hasPluginFollowUp(timerId: string): boolean;
}

// =============================================================================
// PLUGIN STATE EXPOSURE (SIMULATOR)
// =============================================================================

/**
 * Interface for plugins that provide debug state for the simulator UI.
 *
 * Each plugin type can implement this to expose its internal state
 * for display in the simulator's debug panel. The registry collects
 * all plugin debug states and includes them in SSE events.
 *
 * @template TSessionState - The plugin's state type in EnhancedUserJourney
 * @template TDebugState - The debug-friendly representation for SSE
 *
 * @example
 * ```typescript
 * const followUpDebugProvider: PluginDebugStateProvider<
 *   PendingPluginFollowUp[],
 *   SimulatorDebugState["pendingPluginFollowUps"]
 * > = {
 *   pluginType: "followup",
 *   sessionStateKey: "pendingPluginFollowUps",
 *   extractDebugState(state) {
 *     return state?.map(fu => ({ ... }));
 *   },
 * };
 * ```
 */
export interface PluginDebugStateProvider<
  TSessionState = unknown,
  TDebugState = unknown,
> {
  /** The plugin type this provider handles (e.g., "followup", "analytics") */
  readonly pluginType: string;

  /** The key in EnhancedUserJourney that contains this plugin's state */
  readonly sessionStateKey: keyof EnhancedUserJourney;

  /**
   * Extract debug-friendly state from session state.
   *
   * This transforms the full session state (which may include internal data)
   * into a format suitable for display in the simulator UI.
   *
   * @param sessionState - The plugin's state from the session
   * @returns Debug representation for UI display
   */
  extractDebugState(sessionState: TSessionState): TDebugState;
}

// =============================================================================
// GLOBAL LIFECYCLE PLUGINS (Analytics, Observability)
// =============================================================================

/**
 * Lifecycle event types for global plugins
 */
export type LifecycleEventType =
  | "session:start"
  | "session:complete"
  | "session:error"
  | "node:enter"
  | "node:exit"
  | "transition"
  | "message:sent"
  | "message:received";

/**
 * Base payload for all lifecycle events
 */
export interface LifecycleEventBase {
  /** Event type */
  type: LifecycleEventType;
  /** Timestamp of the event */
  timestamp: string;
  /** Session ID */
  sessionId: string;
  /** Journey ID */
  journeyId: string;
  /** Organization ID (if available) */
  organizationId?: string;
}

/**
 * Node lifecycle event payload
 */
export interface NodeLifecycleEvent extends LifecycleEventBase {
  type: "node:enter" | "node:exit";
  /** Node ID */
  nodeId: string;
  /** Node type */
  nodeType: string;
  /** Node label (for display) */
  nodeLabel?: string;
  /** Duration in ms (only for node:exit) */
  durationMs?: number;
}

/**
 * Transition event payload
 */
export interface TransitionEvent extends LifecycleEventBase {
  type: "transition";
  /** Source node ID */
  fromNodeId: string;
  /** Target node ID */
  toNodeId: string;
  /** Trigger that caused the transition */
  trigger: string;
  /** Button ID if triggered by button click */
  buttonId?: string;
}

/**
 * Session lifecycle event payload
 */
export interface SessionLifecycleEvent extends LifecycleEventBase {
  type: "session:start" | "session:complete" | "session:error";
  /** Final status (for session:complete) */
  status?: EnhancedUserJourney["status"];
  /** Error message (for session:error) */
  error?: string;
}

/**
 * Message event payload
 */
export interface MessageEvent extends LifecycleEventBase {
  type: "message:sent" | "message:received";
  /** Node ID that sent/received the message */
  nodeId: string;
  /** Message content (may be truncated for privacy) */
  contentPreview?: string;
  /** Whether message was successful */
  success: boolean;
}

/**
 * Union of all lifecycle event payloads
 */
export type LifecycleEvent =
  | NodeLifecycleEvent
  | TransitionEvent
  | SessionLifecycleEvent
  | MessageEvent;

/**
 * Global Lifecycle Plugin interface
 *
 * For plugins that observe journey execution without modifying behavior.
 * Use cases: analytics, logging, metrics, tracing.
 *
 * @example
 * ```typescript
 * const analyticsPlugin: LifecyclePlugin = {
 *   name: "analytics",
 *   onEvent: async (event) => {
 *     if (event.type === "node:exit") {
 *       await trackNodeCompletion(event.nodeId, event.durationMs);
 *     }
 *   },
 * };
 * ```
 */
export interface LifecyclePlugin {
  /** Plugin name (for logging and identification) */
  readonly name: string;

  /**
   * Called for each lifecycle event.
   *
   * Plugins should handle events quickly and not block execution.
   * For expensive operations, queue events for async processing.
   *
   * @param event - The lifecycle event
   * @param context - Minimal context (session snapshot)
   */
  onEvent(event: LifecycleEvent, context: LifecyclePluginContext): Promise<void> | void;

  /**
   * Optional: Called when the plugin is initialized.
   * Use for setup like establishing connections.
   */
  onInit?(): Promise<void> | void;

  /**
   * Optional: Called when the plugin is destroyed.
   * Use for cleanup like closing connections.
   */
  onDestroy?(): Promise<void> | void;
}

/**
 * Context provided to lifecycle plugins
 *
 * Intentionally minimal to prevent plugins from modifying state.
 */
export interface LifecyclePluginContext {
  /** Read-only session snapshot */
  session: Readonly<EnhancedUserJourney>;
  /** Logger instance */
  log: ReturnType<typeof createLogger>;
}
