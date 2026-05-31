/**
 * Middleware Types
 *
 * Defines the core interfaces for the middleware pipeline system.
 * Middleware runs after node handlers complete to apply side effects
 * like tag updates, variable operations, and CRM changes.
 */

import type { JourneyNodeData } from "@journey/schemas";
import type { ExecutionContext, HandlerResult } from "../types";

/**
 * Next function to continue to the next middleware
 */
export type MiddlewareNext = () => Promise<void>;

/**
 * Middleware function signature
 *
 * Middleware runs after the node handler completes.
 * It receives the node, execution context, handler result, and a next function.
 * Call next() to continue to the next middleware in the chain.
 * Not calling next() will short-circuit the pipeline (useful for error scenarios).
 *
 * @param node - The journey node that was executed
 * @param context - The execution context with session, services, etc.
 * @param result - The result from the node handler
 * @param next - Function to call to continue to the next middleware
 *
 * @example
 * ```ts
 * const loggingMiddleware: Middleware = async (node, context, result, next) => {
 *   context.log.info({ nodeId: node.id, action: result.action }, "middleware:nodeExecuted");
 *   await next(); // Continue to next middleware
 * };
 * ```
 */
export type Middleware = (
  node: JourneyNodeData,
  context: ExecutionContext,
  result: HandlerResult,
  next: MiddlewareNext
) => Promise<void>;

/**
 * Middleware definition with metadata
 *
 * Used for registration with the pipeline.
 * Includes name for debugging and priority for ordering.
 */
export interface MiddlewareDefinition {
  /** Unique name for this middleware (for debugging/logging) */
  name: string;

  /** The middleware function */
  middleware: Middleware;

  /**
   * Priority for ordering (lower = runs first)
   * Default: 100
   *
   * Suggested ranges:
   * - 0-19: Pre-processing (validation, setup)
   * - 20-49: Core processing (tags, variables)
   * - 50-79: Side effects (CRM, webhooks)
   * - 80-99: Post-processing (cleanup, logging)
   * - 100+: Custom middleware
   */
  priority?: number;
}
