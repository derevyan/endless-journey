/**
 * Variable Services Re-exports
 *
 * Consolidates variable domain services for external use.
 * Exports cached versions of all functions (preferred interface).
 * Types are exported from variable-service (the base definitions).
 *
 * @module modules/variables/services
 */

// Types
export type { VariableOperationContext } from "./variable-service";
export type { VariableServiceContext } from "./service-context";

// Services
export { ApiVariableService } from "./variable-service";
export { CachedVariableService, invalidateJourneyVariables, invalidateGlobalVariables, invalidateUserVariables } from "./cached-service";
