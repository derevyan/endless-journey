/**
 * Mindstates Routes
 *
 * REST API for managing mindstate definitions and client mindstates.
 *
 * ## Definitions Routes (Organization-level)
 * - GET    /api/mindstates/definitions           - List all definitions
 * - POST   /api/mindstates/definitions           - Create definition
 * - GET    /api/mindstates/definitions/:key      - Get by key
 * - PUT    /api/mindstates/definitions/:key      - Update
 * - DELETE /api/mindstates/definitions/:key      - Delete
 *
 * ## Client Mindstates Routes
 * - GET    /api/mindstates/clients/:clientId              - List client's mindstates
 * - GET    /api/mindstates/clients/:clientId/:key         - Get specific
 * - POST   /api/mindstates/clients/:clientId/:key/analyze - Trigger manual analysis
 * - GET    /api/mindstates/clients/:clientId/:key/history - Analysis history
 *
 * @module modules/mindstates/routes
 */

import { z } from "zod";
import { createLogger } from "@journey/logger";
import {
  CreateMindstateDefinitionInputSchema,
  UpdateMindstateDefinitionInputSchema,
  PreviewAnalyzeRequestSchema,
  AnalyzeMessageRequestSchema,
  AtomicSaveMindstateInputSchema,
  NotFoundError,
  ConflictError,
} from "@journey/schemas";

import { createProtectedRouter, protect } from "../../../lib/protected-router";
import { validateJson, validateQuery } from "../../../lib/zod-validator";
import { DEFAULT_LIMIT, MAX_LIMIT } from "../../../lib/query-helpers";
import { createServicesFromContext } from "../../../services";

const log = createLogger("api:mindstates");

const mindstatesRouter = createProtectedRouter({
  defaultPermission: { resource: "mindstate", action: "read" },
});

const MindstateHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).optional().default(DEFAULT_LIMIT),
});

// =============================================================================
// DEFINITIONS ROUTES (Organization-level templates)
// =============================================================================

/**
 * GET /mindstates/definitions - List all mindstate definitions for organization
 */
mindstatesRouter.get("/definitions", async (c) => {
  const user = c.get("authUser");
  const organization = c.get("authOrg");
  const services = createServicesFromContext(c);

  const definitions = await services.mindstate.listDefinitions();
  log.debug(
    { userId: user.id, organizationId: organization.id, count: definitions.length },
    "mindstates:definitions:list"
  );
  return c.json({ definitions });
});

/**
 * POST /mindstates/definitions - Create a new mindstate definition
 */
mindstatesRouter.post(
  "/definitions",
  protect({ permission: { resource: "mindstate", action: "create" } }),
  async (c) => {
    const user = c.get("authUser");
    const organization = c.get("authOrg");
    const services = createServicesFromContext(c);

    const parseResult = await validateJson(c, CreateMindstateDefinitionInputSchema);
    if (!parseResult.success) {
      return parseResult.response;
    }
    const data = parseResult.data;

    // Check if key already exists
    const existing = await services.mindstate.getDefinition(data.key);
    if (existing) {
      throw new ConflictError(`Mindstate definition with key "${data.key}" already exists`);
    }

    const definition = await services.mindstate.createDefinition(
      {
        key: data.key,
        name: data.name,
        description: data.description,
        mainAgentConfig: data.mainAgentConfig,
        defaultAgents: data.defaultAgents,
        defaultParameters: data.defaultParameters,
        analysisMode: data.analysisMode ?? "automatic",
        categories: data.categories,
      },
      user.id
    );

    log.info({ userId: user.id, organizationId: organization.id, key: data.key }, "mindstates:definitions:create");
    return c.json({ definition }, 201);
  }
);

/**
 * GET /mindstates/definitions/:keyOrId - Get a specific mindstate definition
 * Supports lookup by key (e.g., "default-companion") or UUID ID
 */
mindstatesRouter.get("/definitions/:keyOrId", async (c) => {
  const user = c.get("authUser");
  const organization = c.get("authOrg");
  const keyOrId = c.req.param("keyOrId");
  const services = createServicesFromContext(c);

  // Check if the parameter looks like a UUID (contains hyphens and is 36 chars)
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(keyOrId);

  let definition;
  if (isUuid) {
    // Lookup by ID, then verify it belongs to the organization
    definition = await services.mindstate.getDefinitionById(keyOrId);
  } else {
    // Lookup by key
    definition = await services.mindstate.getDefinition(keyOrId);
  }

  if (!definition) {
    throw new NotFoundError("Mindstate definition", keyOrId);
  }

  log.debug({ userId: user.id, organizationId: organization.id, keyOrId }, "mindstates:definitions:get");
  return c.json({ definition });
});

/**
 * PUT /mindstates/definitions/:key - Update a mindstate definition
 */
mindstatesRouter.put(
  "/definitions/:key",
  protect({ permission: { resource: "mindstate", action: "update" } }),
  async (c) => {
    const user = c.get("authUser");
    const organization = c.get("authOrg");
    const key = c.req.param("key");
    const services = createServicesFromContext(c);

    const parseResult = await validateJson(c, UpdateMindstateDefinitionInputSchema);
    if (!parseResult.success) {
      return parseResult.response;
    }
    const data = parseResult.data;

    const definition = await services.mindstate.updateDefinition(
      key,
      {
        key: data.key,
        name: data.name,
        description: data.description ?? undefined,
        mainAgentConfig: data.mainAgentConfig,
        defaultAgents: data.defaultAgents,
        defaultParameters: data.defaultParameters,
        analysisMode: data.analysisMode,
        categories: data.categories,
        status: data.status,
      },
      user.id
    );

    if (!definition) {
      throw new NotFoundError("Mindstate definition", key);
    }

    log.info({ userId: user.id, organizationId: organization.id, key }, "mindstates:definitions:update");
    return c.json({ definition });
  }
);

/**
 * DELETE /mindstates/definitions/:key - Delete a mindstate definition
 */
mindstatesRouter.delete(
  "/definitions/:key",
  protect({ permission: { resource: "mindstate", action: "delete" } }),
  async (c) => {
    const user = c.get("authUser");
    const organization = c.get("authOrg");
    const key = c.req.param("key");
    const services = createServicesFromContext(c);

    const deleted = await services.mindstate.deleteDefinition(key, user.id);
    if (!deleted) {
      throw new NotFoundError("Mindstate definition", key);
    }

    log.info({ userId: user.id, organizationId: organization.id, key }, "mindstates:definitions:delete");
    return c.json({ success: true });
  }
);

/**
 * POST /mindstates/definitions/:key/preview - Preview analysis (Builder testing mode)
 *
 * Run analysis pipeline without persisting to database.
 * Used by MindState Builder to test definitions in real-time.
 */
mindstatesRouter.post(
  "/definitions/:key/preview",
  protect({ permission: { resource: "mindstate", action: "analyze" } }),
  async (c) => {
    const user = c.get("authUser");
    const organization = c.get("authOrg");
    const key = c.req.param("key");
    const services = createServicesFromContext(c);

    const parseResult = await validateJson(c, PreviewAnalyzeRequestSchema);
    if (!parseResult.success) {
      return parseResult.response;
    }

    const { message, currentState, systemAgents, mainAgent, messageHistory } = parseResult.data;

    // Run preview analysis (no persistence)
    const result = await services.mindstate.previewAnalyzeMessage({
      message,
      currentState,
      systemAgents,
      mainAgent,
      messageHistory,
    });

    log.info(
      {
        userId: user.id,
        organizationId: organization.id,
        key,
        changesCount: result.stateChanges.length,
        insightsCount: result.insights.length,
      },
      "mindstates:definitions:preview"
    );

    return c.json({ result });
  }
);

// =============================================================================
// VERSION ROUTES (Definition version history)
// =============================================================================

/**
 * GET /mindstates/definitions/:id/versions - List all versions for a definition
 */
mindstatesRouter.get("/definitions/:id/versions", async (c) => {
  const user = c.get("authUser");
  const definitionId = c.req.param("id");
  const services = createServicesFromContext(c);

  const versions = await services.mindstate.listVersions(definitionId);
  log.debug({ userId: user.id, definitionId, count: versions.length }, "mindstates:versions:list");
  return c.json({ versions });
});

/**
 * POST /mindstates/definitions/:id/save - Atomic save (version + definition update in transaction)
 *
 * Preferred save endpoint that:
 * - Generates version ID server-side (prevents collisions)
 * - Uses transaction for atomicity (both operations succeed or both fail)
 * - Reduces network roundtrips (one call instead of two)
 */
mindstatesRouter.post(
  "/definitions/:id/save",
  protect({ permission: { resource: "mindstateVersion", action: "create" } }),
  async (c) => {
    const user = c.get("authUser");
    const definitionId = c.req.param("id");
    const services = createServicesFromContext(c);

    const parseResult = await validateJson(c, AtomicSaveMindstateInputSchema);
    if (!parseResult.success) {
      return parseResult.response;
    }
    const data = parseResult.data;

    const result = await services.mindstate.saveVersionAtomic(definitionId, user.id, data);
    log.info({ userId: user.id, definitionId, versionId: result.versionId }, "mindstates:versions:saveAtomic");
    return c.json(result, 201);
  }
);

/**
 * GET /mindstates/definitions/:id/versions/:versionId - Get a specific version with configuration
 */
mindstatesRouter.get("/definitions/:id/versions/:versionId", async (c) => {
  const user = c.get("authUser");
  const definitionId = c.req.param("id");
  const versionId = c.req.param("versionId");
  const services = createServicesFromContext(c);

  const versionData = await services.mindstate.getVersion(definitionId, versionId);

  if (!versionData) {
    log.warn({ userId: user.id, definitionId, versionId }, "mindstates:versions:getVersion:notFound");
    throw new NotFoundError("Version", versionId);
  }

  log.debug({ userId: user.id, definitionId, versionId }, "mindstates:versions:getVersion");
  return c.json(versionData);
});

/**
 * DELETE /mindstates/definitions/:id/versions/:versionId - Delete a version
 */
mindstatesRouter.delete(
  "/definitions/:id/versions/:versionId",
  protect({ permission: { resource: "mindstateVersion", action: "delete" } }),
  async (c) => {
    const user = c.get("authUser");
    const definitionId = c.req.param("id");
    const versionId = c.req.param("versionId");
    const services = createServicesFromContext(c);

    const deleted = await services.mindstate.deleteVersion(definitionId, versionId);

    if (!deleted) {
      log.warn({ userId: user.id, definitionId, versionId }, "mindstates:versions:deleteVersion:notFound");
      throw new NotFoundError("Version", versionId);
    }

    log.info({ userId: user.id, definitionId, versionId }, "mindstates:versions:deleteVersion");
    return c.json({ success: true }, 200);
  }
);

// =============================================================================
// CLIENT MINDSTATES ROUTES
// =============================================================================

/**
 * GET /mindstates/clients/:clientId - List all mindstates for a client
 */
mindstatesRouter.get(
  "/clients/:clientId",
  protect({
    resource: { type: "client", extractor: { param: "clientId" }, action: "read" },
  }),
  async (c) => {
    const user = c.get("authUser");
    const organization = c.get("authOrg");
    const requestedClientId = c.req.param("clientId");
    const clientId = c.get("verifiedResourceId") ?? null;
    const services = createServicesFromContext(c);
    if (!clientId) {
      throw new NotFoundError("Client", requestedClientId);
    }

    const mindstates = await services.mindstate.listClientMindstates(clientId);
    log.debug(
      { userId: user.id, organizationId: organization.id, clientId, count: mindstates.length },
      "mindstates:clients:list"
    );
    return c.json({ mindstates });
  }
);

/**
 * GET /mindstates/clients/:clientId/:key - Get specific mindstate for client
 */
mindstatesRouter.get(
  "/clients/:clientId/:key",
  protect({
    resource: { type: "client", extractor: { param: "clientId" }, action: "read" },
  }),
  async (c) => {
    const user = c.get("authUser");
    const organization = c.get("authOrg");
    const requestedClientId = c.req.param("clientId");
    const clientId = c.get("verifiedResourceId") ?? null;
    const key = c.req.param("key");
    const services = createServicesFromContext(c);
    if (!clientId) {
      throw new NotFoundError("Client", requestedClientId);
    }

    // getOrCreateClientMindstate throws "definition not found" error if definition doesn't exist
    const mindstate = await services.mindstate.getOrCreateClientMindstate(clientId, key);

    log.debug({ userId: user.id, organizationId: organization.id, clientId, key }, "mindstates:clients:get");
    return c.json({ mindstate });
  }
);

/**
 * POST /mindstates/clients/:clientId/:key/analyze - Trigger manual analysis
 */
mindstatesRouter.post(
  "/clients/:clientId/:key/analyze",
  protect({
    permission: { resource: "mindstate", action: "analyze" },
    resource: { type: "client", extractor: { param: "clientId" }, action: "analyze" },
  }),
  async (c) => {
    const user = c.get("authUser");
    const organization = c.get("authOrg");
    const requestedClientId = c.req.param("clientId");
    const clientId = c.get("verifiedResourceId") ?? null;
    const key = c.req.param("key");
    const services = createServicesFromContext(c);
    if (!clientId) {
      throw new NotFoundError("Client", requestedClientId);
    }

    const parseResult = await validateJson(c, AnalyzeMessageRequestSchema);
    if (!parseResult.success) {
      return parseResult.response;
    }

    const { message, sessionId } = parseResult.data;

    // Get or create the mindstate
    const mindstate = await services.mindstate.getOrCreateClientMindstate(clientId, key);

    // Run analysis (trigger: "api" for manual analysis via API)
    const result = await services.mindstate.analyzeMessage(mindstate.id, message, "api", sessionId);

    log.info(
      {
        userId: user.id,
        organizationId: organization.id,
        clientId,
        key,
        changesCount: result.changes.length,
      },
      "mindstates:clients:analyze"
    );
    return c.json({ result });
  }
);

/**
 * GET /mindstates/clients/:clientId/:key/history - Get analysis history
 */
mindstatesRouter.get(
  "/clients/:clientId/:key/history",
  protect({
    resource: { type: "client", extractor: { param: "clientId" }, action: "read" },
  }),
  async (c) => {
    const user = c.get("authUser");
    const organization = c.get("authOrg");
    const requestedClientId = c.req.param("clientId");
    const clientId = c.get("verifiedResourceId") ?? null;
    const key = c.req.param("key");
    const services = createServicesFromContext(c);
    if (!clientId) {
      throw new NotFoundError("Client", requestedClientId);
    }

    // Get the mindstate first
    const mindstate = await services.mindstate.getOrCreateClientMindstate(clientId, key);

    const queryResult = validateQuery(c, MindstateHistoryQuerySchema);
    if (!queryResult.success) {
      return queryResult.response;
    }
    const { limit } = queryResult.data;

    const history = await services.mindstate.getAnalysisHistory(mindstate.id, limit);

    log.debug(
      { userId: user.id, organizationId: organization.id, clientId, key, count: history.length },
      "mindstates:clients:history"
    );
    return c.json({ history });
  }
);

export { mindstatesRouter as mindstates };
