/**
 * Variable Service
 *
 * Service for executing variable operations during journey execution.
 * This service is used by the engine to process variableAction on nodes.
 *
 * Supports three scopes:
 * - journey: Stored in journey_variables table (journey-specific)
 * - global: Stored in global_variables table (organization-wide)
 * - user: Stored on channel_users (user-specific, follows user across journeys)
 *
 * The actual persistence is handled through callbacks to the API layer,
 * keeping the engine decoupled from the database.
 */

import { serializeError, type createLogger } from "@journey/logger";
import type { VariableAction, VariableScope } from "@journey/schemas";
import type { GetUserVariablesCallback, GetVariablesCallback, UserVariableOperationCallback, VariableOperationCallback } from "../types";

/**
 * Dependencies for creating the variable service
 */
export interface VariableServiceDeps {
  journeyId: string;
  organizationId: string;
  userId: string;
  log: ReturnType<typeof createLogger>;
}

/**
 * Variable service interface.
 * Implements IVariableService from @journey/schemas.
 */
export interface VariableService {
  /**
   * Execute variable operations from a variableAction
   */
  executeAction(action: VariableAction): Promise<void>;

  /**
   * Get all variables for a scope as a key-value map
   * Used for building execution context.
   * Implements IVariableService.getAll from SharedServiceContext.
   */
  getAll(scope: VariableScope): Promise<Record<string, unknown>>;
}

/**
 * Callbacks and options for variable service behavior
 */
export interface VariableServiceCallbacks {
  onExecute?: VariableOperationCallback;
  onUserExecute?: UserVariableOperationCallback;
  onGetVariables?: GetVariablesCallback;
  onGetUserVariables?: GetUserVariablesCallback;
  strict?: boolean;
  onStrictError?: (error: unknown) => void;
}

// =============================================================================
// SERVICE FACTORY
// =============================================================================

/**
 * Create a variable service instance
 *
 * The service uses callbacks to interact with the database layer,
 * keeping the engine decoupled from persistence concerns.
 */
export function createVariableService(
  deps: VariableServiceDeps,
  callbacks: VariableServiceCallbacks = {}
): VariableService {
  const { journeyId, organizationId, userId, log } = deps;
  const {
    onExecute,
    onUserExecute,
    onGetVariables,
    onGetUserVariables,
    strict = false,
    onStrictError,
  } = callbacks;

  if (!onExecute && !onUserExecute && !onGetVariables && !onGetUserVariables) {
    return createNoOpVariableService();
  }

  const handleStrictError = (error: unknown): void => {
    if (strict) {
      onStrictError?.(error);
      throw error;
    }
  };

  return {
    async executeAction(action: VariableAction): Promise<void> {
      const journeyOps = [...(action.journeyOperations || [])];
      const globalOps = [...(action.globalOperations || [])];
      const userOps = [...(action.userOperations || [])];

      if (userOps.length > 0) {
        log.debug({ scope: "user", userId, operationCount: userOps.length }, "engine:variableService:executeAction:user");
        if (onUserExecute) {
          try {
            await onUserExecute(userId, userOps);
          } catch (error) {
            log.error({ err: serializeError(error), scope: "user", userId, ops: userOps }, "engine:variableService:executeAction:error");
            handleStrictError(error);
          }
        } else {
          log.warn({ userOpsCount: userOps.length }, "engine:variableService:noUserVariableCallback");
        }
      }

      if (journeyOps.length > 0 && onExecute) {
        log.debug({ scope: "journey", scopeId: journeyId, operationCount: journeyOps.length }, "engine:variableService:executeAction:journey");
        try {
          await onExecute("journey", journeyId, journeyOps);
        } catch (error) {
          log.error({ err: serializeError(error), scope: "journey", scopeId: journeyId, ops: journeyOps }, "engine:variableService:executeAction:error");
          handleStrictError(error);
        }
      }

      if (globalOps.length > 0 && onExecute) {
        log.debug({ scope: "global", scopeId: organizationId, operationCount: globalOps.length }, "engine:variableService:executeAction:global");
        try {
          await onExecute("global", organizationId, globalOps);
        } catch (error) {
          log.error({ err: serializeError(error), scope: "global", scopeId: organizationId, ops: globalOps }, "engine:variableService:executeAction:error");
          handleStrictError(error);
        }
      }

      if (journeyOps.length === 0 && globalOps.length === 0 && userOps.length === 0) {
        return;
      }

      if (!onExecute && (journeyOps.length > 0 || globalOps.length > 0)) {
        log.warn({ journeyOpsCount: journeyOps.length, globalOpsCount: globalOps.length }, "engine:variableService:noExecuteCallback");
      }
    },

    async getAll(scope: VariableScope): Promise<Record<string, unknown>> {
      if (scope === "user") {
        if (onGetUserVariables) {
          try {
            const variables = await onGetUserVariables(userId);
            log.debug({ scope, userId, variableCount: Object.keys(variables).length }, "engine:variableService:getAll:user");
            return variables;
          } catch (error) {
            log.error({ err: serializeError(error), scope, userId }, "engine:variableService:getAll:error");
            return {};
          }
        }
        log.warn({ scope, userId }, "engine:variableService:noGetUserVariablesCallback");
        return {};
      }

      const scopeId = scope === "global" ? organizationId : journeyId;

      if (onGetVariables) {
        try {
          const variables = await onGetVariables(scope, scopeId);
          log.debug({ scope, scopeId, variableCount: Object.keys(variables).length }, "engine:variableService:getAll");
          return variables;
        } catch (error) {
          log.error({ err: serializeError(error), scope, scopeId }, "engine:variableService:getAll:error");
          return {};
        }
      }

      log.warn({ scope, scopeId }, "engine:variableService:noGetVariablesCallback");
      return {};
    },
  };
}

/**
 * Create a no-op variable service for testing or when variables are not needed
 */
export function createNoOpVariableService(): VariableService {
  return {
    async executeAction(): Promise<void> {
      // No-op
    },
    async getAll(): Promise<Record<string, unknown>> {
      return {};
    },
  };
}
