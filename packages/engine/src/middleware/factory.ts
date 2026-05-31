/**
 * Middleware Factory
 *
 * Factory functions for creating middleware pipelines with common configurations.
 */

import { createLogger } from "@journey/logger";
import {
  crmMiddlewareDefinition,
  tagMiddlewareDefinition,
  variableMiddlewareDefinition,
  createVariableMiddlewareDefinition,
  type VariableMiddlewareConfig,
} from "./built-in";
import { MiddlewarePipeline, type MiddlewarePipelineConfig } from "./middleware-pipeline";
import type { MiddlewareDefinition } from "./types";

const log = createLogger("middleware-factory");

export interface CreateMiddlewarePipelineConfig extends MiddlewarePipelineConfig {
  /**
   * Whether to include built-in tag middleware
   * Default: true
   */
  includeTags?: boolean;

  /**
   * Whether to include built-in variable middleware
   * Default: true
   */
  includeVariables?: boolean;

  /**
   * Configuration for variable middleware
   */
  variableConfig?: VariableMiddlewareConfig;

  /**
   * Whether to include built-in CRM middleware
   * Default: true
   */
  includeCrm?: boolean;

  /**
   * Custom middleware to add to the pipeline
   * Added after built-in middleware
   */
  customMiddleware?: MiddlewareDefinition[];
}

/**
 * Create a middleware pipeline with configurable built-in middleware
 *
 * @param config - Configuration options
 * @returns Configured middleware pipeline
 *
 * @example
 * ```ts
 * // Default pipeline with all built-in middleware
 * const pipeline = createMiddlewarePipeline();
 *
 * // Pipeline without CRM middleware
 * const pipeline = createMiddlewarePipeline({ includeCrm: false });
 *
 * // Pipeline with custom middleware
 * const pipeline = createMiddlewarePipeline({
 *   customMiddleware: [{ name: "audit", middleware: auditMiddleware, priority: 90 }]
 * });
 * ```
 */
export function createMiddlewarePipeline(config: CreateMiddlewarePipelineConfig = {}): MiddlewarePipeline {
  const {
    includeTags = true,
    includeVariables = true,
    variableConfig,
    includeCrm = true,
    customMiddleware = [],
    ...pipelineConfig
  } = config;

  const pipeline = new MiddlewarePipeline({
    ...pipelineConfig,
    logger: pipelineConfig.logger ?? log,
  });

  // Add built-in middleware in priority order
  if (includeTags) {
    pipeline.useDefinition(tagMiddlewareDefinition);
  }

  if (includeVariables) {
    // Use custom variable config if provided
    if (variableConfig) {
      pipeline.useDefinition(createVariableMiddlewareDefinition(variableConfig));
    } else {
      pipeline.useDefinition(variableMiddlewareDefinition);
    }
  }

  if (includeCrm) {
    pipeline.useDefinition(crmMiddlewareDefinition);
  }

  // Add custom middleware
  for (const definition of customMiddleware) {
    pipeline.useDefinition(definition);
  }

  return pipeline;
}
