/**
 * CRM Client Routes
 *
 * REST API for client management including profile, stage assignment,
 * custom fields, and activity timeline.
 *
 * @module modules/crm/routes/clients
 */

import { z } from "zod";
import { createLogger } from "@journey/logger";
import {
  NotFoundError,
  BadRequestError,
  AssignClientStageInputSchema,
  UpdateClientFieldsInputSchema,
  AddClientTagInputSchema,
  SendMessageInputSchema,
} from "@journey/schemas";

import { createProtectedRouter, protect } from "../../../lib/protected-router";
import { validateJson, validateQuery } from "../../../lib/zod-validator";
import { DEFAULT_LIMIT, MAX_LIMIT, MAX_OFFSET } from "../../../lib/query-helpers";
import { createServicesFromContext } from "../../../services";

const log = createLogger("api:crm:clients");

export const clientsRouter = createProtectedRouter({
  defaultPermission: { resource: "crmClient", action: "read" },
});

const ListClientsQuerySchema = z.object({
  stageId: z.string().optional(),
  stageIds: z.string().optional(),
  pipelineId: z.string().optional(),
  journeyId: z.string().optional(),
  tags: z.string().optional(),
  search: z.string().optional(),
  noStage: z.enum(["true", "false"]).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).optional().default(DEFAULT_LIMIT),
  offset: z.coerce.number().int().min(0).max(MAX_OFFSET).optional().default(0),
});

const PaginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).optional().default(DEFAULT_LIMIT),
  offset: z.coerce.number().int().min(0).max(MAX_OFFSET).optional().default(0),
});

function parseCsvParam(value?: string): string[] | undefined {
  if (!value) return undefined;
  const entries = value.split(",").map((entry) => entry.trim()).filter(Boolean);
  return entries.length > 0 ? entries : undefined;
}

/**
 * GET /clients - List clients with CRM data
 * Query params: stageId, stageIds (comma-separated), pipelineId, journeyId, tags, search, noStage, dateFrom, dateTo, limit, offset
 */
clientsRouter.get("/", async (c) => {
  const user = c.get("authUser");
  const organization = c.get("authOrg");
  const services = createServicesFromContext(c);

  const queryResult = validateQuery(c, ListClientsQuerySchema);
  if (!queryResult.success) {
    return queryResult.response;
  }

  const {
    stageId,
    stageIds,
    pipelineId,
    journeyId,
    tags,
    search,
    noStage,
    dateFrom,
    dateTo,
    limit,
    offset,
  } = queryResult.data;

  const parsedTags = parseCsvParam(tags);
  const parsedStageIds = parseCsvParam(stageIds);

  const result = await services.crm.getCrmClients(
    {
      stageId,
      stageIds: parsedStageIds,
      pipelineId,
      journeyId,
      tags: parsedTags,
      search,
      noStage: noStage === "true",
      dateFrom,
      dateTo,
    },
    { limit, offset }
  );

  log.debug(
    { userId: user.id, organizationId: organization.id, total: result.total, returned: result.clients.length },
    "crm:clients:list"
  );
  return c.json(result);
});

/**
 * GET /clients/:clientId - Get CRM profile for a client
 */
clientsRouter.get(
  "/:clientId",
  protect({ resource: { type: "client", extractor: { param: "clientId" } } }),
  async (c) => {
    const user = c.get("authUser");
    const organization = c.get("authOrg");
    const clientId = c.get("verifiedResourceId")!;
    const services = createServicesFromContext(c);

    const profile = await services.crm.getClientCrmProfile(clientId);

    if (!profile) {
      throw new NotFoundError("Client", clientId);
    }

    log.debug({ userId: user.id, organizationId: organization.id, clientId }, "crm:clients:get");
    return c.json({ client: profile });
  }
);

/**
 * PUT /clients/:clientId/stage - Assign client to a stage
 */
clientsRouter.put(
  "/:clientId/stage",
  protect({
    permission: { resource: "crmClient", action: "update" },
    resource: { type: "client", extractor: { param: "clientId" } },
  }),
  async (c) => {
    const user = c.get("authUser");
    const organization = c.get("authOrg");
    const clientId = c.get("verifiedResourceId")!;
    const services = createServicesFromContext(c);

    const parseResult = await validateJson(c, AssignClientStageInputSchema);
    if (!parseResult.success) {
      return parseResult.response;
    }

    const { stageId, notes } = parseResult.data;
    await services.crm.assignClientToStage(clientId, stageId, user.id, notes, { triggeredBy: "manual", performedBy: user.id });
    log.info({ userId: user.id, organizationId: organization.id, clientId, stageId }, "crm:clients:assignStage");
    return c.json({ success: true });
  }
);

/**
 * GET /clients/:clientId/stage-history - Get stage change history
 */
clientsRouter.get(
  "/:clientId/stage-history",
  protect({ resource: { type: "client", extractor: { param: "clientId" } } }),
  async (c) => {
    const user = c.get("authUser");
    const organization = c.get("authOrg");
    const clientId = c.get("verifiedResourceId")!;
    const services = createServicesFromContext(c);

    const history = await services.crm.getClientStageHistory(clientId);
    log.debug({ userId: user.id, organizationId: organization.id, clientId, count: history.length }, "crm:clients:stageHistory");
    return c.json({ history });
  }
);

/**
 * GET /clients/:clientId/fields - Get custom field values for a client
 */
clientsRouter.get(
  "/:clientId/fields",
  protect({ resource: { type: "client", extractor: { param: "clientId" } } }),
  async (c) => {
    const user = c.get("authUser");
    const organization = c.get("authOrg");
    const clientId = c.get("verifiedResourceId")!;
    const services = createServicesFromContext(c);

    const fields = await services.crm.getClientFieldValues(clientId);
    log.debug({ userId: user.id, organizationId: organization.id, clientId, count: fields.length }, "crm:clients:fields");
    return c.json({ fields });
  }
);

/**
 * PUT /clients/:clientId/fields - Update custom field values
 */
clientsRouter.put(
  "/:clientId/fields",
  protect({
    permission: { resource: "crmClient", action: "update" },
    resource: { type: "client", extractor: { param: "clientId" } },
  }),
  async (c) => {
    const user = c.get("authUser");
    const organization = c.get("authOrg");
    const clientId = c.get("verifiedResourceId")!;
    const services = createServicesFromContext(c);

    const parseResult = await validateJson(c, UpdateClientFieldsInputSchema);
    if (!parseResult.success) {
      return parseResult.response;
    }

    await services.crm.updateClientFieldValues(clientId, parseResult.data.values, user.id);
    log.info({ userId: user.id, organizationId: organization.id, clientId, count: parseResult.data.values.length }, "crm:clients:updateFields");
    return c.json({ success: true });
  }
);

/**
 * GET /clients/:clientId/timeline - Get activity timeline
 */
clientsRouter.get(
  "/:clientId/timeline",
  protect({ resource: { type: "client", extractor: { param: "clientId" } } }),
  async (c) => {
    const user = c.get("authUser");
    const organization = c.get("authOrg");
    const clientId = c.get("verifiedResourceId")!;
    const services = createServicesFromContext(c);

    const paginationResult = validateQuery(c, PaginationQuerySchema);
    if (!paginationResult.success) {
      return paginationResult.response;
    }
    const { limit, offset } = paginationResult.data;

    const timeline = await services.crm.getClientTimeline(clientId, { limit, offset });
    log.debug({ userId: user.id, organizationId: organization.id, clientId, count: timeline.length }, "crm:clients:timeline");
    return c.json({ timeline });
  }
);

/**
 * POST /clients/:clientId/tags - Add a tag to a client
 */
clientsRouter.post(
  "/:clientId/tags",
  protect({
    permission: { resource: "tag", action: "create" },
    resource: { type: "client", extractor: { param: "clientId" } },
  }),
  async (c) => {
    const user = c.get("authUser");
    const organization = c.get("authOrg");
    const clientId = c.get("verifiedResourceId")!;
    const services = createServicesFromContext(c);

    const parseResult = await validateJson(c, AddClientTagInputSchema);
    if (!parseResult.success) {
      return parseResult.response;
    }

    const { tag: tagName } = parseResult.data;

    await services.tag.executeOperations(
      clientId,
      { add: [tagName] },
      { triggeredBy: "manual", performedBy: user.id }
    );

    const tagDefinition = await services.tag.getTagDefinitionByName(tagName);
    if (!tagDefinition) {
      throw new NotFoundError("Tag", tagName);
    }

    const tag = {
      id: tagDefinition.id,
      tag: tagDefinition.name,
      createdAt: tagDefinition.createdAt ?? new Date(),
    };

    log.info({ userId: user.id, organizationId: organization.id, clientId, tag: tagName }, "crm:clients:tags:add");
    return c.json({ tag });
  }
);

/**
 * DELETE /clients/:clientId/tags/:tag - Remove a tag from a client
 */
clientsRouter.delete(
  "/:clientId/tags/:tag",
  protect({
    permission: { resource: "tag", action: "delete" },
    resource: { type: "client", extractor: { param: "clientId" } },
  }),
  async (c) => {
    const user = c.get("authUser");
    const organization = c.get("authOrg");
    const clientId = c.get("verifiedResourceId")!;
    const tagName = c.req.param("tag");
    const services = createServicesFromContext(c);

    // Find tag by name
    const tags = await services.tag.getClientTags(clientId);
    const tag = tags.find((t) => t.tagName === tagName);

    if (!tag) {
      throw new NotFoundError("Tag", tagName);
    }

    await services.tag.executeOperations(
      clientId,
      { remove: [tagName] },
      { triggeredBy: "manual", performedBy: user.id }
    );

    log.info({ userId: user.id, organizationId: organization.id, clientId, tag: tagName }, "crm:clients:tags:remove");
    return c.json({ success: true });
  }
);

/**
 * POST /clients/:clientId/messages - Send a direct message to a client
 */
clientsRouter.post(
  "/:clientId/messages",
  protect({
    permission: { resource: "crmMessage", action: "create" },
    resource: { type: "client", extractor: { param: "clientId" } },
  }),
  async (c) => {
    const user = c.get("authUser");
    const organization = c.get("authOrg");
    const clientId = c.get("verifiedResourceId")!;
    const services = createServicesFromContext(c);

    const parseResult = await validateJson(c, SendMessageInputSchema);
    if (!parseResult.success) {
      return parseResult.response;
    }

    const { channelId, content } = parseResult.data;
    const result = await services.crm.sendDirectMessage(
      {
        clientId,
        channelId,
        content,
      },
      user.id
    );

    if (!result.success) {
      throw new BadRequestError(result.error || "Failed to send message");
    }

    log.info({ userId: user.id, organizationId: organization.id, clientId, messageId: result.messageId }, "crm:clients:messages:send");
    return c.json(result);
  }
);

/**
 * GET /clients/:clientId/messages - Get message history for a client
 */
clientsRouter.get(
  "/:clientId/messages",
  protect({
    permission: { resource: "crmMessage", action: "read" },
    resource: { type: "client", extractor: { param: "clientId" } },
  }),
  async (c) => {
    const user = c.get("authUser");
    const organization = c.get("authOrg");
    const clientId = c.get("verifiedResourceId")!;
    const services = createServicesFromContext(c);

    const queryResult = validateQuery(c, PaginationQuerySchema);
    if (!queryResult.success) {
      return queryResult.response;
    }
    const { limit, offset } = queryResult.data;

    const messages = await services.crm.getClientMessages(clientId, limit, offset);
    log.debug({ userId: user.id, organizationId: organization.id, clientId, count: messages.length }, "crm:clients:messages:list");
    return c.json({ messages });
  }
);
