/**
 * Built-in Middleware
 *
 * Core middleware that ships with the engine.
 * Each middleware handles a specific type of post-handler processing.
 *
 * Priority Guide:
 * - 0-19: Pre-processing (validation, setup)
 * - 20-49: Core processing (tags: 20, variables: 25)
 * - 50-79: Side effects (CRM: 50, webhooks)
 * - 80-99: Post-processing (cleanup, logging)
 * - 100+: Custom middleware
 */

export {
  createTagMiddleware,
  tagMiddlewareDefinition,
} from "./tag-middleware";

export {
  createVariableMiddleware,
  createVariableMiddlewareDefinition,
  variableMiddlewareDefinition,
  type VariableMiddlewareConfig,
} from "./variable-middleware";

export {
  createCrmMiddleware,
  crmMiddlewareDefinition,
} from "./crm-middleware";
