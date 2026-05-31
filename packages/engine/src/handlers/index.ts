/**
 * Node Handlers Registry
 *
 * Central registry for all node type handlers.
 * Each node type has a dedicated handler that implements the NodeHandler interface.
 *
 * Adding a new node type:
 * 1. Create a new handler file (e.g., my-node-handler.ts)
 * 2. Export the handler implementing NodeHandler interface
 * 3. Add it to the defaultHandlers array below
 */

import type { NodeType } from "@journey/schemas";
import { BaseRegistry } from "@journey/schemas";
import type { NodeHandler } from "../types";
import { backendNodeRegistry } from "../descriptors/backend-descriptor";
import { agentHandler } from "./types/agent";
import { conditionHandler } from "./types/condition";
import { crmHandler } from "./types/crm";
import { endHandler } from "./types/end";
import { messageHandler } from "./types/message";
import { questionnaireHandler } from "./types/questionnaire";
import { startHandler } from "./types/start";
import { teleportHandler } from "./types/teleport";
import { waitHandler } from "./types/wait";
import { webhookHandler } from "./types/webhook";

/** Default handlers for all built-in node types */
const defaultHandlers: NodeHandler[] = [
  startHandler,
  messageHandler,
  conditionHandler,
  waitHandler,
  webhookHandler,
  crmHandler,
  teleportHandler,
  endHandler,
  questionnaireHandler,
  agentHandler,
];

/**
 * Handler Registry
 *
 * Manages node type handlers and provides lookup functionality.
 * Supports registration of custom handlers for extensibility.
 */
export class HandlerRegistry extends BaseRegistry<NodeType, NodeHandler> {
  constructor(handlers: NodeHandler[] = defaultHandlers) {
    super({
      onDuplicate: (nodeType) => {
        throw new Error(`Handler for node type "${nodeType}" is already registered`);
      },
    });
    for (const handler of handlers) {
      this.register(handler);
    }
  }

  /**
   * Register a handler for a node type
   *
   * @param handler - Handler to register
   * @throws Error if handler for this type already exists
   */
  register(key: NodeType, handler: NodeHandler): void;
  register(handler: NodeHandler): void;
  register(keyOrHandler: NodeType | NodeHandler, handler?: NodeHandler): void {
    if (typeof keyOrHandler === "string") {
      super.register(keyOrHandler, handler as NodeHandler);
      return;
    }
    super.register(keyOrHandler.nodeType, keyOrHandler);
  }

  /**
   * Override an existing handler for a node type
   *
   * @param handler - Handler to replace the existing implementation
   * @throws Error if handler for this type does not already exist
   */
  override(key: NodeType, handler: NodeHandler): void;
  override(handler: NodeHandler): void;
  override(keyOrHandler: NodeType | NodeHandler, handler?: NodeHandler): void {
    if (typeof keyOrHandler === "string") {
      super.override(keyOrHandler, handler as NodeHandler);
      return;
    }
    super.override(keyOrHandler.nodeType, keyOrHandler);
  }

  /**
   * Get handler for a node type
   *
   * @param nodeType - Type of node to get handler for
   * @returns Handler or undefined if not found
   */
  get(nodeType: NodeType): NodeHandler | undefined {
    return super.get(nodeType) ?? backendNodeRegistry.getHandler(nodeType);
  }

  /**
   * Check if a handler exists for a node type
   *
   * @param nodeType - Type of node to check
   * @returns True if handler exists
   */
  has(nodeType: NodeType): boolean {
    return super.has(nodeType) || backendNodeRegistry.has(nodeType);
  }

  /**
   * Get all registered node types
   *
   * @returns Array of registered node types
   */
  getRegisteredTypes(): NodeType[] {
    const types = new Set<NodeType>([...backendNodeRegistry.getKeys(), ...this.getKeys()]);
    return Array.from(types);
  }
}

/**
 * Create a handler registry with default handlers plus custom additions.
 *
 * Custom handlers must not replace built-ins; use createHandlerRegistryWithOverrides
 * (or SessionEngineConfig.handlerOverrides) to replace existing handlers explicitly.
 */
export function createHandlerRegistry(customHandlers: NodeHandler[] = []): HandlerRegistry {
  return createHandlerRegistryWithOverrides({ customHandlers });
}

export interface HandlerRegistryConfig {
  customHandlers?: NodeHandler[];
  handlerOverrides?: NodeHandler[];
}

function assertUniqueHandlers(label: string, handlers: NodeHandler[]): void {
  const seen = new Set<NodeType>();
  for (const handler of handlers) {
    if (seen.has(handler.nodeType)) {
      throw new Error(`Duplicate handler for node type "${handler.nodeType}" in ${label}`);
    }
    seen.add(handler.nodeType);
  }
}

/**
 * Create a handler registry with default handlers plus optional overrides/additions.
 */
export function createHandlerRegistryWithOverrides(config: HandlerRegistryConfig = {}): HandlerRegistry {
  const { customHandlers = [], handlerOverrides = [] } = config;
  const defaultTypes = new Set(defaultHandlers.map((handler) => handler.nodeType));

  assertUniqueHandlers("customHandlers", customHandlers);
  assertUniqueHandlers("handlerOverrides", handlerOverrides);

  for (const handler of customHandlers) {
    if (defaultTypes.has(handler.nodeType)) {
      throw new Error(
        `Custom handler for node type "${handler.nodeType}" conflicts with built-in handler. Use handlerOverrides to replace built-ins.`
      );
    }
  }

  const customTypes = new Set(customHandlers.map((handler) => handler.nodeType));
  for (const handler of handlerOverrides) {
    if (!defaultTypes.has(handler.nodeType)) {
      throw new Error(
        `Handler override for node type "${handler.nodeType}" does not match a built-in handler. Use customHandlers to add new types.`
      );
    }
    if (customTypes.has(handler.nodeType)) {
      throw new Error(`Handler override for node type "${handler.nodeType}" conflicts with customHandlers.`);
    }
  }

  const registry = new HandlerRegistry();
  for (const handler of handlerOverrides) {
    registry.override(handler);
  }
  for (const handler of customHandlers) {
    registry.register(handler);
  }
  return registry;
}

// Export individual handlers for direct use/testing
export { agentHandler } from "./types/agent";
export { conditionHandler } from "./types/condition";
export { crmHandler } from "./types/crm";
export { endHandler } from "./types/end";
export { messageHandler } from "./types/message";
export { questionnaireHandler, handleQuestionnaireResponse } from "./types/questionnaire/handler";
export { startHandler } from "./types/start";
export { teleportHandler } from "./types/teleport";
export { waitHandler } from "./types/wait";
export { webhookHandler } from "./types/webhook";
