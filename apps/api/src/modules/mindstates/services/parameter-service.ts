/**
 * Mindstate Parameter Service
 *
 * Parameter access for condition evaluation in journey engine.
 * Provides efficient access to mindstate parameter values for expressions like:
 * `mindstate.mood.stress > 7`
 *
 * @module modules/mindstates/services/parameter-service
 */

import { clientMindstates } from "@journey/db";
import { createLogger, serializeError } from "@journey/logger";
import type { MindstateQuery, StateParameterValue } from "@journey/schemas";
import { and, eq } from "drizzle-orm";

import { getDefinition } from "./definition-service";
import type { MindstateServiceContext } from "./service-context";

const log = createLogger("mindstate-parameter-service");

/**
 * Get a single parameter value for a client's mindstate
 * Used by condition evaluator for expressions like: mindstate.mood.stress > 7
 */
export async function getParameterValue(
  ctx: MindstateServiceContext,
  clientId: string,
  definitionKey: string,
  parameterName: string
): Promise<StateParameterValue | null> {
  try {
    // Get the definition to find its ID
    const definition = await getDefinition(ctx, definitionKey);
    if (!definition) {
      log.debug({ clientId, definitionKey, parameterName }, "parameterService:getParameterValue:definitionNotFound");
      return null;
    }

    // Get the client mindstate
    const results = await ctx.db
      .select()
      .from(clientMindstates)
      .where(and(eq(clientMindstates.clientId, clientId), eq(clientMindstates.definitionId, definition.id)));

    if (results.length === 0) {
      log.debug({ clientId, definitionKey, parameterName }, "parameterService:getParameterValue:mindstateNotFound");
      return null;
    }

    const mindstate = results[0];
    const param = mindstate.stateParameters.find((p) => p.name === parameterName || p.id === parameterName);

    if (!param) {
      log.debug({ clientId, definitionKey, parameterName }, "parameterService:getParameterValue:parameterNotFound");
      return null;
    }

    return param.currentValue;
  } catch (error) {
    log.error(
      { clientId, definitionKey, parameterName, err: serializeError(error) },
      "parameterService:getParameterValue:error"
    );
    throw error;
  }
}

/**
 * Get multiple parameter values in batch
 * Used for efficient condition evaluation with multiple mindstate references
 */
export async function getParameterValues(
  ctx: MindstateServiceContext,
  clientId: string,
  queries: MindstateQuery[]
): Promise<Map<string, StateParameterValue>> {
  const results = new Map<string, StateParameterValue>();

  try {
    // Group queries by mindstate key for efficient DB access
    const queryByKey = new Map<string, string[]>();
    for (const query of queries) {
      const existing = queryByKey.get(query.mindstateKey) ?? [];
      existing.push(query.parameterName);
      queryByKey.set(query.mindstateKey, existing);
    }

    // Fetch each mindstate and extract parameter values
    for (const [mindstateKey, parameterNames] of queryByKey) {
      const definition = await getDefinition(ctx, mindstateKey);
      if (!definition) continue;

      const mindstateResults = await ctx.db
        .select()
        .from(clientMindstates)
        .where(and(eq(clientMindstates.clientId, clientId), eq(clientMindstates.definitionId, definition.id)));

      if (mindstateResults.length === 0) continue;

      const mindstate = mindstateResults[0];
      for (const paramName of parameterNames) {
        const param = mindstate.stateParameters.find((p) => p.name === paramName || p.id === paramName);
        if (param) {
          // Key format: mindstateKey.parameterName
          results.set(`${mindstateKey}.${paramName}`, param.currentValue);
        }
      }
    }

    return results;
  } catch (error) {
    log.error(
      { clientId, queryCount: queries.length, err: serializeError(error) },
      "parameterService:getParameterValues:error"
    );
    throw error;
  }
}

/**
 * Get all mindstate parameters for a client as a flat object
 * Useful for building context in condition evaluation
 */
export async function getMindstateContext(
  ctx: MindstateServiceContext,
  clientId: string,
  definitionKeys: string[]
): Promise<Record<string, Record<string, StateParameterValue>>> {
  const context: Record<string, Record<string, StateParameterValue>> = {};

  try {
    for (const key of definitionKeys) {
      const definition = await getDefinition(ctx, key);
      if (!definition) continue;

      const results = await ctx.db
        .select()
        .from(clientMindstates)
        .where(and(eq(clientMindstates.clientId, clientId), eq(clientMindstates.definitionId, definition.id)));

      if (results.length === 0) continue;

      const mindstate = results[0];
      context[key] = {};
      for (const param of mindstate.stateParameters) {
        context[key][param.name] = param.currentValue;
      }
    }

    return context;
  } catch (error) {
    log.error(
      { clientId, definitionKeys, err: serializeError(error) },
      "parameterService:getMindstateContext:error"
    );
    throw error;
  }
}
