/**
 * Node Lifecycle Manager
 *
 * Orchestrates node activation/deactivation hooks.
 */

import type { createLogger } from "@journey/logger";
import { serializeError } from "@journey/logger";
import { generatePluginId, getNodePlugins, type JourneyConfig } from "@journey/schemas";

import type { HandlerRegistry } from "../handlers";
import { backendPluginRegistry, type BackendPluginRegistry } from "../plugins/backend-plugin-descriptor";
import type { PluginActivationContext } from "../plugins/types";
import type { EngineServices } from "../types";
import type { ActivationContext, LifecycleResult } from "./types";

export class NodeLifecycleManager {
  constructor(
    private handlerRegistry: HandlerRegistry,
    private pluginRegistry: BackendPluginRegistry | null,
    private log: ReturnType<typeof createLogger>
  ) {}

  private async activatePluginsForNode(
    node: JourneyConfig["nodes"][number],
    journey: JourneyConfig,
    services: EngineServices,
    journeyId: string,
    organizationId?: string
  ): Promise<void> {
    if (!this.pluginRegistry) {
      return;
    }

    const plugins = getNodePlugins(node.data);
    for (let pluginIndex = 0; pluginIndex < plugins.length; pluginIndex++) {
      const plugin = plugins[pluginIndex];
      const descriptor = this.pluginRegistry.get(plugin.pluginType);
      const hook = descriptor?.lifecycle?.onActivate;
      if (!hook) {
        continue;
      }

      const pluginId = generatePluginId(node.id, pluginIndex);
      const context: PluginActivationContext = {
        journeyId,
        journey,
        organizationId,
        node,
        plugin,
        pluginId,
        pluginIndex,
        services,
        log: this.log,
      };

      try {
        await hook(context);
        this.log.info(
          { pluginId, pluginType: plugin.pluginType, nodeId: node.id },
          "plugin:lifecycle:activated"
        );
      } catch (error) {
        this.log.error(
          { pluginId, pluginType: plugin.pluginType, nodeId: node.id, err: serializeError(error) },
          "plugin:lifecycle:activateFailed"
        );
      }
    }
  }

  private async deactivatePluginsForNode(
    node: JourneyConfig["nodes"][number],
    journey: JourneyConfig,
    services: EngineServices,
    journeyId: string,
    organizationId?: string
  ): Promise<void> {
    if (!this.pluginRegistry) {
      return;
    }

    const plugins = getNodePlugins(node.data);
    for (let pluginIndex = 0; pluginIndex < plugins.length; pluginIndex++) {
      const plugin = plugins[pluginIndex];
      const descriptor = this.pluginRegistry.get(plugin.pluginType);
      const hook = descriptor?.lifecycle?.onDeactivate;
      if (!hook) {
        continue;
      }

      const pluginId = generatePluginId(node.id, pluginIndex);
      const context: PluginActivationContext = {
        journeyId,
        journey,
        organizationId,
        node,
        plugin,
        pluginId,
        pluginIndex,
        services,
        log: this.log,
      };

      try {
        await hook(context);
        this.log.info(
          { pluginId, pluginType: plugin.pluginType, nodeId: node.id },
          "plugin:lifecycle:deactivated"
        );
      } catch (error) {
        this.log.error(
          { pluginId, pluginType: plugin.pluginType, nodeId: node.id, err: serializeError(error) },
          "plugin:lifecycle:deactivateFailed"
        );
      }
    }
  }

  /**
   * Activate all nodes that implement onActivate hooks.
   */
  async activateJourney(
    journey: JourneyConfig,
    services: EngineServices,
    journeyId: string,
    organizationId?: string
  ): Promise<LifecycleResult[]> {
    const results: LifecycleResult[] = [];

    for (const node of journey.nodes) {
      const handler = this.handlerRegistry.get(node.data.type);

      if (handler?.onActivate) {
        const start = Date.now();
        const context: ActivationContext = {
          journeyId,
          journey,
          organizationId,
          node,
          services,
          log: this.log,
        };

        try {
          await handler.onActivate(context);
          const durationMs = Date.now() - start;
          results.push({
            nodeId: node.id,
            nodeType: node.data.type,
            hook: "onActivate",
            success: true,
            durationMs,
          });
          this.log.info(
            { nodeId: node.id, nodeType: node.data.type, durationMs },
            "lifecycle:activated"
          );
        } catch (error) {
          const durationMs = Date.now() - start;
          results.push({
            nodeId: node.id,
            nodeType: node.data.type,
            hook: "onActivate",
            success: false,
            error: error as Error,
            durationMs,
          });
          this.log.error(
            { nodeId: node.id, nodeType: node.data.type, err: serializeError(error) },
            "lifecycle:activateFailed"
          );
        }
      }

      await this.activatePluginsForNode(node, journey, services, journeyId, organizationId);
    }

    return results;
  }

  /**
   * Deactivate all nodes that implement onDeactivate hooks.
   * Runs in reverse order to ensure proper cleanup.
   */
  async deactivateJourney(
    journey: JourneyConfig,
    services: EngineServices,
    journeyId: string,
    organizationId?: string
  ): Promise<LifecycleResult[]> {
    const results: LifecycleResult[] = [];
    const nodes = [...journey.nodes].reverse();

    for (const node of nodes) {
      const handler = this.handlerRegistry.get(node.data.type);

      await this.deactivatePluginsForNode(node, journey, services, journeyId, organizationId);

      if (handler?.onDeactivate) {
        const start = Date.now();
        const context: ActivationContext = {
          journeyId,
          journey,
          organizationId,
          node,
          services,
          log: this.log,
        };

        try {
          await handler.onDeactivate(context);
          const durationMs = Date.now() - start;
          results.push({
            nodeId: node.id,
            nodeType: node.data.type,
            hook: "onDeactivate",
            success: true,
            durationMs,
          });
          this.log.info(
            { nodeId: node.id, nodeType: node.data.type, durationMs },
            "lifecycle:deactivated"
          );
        } catch (error) {
          const durationMs = Date.now() - start;
          results.push({
            nodeId: node.id,
            nodeType: node.data.type,
            hook: "onDeactivate",
            success: false,
            error: error as Error,
            durationMs,
          });
          this.log.error(
            { nodeId: node.id, nodeType: node.data.type, err: serializeError(error) },
            "lifecycle:deactivateFailed"
          );
        }
      }
    }

    return results;
  }
}

export function createLifecycleManager(
  handlerRegistry: HandlerRegistry,
  log: ReturnType<typeof createLogger>,
  pluginRegistry: BackendPluginRegistry | null = backendPluginRegistry
): NodeLifecycleManager {
  return new NodeLifecycleManager(handlerRegistry, pluginRegistry, log);
}
