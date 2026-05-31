/**
 * Middleware System
 *
 * Provides a composable pipeline for post-handler processing.
 * Middleware runs after node handlers complete to apply side effects
 * like tag updates, variable operations, and CRM changes.
 *
 * @example
 * ```ts
 * import { MiddlewarePipeline, tagMiddlewareDefinition, variableMiddlewareDefinition } from "./middleware";
 *
 * const pipeline = new MiddlewarePipeline()
 *   .useDefinition(tagMiddlewareDefinition)
 *   .useDefinition(variableMiddlewareDefinition)
 *   .use("custom", customMiddleware, 100);
 *
 * await pipeline.execute(node, context, result);
 * ```
 */

// Core types
export type { Middleware, MiddlewareNext, MiddlewareDefinition } from "./types";

// Pipeline
export { MiddlewarePipeline, type MiddlewarePipelineConfig } from "./middleware-pipeline";

// Built-in middleware
export {
  // Tag
  createTagMiddleware,
  tagMiddlewareDefinition,
  // Variable
  createVariableMiddleware,
  createVariableMiddlewareDefinition,
  variableMiddlewareDefinition,
  type VariableMiddlewareConfig,
  // CRM
  createCrmMiddleware,
  crmMiddlewareDefinition,
} from "./built-in";

// Factory for creating a pipeline with all built-in middleware
export { createMiddlewarePipeline } from "./factory";
