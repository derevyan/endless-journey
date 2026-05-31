/**
 * Variables Routes
 *
 * REST API for managing global and journey-scoped variables.
 *
 * @module modules/variables/routes
 */

import { createLogger } from "@journey/logger";
import {
  SetGlobalVariableInputSchema,
  SetJourneyVariableInputSchema,
  ExecuteVariableOperationsRequestSchema,
  type JourneyIdOrSlug,
  type VariableOperationEventContext,
  createJourneyIdOrSlug,
  NotFoundError,
  ForbiddenError,
  BadRequestError,
} from "@journey/schemas";
import { createProtectedRouter, protect } from "../../../lib/protected-router";
import { verifyJourneyOrganization } from "../../../lib/verification";
import { validateJson } from "../../../lib/zod-validator";
import { createServicesFromContext } from "../../../services";
// Use cached variable service for 10-50x faster variable access
// Cache is automatically invalidated on writes (set/delete operations)

const log = createLogger("api:variables");

function parseJourneyIdOrSlug(value: string): JourneyIdOrSlug {
  try {
    return createJourneyIdOrSlug(value);
  } catch (error) {
    throw new BadRequestError("Invalid journeyId", { journeyId: value }, error);
  }
}

const variables = createProtectedRouter({
  defaultPermission: { resource: "variable", action: "read" },
});

// =============================================================================
// GLOBAL VARIABLES
// =============================================================================

/**
 * GET /variables/global - List all global variables for current organization
 */
variables.get("/global", async (c) => {
  const user = c.get("authUser");
  const organization = c.get("authOrg");
  const services = createServicesFromContext(c);

  const vars = await services.variable.getGlobalVariables();
  log.debug({ userId: user.id, organizationId: organization.id, count: vars.length }, "variables:global:list");
  return c.json({ variables: vars });
});

/**
 * GET /variables/global/:key - Get a single global variable
 */
variables.get("/global/:key", async (c) => {
  const user = c.get("authUser");
  const organization = c.get("authOrg");
  const key = c.req.param("key");
  const services = createServicesFromContext(c);

  const variable = await services.variable.getGlobalVariable(key);

  if (!variable) {
    throw new NotFoundError("Variable", key);
  }

  log.debug({ userId: user.id, organizationId: organization.id, key }, "variables:global:get");
  return c.json({ variable });
});

/**
 * PUT /variables/global/:key - Set a global variable (create or update)
 */
variables.put(
  "/global/:key",
  protect({ permission: { resource: "variable", action: "update" } }),
  async (c) => {
    const user = c.get("authUser");
    const organization = c.get("authOrg");
    const services = createServicesFromContext(c);
    const key = c.req.param("key");

    const parseResult = await validateJson(c, SetGlobalVariableInputSchema);
    if (!parseResult.success) {
      return parseResult.response;
    }
    const data = parseResult.data;

    const variable = await services.variable.setGlobalVariable(key, data.value, data.description);
    log.info({ userId: user.id, organizationId: organization.id, key }, "variables:global:set");
    return c.json({ variable });
  }
);

/**
 * DELETE /variables/global/:key - Delete a global variable
 */
variables.delete(
  "/global/:key",
  protect({ permission: { resource: "variable", action: "delete" } }),
  async (c) => {
    const user = c.get("authUser");
    const organization = c.get("authOrg");
    const key = c.req.param("key");
    const services = createServicesFromContext(c);

    const deleted = await services.variable.deleteGlobalVariable(key);

    if (!deleted) {
      throw new NotFoundError("Variable", key);
    }

    log.info({ userId: user.id, organizationId: organization.id, key }, "variables:global:delete");
    return c.json({ success: true });
  }
);

// =============================================================================
// JOURNEY VARIABLES
// =============================================================================

/**
 * GET /variables/journey/:journeyId - List all variables for a journey
 */
variables.get("/journey/:journeyId", async (c) => {
  const user = c.get("authUser");
  const organization = c.get("authOrg");
  const journeyId = c.req.param("journeyId");
  const services = createServicesFromContext(c);

  const vars = await services.variable.getJourneyVariables(parseJourneyIdOrSlug(journeyId));
  log.debug(
    { userId: user.id, organizationId: organization.id, journeyId, count: vars.length },
    "variables:journey:list"
  );
  return c.json({ variables: vars });
});

/**
 * GET /variables/journey/:journeyId/:key - Get a single journey variable
 */
variables.get("/journey/:journeyId/:key", async (c) => {
  const user = c.get("authUser");
  const organization = c.get("authOrg");
  const journeyId = c.req.param("journeyId");
  const key = c.req.param("key");
  const services = createServicesFromContext(c);

  const variable = await services.variable.getJourneyVariable(parseJourneyIdOrSlug(journeyId), key);

  if (!variable) {
    throw new NotFoundError("Variable", key);
  }

  log.debug({ userId: user.id, organizationId: organization.id, journeyId, key }, "variables:journey:get");
  return c.json({ variable });
});

/**
 * PUT /variables/journey/:journeyId/:key - Set a journey variable (create or update)
 */
variables.put(
  "/journey/:journeyId/:key",
  protect({ permission: { resource: "variable", action: "update" } }),
  async (c) => {
    const user = c.get("authUser");
    const organization = c.get("authOrg");
    const journeyId = c.req.param("journeyId");
    const key = c.req.param("key");
    const services = createServicesFromContext(c);

    const parseResult = await validateJson(c, SetJourneyVariableInputSchema);
    if (!parseResult.success) {
      return parseResult.response;
    }
    const data = parseResult.data;

    const variable = await services.variable.setJourneyVariable(
      parseJourneyIdOrSlug(journeyId),
      key,
      data.value,
      data.description
    );
    log.info({ userId: user.id, organizationId: organization.id, journeyId, key }, "variables:journey:set");
    return c.json({ variable });
  }
);

/**
 * DELETE /variables/journey/:journeyId/:key - Delete a journey variable
 */
variables.delete(
  "/journey/:journeyId/:key",
  protect({ permission: { resource: "variable", action: "delete" } }),
  async (c) => {
    const user = c.get("authUser");
    const organization = c.get("authOrg");
    const journeyId = c.req.param("journeyId");
    const key = c.req.param("key");
    const services = createServicesFromContext(c);

    const deleted = await services.variable.deleteJourneyVariable(parseJourneyIdOrSlug(journeyId), key);

    if (!deleted) {
      throw new NotFoundError("Variable", key);
    }

    log.info({ userId: user.id, organizationId: organization.id, journeyId, key }, "variables:journey:delete");
    return c.json({ success: true });
  }
);

// =============================================================================
// EXECUTE OPERATIONS (for engine)
// =============================================================================

/**
 * POST /variables/execute - Execute variable operations
 * Used by the engine to process variableAction from nodes
 */
variables.post(
  "/execute",
  protect({ permission: { resource: "variable", action: "update" } }),
  async (c) => {
    const user = c.get("authUser");
    const organization = c.get("authOrg");
    const services = createServicesFromContext(c);

    const parseResult = await validateJson(c, ExecuteVariableOperationsRequestSchema);
    if (!parseResult.success) {
      return parseResult.response;
    }

    const { scope, journeyId, organizationId, operations } = parseResult.data;

    // Determine the scope ID based on scope type
    let scopeId: string;
    if (scope === "global") {
      // Use provided organizationId or fall back to current organization
      scopeId = organizationId || organization.id;
      // Verify user has access to this organization
      if (scopeId !== organization.id) {
        throw new ForbiddenError("Access denied to specified organization");
      }
    } else {
      // Journey scope - require journeyId
      if (!journeyId) {
        throw new BadRequestError("journeyId is required for journey scope");
      }
      // Verify journey belongs to organization and get resolved UUID
      const resolvedJourneyId = await verifyJourneyOrganization(parseJourneyIdOrSlug(journeyId), organization.id);
      if (!resolvedJourneyId) {
        throw new NotFoundError("Journey", journeyId);
      }
      scopeId = resolvedJourneyId;
    }

    // Execute with proper event context
    const eventContext: VariableOperationEventContext = {
      organizationId: organization.id,
      triggeredBy: "manual",
      performedBy: user.id,
    };
    await services.variable.executeOperations(scope, scopeId, operations, eventContext);

    log.info({ userId: user.id, organizationId: organization.id, scope, scopeId, operationCount: operations.length }, "variables:execute");
    return c.json({ success: true });
  }
);

export { variables };
