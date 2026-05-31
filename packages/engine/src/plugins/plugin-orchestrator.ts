/**
 * Plugin Orchestrator
 *
 * Manages plugin lifecycle for journey nodes. Encapsulates:
 * - Plugin lookup from journey graph (via GraphIndex)
 * - Plugin invocation after node execution
 * - Plugin timeout handling
 * - Execution context building
 *
 * Extracted from SessionEngine for separation of concerns.
 *
 * @module engine/plugins/plugin-orchestrator
 */

import type { createLogger } from "@journey/logger";
import {
  getNodePlugins,
  type EnhancedUserJourney,
  type JourneyNodeData,
  type PluginData,
  PluginTypes,
} from "@journey/schemas";
import type { GraphIndex } from "../graph-index";
import type { SessionStateManager } from "../state/session-state-manager";
import type { EngineServices, ExecutionContext, MessagingAdapter } from "../types";
import { backendPluginRegistry, type BackendPluginRegistry } from "./backend-plugin-descriptor";
import "./descriptors";
import { generatePluginId } from "./types";
import type {
  PluginExecutionContext,
  PluginHandler,
  PluginService,
  PluginTimeoutResult,
} from "./types";

/**
 * Dependencies for PluginOrchestrator.
 *
 * Uses dependency injection for testability.
 * All mutable state (session) is accessed via getter functions.
 */
export interface PluginOrchestratorDeps {
  /** Get current session state (mutable) */
  getSession: () => EnhancedUserJourney;
  /** Get state manager for centralized mutations */
  getStateManager: () => SessionStateManager;
  /** Messaging adapter for sending messages */
  adapter: MessagingAdapter;
  /** Engine services (timer, messenger, etc.) */
  services: EngineServices;
  /** Graph index for O(1) node/plugin lookups */
  graphIndex: GraphIndex;
  /** Logger instance */
  log: ReturnType<typeof createLogger>;
  /** Organization ID for scoped operations */
  organizationId?: string;
  /** Plugin registry (optional - uses backend plugin registry if not provided) */
  registry?: BackendPluginRegistry;
}

/**
 * Plugin Orchestrator
 *
 * Manages the lifecycle of plugins attached to journey nodes.
 *
 * @example
 * ```ts
 * const orchestrator = new PluginOrchestrator({
 *   getSession: () => session,
 *   adapter,
 *   services,
 *   graphIndex,
 *   log,
 * });
 *
 * // After node execution
 * await orchestrator.invokePlugins(node, context);
 *
 * // Handle timeout from timer
 * const result = await orchestrator.handlePluginTimeout(timerId);
 * ```
 */
export class PluginOrchestrator {
  private readonly deps: PluginOrchestratorDeps;
  private readonly registry: BackendPluginRegistry;

  constructor(deps: PluginOrchestratorDeps) {
    this.deps = deps;
    this.registry = deps.registry ?? backendPluginRegistry;
  }

  /**
   * Get handler for a plugin type.
   */
  private getHandler(pluginType: string): PluginHandler | undefined {
    return this.registry.getHandler(pluginType);
  }

  /**
   * Invoke plugins attached to a node after it executes.
   *
   * Called when a node returns "wait" action, meaning it's waiting for user input.
   * This is the time to schedule follow-up timers via attached plugins.
   *
   * @param node - The node that just executed
   * @param context - Handler execution context (unused currently, reserved for future plugins)
   */
  async invokePlugins(node: JourneyNodeData, _context: ExecutionContext): Promise<void> {
    const plugins = this.getPluginsForNode(node.id);

    if (plugins.length === 0) {
      return;
    }

    const { log } = this.deps;
    log.debug({ nodeId: node.id, pluginCount: plugins.length }, "pluginOrchestrator:invoke");

    for (let pluginIndex = 0; pluginIndex < plugins.length; pluginIndex++) {
      const pluginData = plugins[pluginIndex];
      const pluginId = generatePluginId(node.id, pluginIndex);
      const pluginType = this.getPluginType(pluginData);

      // Get handler from registry (or fallback for follow-up)
      const handler = this.getHandler(pluginType);
      if (!handler) {
        log.warn({ pluginId, pluginType, nodeId: node.id }, "pluginOrchestrator:noHandler");
        continue;
      }

      const pluginContext = this.buildPluginExecutionContext();
      const result = await handler.onParentExecute(
        pluginData,
        node.id,
        pluginIndex,
        pluginContext
      );

      if (result.action === "scheduled") {
        log.info(
          { pluginId, pluginType, nodeId: node.id, pluginIndex, timerId: result.timerId },
          "pluginOrchestrator:scheduled"
        );
      } else if (result.action === "error") {
        log.error(
          { pluginId, pluginType, nodeId: node.id, pluginIndex, error: result.message },
          "pluginOrchestrator:error"
        );
      }
    }
  }

  /**
   * Determine plugin type from plugin data.
   * Each plugin data object has a 'pluginType' field.
   */
  private getPluginType(pluginData: PluginData): string {
    return pluginData.pluginType;
  }

  /**
   * Handle a plugin timeout event.
   *
   * Called by EventRouter when a plugin follow-up timer fires.
   * Delegates to the appropriate plugin handler based on timer context.
   *
   * @param timerId - The timer ID that fired
   * @returns Result indicating next action (continue, transition, or complete)
   */
  async handlePluginTimeout(timerId: string): Promise<PluginTimeoutResult> {
    const pluginContext = this.buildPluginExecutionContext();

    // Currently all plugin timeouts are follow-up plugins
    // Future: Look up plugin type from timer context to route to correct handler
    const handler = this.getHandler(PluginTypes.FOLLOWUP);
    if (!handler?.onTimeout) {
      this.deps.log.error({ timerId }, "pluginOrchestrator:noTimeoutHandler");
      return { action: "complete" };
    }

    const result = await handler.onTimeout(timerId, pluginContext);
    return result;
  }

  /**
   * Create a PluginService instance for plugin handlers.
   *
   * Wraps timer service and graph index for plugin lookups.
   */
  createPluginService(): PluginService {
    return {
      getPluginsForNode: (parentNodeId: string) => this.getPluginsForNode(parentNodeId),
      getPluginFollowUpContext: (timerId: string) =>
        this.deps.services.timer.getPluginFollowUpContext(timerId),
      hasPluginFollowUp: (timerId: string) =>
        this.deps.services.timer.hasPluginFollowUp(timerId),
    };
  }

  // ===========================================================================
  // PRIVATE METHODS
  // ===========================================================================

  /**
   * Build execution context for plugin handlers.
   *
   * Creates a context with all dependencies plugins need.
   */
  private buildPluginExecutionContext(): PluginExecutionContext {
    return {
      session: this.deps.getSession(),
      stateManager: this.deps.getStateManager(),
      adapter: this.deps.adapter,
      services: this.deps.services,
      log: this.deps.log,
      organizationId: this.deps.organizationId,
      pluginService: this.createPluginService(),
    };
  }

  /**
   * Get all plugin configs embedded in a node's data.plugins array.
   *
   * Uses O(1) lookup via graphIndex and centralized getNodePlugins utility.
   *
   * @param parentNodeId - The node ID to get plugins for
   * @returns Array of plugin data (empty if node has no plugins)
   */
  private getPluginsForNode(parentNodeId: string) {
    const node = this.deps.graphIndex.getNode(parentNodeId);
    if (!node) return [];

    // Use centralized utility for safe plugin extraction
    return getNodePlugins(node.data);
  }
}

/**
 * Factory function for creating PluginOrchestrator.
 *
 * Provides a consistent creation pattern matching other engine components.
 */
export function createPluginOrchestrator(deps: PluginOrchestratorDeps): PluginOrchestrator {
  return new PluginOrchestrator(deps);
}
