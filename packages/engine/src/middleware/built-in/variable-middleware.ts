/**
 * Variable Middleware
 *
 * Processes variable operations (user, journey, global scopes) configured on journey nodes.
 * Runs after the node handler completes to apply variable changes.
 */

import { createLogger, serializeError } from "@journey/logger";
import { EventTypes, type VariableAction } from "@journey/schemas";
import type { Middleware, MiddlewareDefinition } from "../types";
import { MIDDLEWARE_PRIORITIES } from "../priorities";

const log = createLogger("variable-middleware");

export interface VariableMiddlewareConfig {
  /**
   * When true, variable operation errors stop the pipeline.
   * When false (default), errors are logged and pipeline continues.
   */
  strictMode?: boolean;
}

/**
 * Variable middleware factory
 *
 * Creates a middleware that processes variable operations across all scopes.
 *
 * @param config - Configuration options for the middleware
 */
export function createVariableMiddleware(config: VariableMiddlewareConfig = {}): Middleware {
  const { strictMode = false } = config;

  return async (node, context, _result, next) => {
    const { services } = context;

    // Null check: node.data may be undefined
    if (!node.data) {
      log.trace({ nodeId: node.id }, "variableMiddleware:skip:noNodeData");
      await next();
      return;
    }

    const variableAction = node.data.variableAction as VariableAction | undefined;

    if (!variableAction) {
      log.trace({ nodeId: node.id }, "variableMiddleware:skip:noVariableAction");
      await next();
      return;
    }

    // Check if there are any operations to execute
    const journeyOps = variableAction.journeyOperations || [];
    const globalOps = variableAction.globalOperations || [];
    const userOps = variableAction.userOperations || [];

    if (journeyOps.length === 0 && globalOps.length === 0 && userOps.length === 0) {
      log.trace({ nodeId: node.id }, "variableMiddleware:skip:emptyOperations");
      await next();
      return;
    }

    // Track success for logging - only log operations if they succeeded
    let success = false;

    try {
      await services.variable.executeAction(variableAction);
      success = true;

      // Log operations executed for debugging
      log.debug(
        {
          nodeId: node.id,
          userOps: userOps.length,
          journeyOps: journeyOps.length,
          globalOps: globalOps.length,
          operations: [...userOps, ...journeyOps, ...globalOps].map((op) => ({
            op: op.op,
            key: op.key,
          })),
        },
        "variableMiddleware:executed"
      );
    } catch (error) {
      log.error({ err: serializeError(error), nodeId: node.id }, "variableMiddleware:error");

      // In strict mode, emit error event and throw to let pipeline handle
      // The pipeline's stopOnError config decides whether to stop or continue
      if (strictMode) {
        services.eventLogger.logEvent({
          type: EventTypes.ENGINE_ERROR,
          nodeId: node.id,
          payload: {
            error: "variable_operation_failed",
            message: error instanceof Error ? error.message : "Unknown error",
          },
        });
        // Throw to let pipeline handle based on stopOnError config:
        // - stopOnError=true: pipeline re-throws, SessionEngine sets status="error"
        // - stopOnError=false: pipeline logs and continues to next middleware
        throw error;
      }
      // In non-strict mode, continue pipeline (success stays false, won't log ops)
    }

    // Only log variable event if operations succeeded
    if (success) {
      const allOps = [
        ...userOps.map((op) => ({ ...op, scope: "user" as const })),
        ...journeyOps.map((op) => ({ ...op, scope: "journey" as const })),
        ...globalOps.map((op) => ({ ...op, scope: "global" as const })),
      ];

      services.eventLogger.logEvent({
        type: EventTypes.SESSION_VARIABLES,
        nodeId: node.id,
        payload: {
          userOperationCount: userOps.length,
          journeyOperationCount: journeyOps.length,
          globalOperationCount: globalOps.length,
          operations: allOps.map((op) => ({
            op: op.op,
            key: op.key,
            scope: op.scope,
            // Include value/amount for state reconstruction
            ...("value" in op && { value: op.value }),
            ...("amount" in op && { amount: op.amount }),
          })),
        },
      });
    }

    await next();
  };
}

/**
 * Variable middleware definition with default priority
 *
 * Priority 25: Core processing (runs after tags)
 */
export const variableMiddlewareDefinition: MiddlewareDefinition = {
  name: "variable",
  middleware: createVariableMiddleware(),
  priority: MIDDLEWARE_PRIORITIES.VARIABLES,
};

/**
 * Create variable middleware definition with custom config
 */
export function createVariableMiddlewareDefinition(
  config: VariableMiddlewareConfig = {}
): MiddlewareDefinition {
  return {
    name: "variable",
    middleware: createVariableMiddleware(config),
    priority: MIDDLEWARE_PRIORITIES.VARIABLES,
  };
}
