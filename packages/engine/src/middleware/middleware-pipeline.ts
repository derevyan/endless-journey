/**
 * Middleware Pipeline
 *
 * Executes middleware in priority order using Express-style next() pattern.
 * Provides composable, extensible post-handler processing.
 */

import { createLogger, serializeError } from "@journey/logger";
import type { JourneyNodeData } from "@journey/schemas";
import type { ExecutionContext, HandlerResult } from "../types";
import type { Middleware, MiddlewareDefinition } from "./types";

const log = createLogger("middleware-pipeline");

/**
 * Configuration for the middleware pipeline
 */
export interface MiddlewarePipelineConfig {
  /**
   * Whether to stop pipeline execution on middleware error
   * Default: false (continue with warning)
   *
   * When false: Errors are logged and pipeline continues to next middleware
   * When true: First error stops the pipeline and is re-thrown
   */
  stopOnError?: boolean;

  /** Custom logger */
  logger?: ReturnType<typeof createLogger>;
}

/**
 * Middleware Pipeline
 *
 * Manages and executes a chain of middleware functions in priority order.
 * Uses the classic next() pattern for flow control.
 *
 * @example
 * ```ts
 * const pipeline = new MiddlewarePipeline()
 *   .use("tag", tagMiddleware, 10)
 *   .use("variable", variableMiddleware, 20)
 *   .use("crm", crmMiddleware, 30);
 *
 * await pipeline.execute(node, context, result);
 * ```
 */
export class MiddlewarePipeline {
  private middlewares: MiddlewareDefinition[] = [];
  private config: MiddlewarePipelineConfig;
  private logger: ReturnType<typeof createLogger>;

  constructor(config: MiddlewarePipelineConfig = {}) {
    this.config = config;
    this.logger = config.logger ?? log;
  }

  /**
   * Add middleware to the pipeline
   *
   * Middleware is automatically sorted by priority (lower = runs first).
   * Returns this for method chaining.
   *
   * @param name - Unique name for this middleware (for debugging)
   * @param middleware - The middleware function
   * @param priority - Priority for ordering (default: 100)
   */
  use(name: string, middleware: Middleware, priority = 100): this {
    this.middlewares.push({ name, middleware, priority });
    // Keep sorted by priority
    this.middlewares.sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));
    return this;
  }

  /**
   * Add middleware from a definition object
   *
   * @param definition - Middleware definition with name, middleware, and optional priority
   */
  useDefinition(definition: MiddlewareDefinition): this {
    return this.use(definition.name, definition.middleware, definition.priority);
  }

  /**
   * Execute all middleware in priority order
   *
   * Uses the classic next() pattern for flow control:
   * - Each middleware calls next() to continue to the next middleware
   * - Not calling next() short-circuits the pipeline
   * - Errors are handled based on stopOnError config
   * - Each middleware gets its own next() function with re-entrancy protection
   *
   * @param node - The journey node that was executed
   * @param context - The execution context
   * @param result - The handler result
   */
  async execute(node: JourneyNodeData, context: ExecutionContext, result: HandlerResult): Promise<void> {
    // Recursive helper that creates a unique next() for each middleware
    // This prevents re-entrancy bugs if middleware calls next() multiple times
    const executeAt = async (index: number): Promise<void> => {
      if (index >= this.middlewares.length) {
        return; // All middleware executed
      }

      const current = this.middlewares[index];
      let nextCalled = false;

      // Each middleware gets its own next() with its own "called" guard
      const next = async (): Promise<void> => {
        if (nextCalled) {
          this.logger.warn(
            { middlewareName: current.name, nodeId: node.id },
            "middleware:next:calledMultipleTimes"
          );
          return; // Ignore duplicate calls
        }
        nextCalled = true;
        await executeAt(index + 1);
      };

      try {
        this.logger.trace({ middlewareName: current.name, nodeId: node.id }, "middleware:executing");

        await current.middleware(node, context, result, next);

        this.logger.trace({ middlewareName: current.name, nodeId: node.id }, "middleware:completed");
      } catch (error) {
        this.logger.error(
          {
            err: serializeError(error),
            middlewareName: current.name,
            nodeId: node.id,
          },
          "middleware:error"
        );

        if (this.config.stopOnError) {
          throw error;
        }

        // Continue to next middleware despite error
        await executeAt(index + 1);
      }
    };

    await executeAt(0);
  }

  /**
   * Get list of registered middleware names in execution order
   * Useful for debugging and testing
   */
  getMiddlewareNames(): string[] {
    return this.middlewares.map((m) => m.name);
  }

  /**
   * Get the number of registered middleware
   */
  get size(): number {
    return this.middlewares.length;
  }

  /**
   * Check if a middleware with the given name is registered
   */
  has(name: string): boolean {
    return this.middlewares.some((m) => m.name === name);
  }

  /**
   * Remove a middleware by name
   * Returns true if found and removed, false otherwise
   */
  remove(name: string): boolean {
    const index = this.middlewares.findIndex((m) => m.name === name);
    if (index === -1) {
      return false;
    }
    this.middlewares.splice(index, 1);
    return true;
  }

  /**
   * Clear all middleware from the pipeline
   */
  clear(): void {
    this.middlewares = [];
  }
}
