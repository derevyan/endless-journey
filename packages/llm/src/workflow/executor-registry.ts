/**
 * Executor Registry - Registry for node executors
 *
 * This module provides a singleton registry for mapping node types to their executors.
 */

import { createLogger } from "@journey/logger";
import { BaseRegistry } from "@journey/schemas";
import type { WorkflowNodeType } from "@journey/schemas";
import type { NodeExecutor } from "./types";

const log = createLogger("llm:workflow:registry");

/**
 * Registry of node executors.
 *
 * Each node type has a registered executor that handles its execution.
 */
class ExecutorRegistry extends BaseRegistry<WorkflowNodeType, NodeExecutor<unknown>> {
  constructor() {
    super({
      onDuplicate: (nodeType) => {
        log.debug({ nodeType }, "workflow:executor:alreadyRegistered");
      },
      allowOverwrite: true,
    });
  }

  /**
   * Register an executor for a node type.
   *
   * This method is idempotent - registering the same node type twice will
   * log a debug message and skip the duplicate registration.
   */
  register<TConfig>(nodeType: WorkflowNodeType, executor: NodeExecutor<TConfig>): void {
    if (this.has(nodeType)) {
      log.debug({ nodeType }, "workflow:executor:alreadyRegistered");
      return;
    }
    super.register(nodeType, executor as NodeExecutor<unknown>);
    log.debug({ nodeType }, "workflow:executor:registered");
  }

  /**
   * Get executor for a node type.
   * @throws Error if no executor registered
   */
  get(nodeType: WorkflowNodeType): NodeExecutor<unknown> {
    const executor = super.get(nodeType);

    if (!executor) {
      throw new Error(
        `No executor registered for node type: ${nodeType}. ` +
          `Available types: ${this.getKeys().join(", ")}`
      );
    }

    return executor;
  }

  /**
   * Check if executor exists for node type.
   */
  has(nodeType: WorkflowNodeType): boolean {
    return super.has(nodeType);
  }

  /**
   * Get all registered node types.
   */
  getRegisteredTypes(): WorkflowNodeType[] {
    return this.getKeys();
  }

  /**
   * Clear all registered executors (useful for testing).
   */
  clear(): void {
    this.items.clear();
  }
}

// Singleton instance
export const executorRegistry = new ExecutorRegistry();

/**
 * Helper to register an executor.
 */
export function registerNodeExecutor<TConfig>(
  nodeType: WorkflowNodeType,
  executor: NodeExecutor<TConfig>
): void {
  executorRegistry.register(nodeType, executor);
}

/**
 * Helper to get an executor.
 */
export function getNodeExecutor(nodeType: WorkflowNodeType): NodeExecutor<unknown> {
  return executorRegistry.get(nodeType);
}
