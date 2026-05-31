/**
 * Base Node Executor - Abstract class for workflow node execution
 *
 * Provides common functionality for all node executors:
 * - Automatic timing measurement
 * - Standardized logging format
 * - Error handling with proper logging
 *
 * @module workflow/executors/base-executor
 */

import type { NodeExecutor, NodeInput, NodeOutput, WorkflowContext } from "../types";

/**
 * Abstract base class for node executors.
 *
 * Implements the NodeExecutor interface with automatic timing and logging.
 * Subclasses should implement the `executeNode` method with their logic.
 *
 * @example
 * ```typescript
 * export class StartNodeExecutor extends BaseNodeExecutor<StartNodeConfig> {
 *   readonly nodeType = "start";
 *
 *   protected async executeNode(
 *     input: NodeInput,
 *     config: StartNodeConfig,
 *     context: WorkflowContext
 *   ): Promise<NodeOutput> {
 *     return { outHandle: "default", executionTimeMs: 0 };
 *   }
 * }
 * ```
 */
export abstract class BaseNodeExecutor<TConfig = unknown> implements NodeExecutor<TConfig> {
  /**
   * Node type identifier for logging.
   * Should match the WorkflowNodeType enum value.
   */
  abstract readonly nodeType: string;

  /**
   * Execute the node with automatic timing and logging.
   *
   * This method wraps the `executeNode` implementation with:
   * - Start/end timing measurement
   * - Debug logging at start and completion
   * - Error logging on failure
   *
   * @param input - Input data from previous nodes
   * @param config - Node-specific configuration
   * @param context - Workflow execution context
   * @returns Output including routing handle and data
   */
  async execute(input: NodeInput, config: TConfig, context: WorkflowContext): Promise<NodeOutput> {
    const startTime = Date.now();

    context.log.debug({ nodeType: this.nodeType }, `workflow:${this.nodeType}:start`);

    try {
      const output = await this.executeNode(input, config, context);

      // Ensure executionTimeMs is set
      output.executionTimeMs = Date.now() - startTime;

      context.log.debug(
        {
          nodeType: this.nodeType,
          executionTimeMs: output.executionTimeMs,
          outHandle: output.outHandle,
        },
        `workflow:${this.nodeType}:complete`
      );

      return output;
    } catch (error) {
      context.log.error(
        {
          nodeType: this.nodeType,
          error: error instanceof Error ? error.message : String(error),
          executionTimeMs: Date.now() - startTime,
        },
        `workflow:${this.nodeType}:error`
      );
      throw error;
    }
  }

  /**
   * Execute the node logic.
   *
   * Subclasses must implement this method with their specific behavior.
   * The `executionTimeMs` will be automatically set by the base class.
   *
   * @param input - Input data from previous nodes
   * @param config - Node-specific configuration
   * @param context - Workflow execution context
   * @returns Output (executionTimeMs will be overwritten by base class)
   */
  protected abstract executeNode(
    input: NodeInput,
    config: TConfig,
    context: WorkflowContext
  ): Promise<NodeOutput>;
}
