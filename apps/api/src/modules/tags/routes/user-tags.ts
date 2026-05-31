/**
 * User Tags Routes
 *
 * REST API for managing user tag assignments (not tag definitions).
 * Tags are stored in client_tags table and follow users across all journeys.
 *
 * Note: For organization-level tag definitions (tag registry), see routes/definitions.ts
 *
 * @module modules/tags/routes/user-tags
 */

import { createLogger } from "@journey/logger";
import { AddTagToClientInputSchema, ExecuteTagOperationsInputSchema, NotFoundError } from "@journey/schemas";

import { createProtectedRouter, protect } from "../../../lib/protected-router";
import { validateJson } from "../../../lib/zod-validator";
import { createServicesFromContext } from "../../../services";

const log = createLogger("api:tags");

const tags = createProtectedRouter({
  defaultPermission: { resource: "tag", action: "read" },
});

// =============================================================================
// USER TAGS (client_tags table)
// Tags that follow a user across ALL journeys
// =============================================================================

/**
 * GET /tags/global/:clientId - List all tags for a user
 */
tags.get(
  "/global/:clientId",
  protect({
    resource: { type: "client", extractor: { param: "clientId" }, action: "read" },
  }),
  async (c) => {
    const user = c.get("authUser");
    const organization = c.get("authOrg");
    const clientId = c.get("verifiedResourceId")!;
    const services = createServicesFromContext(c);

    const tagList = await services.tag.getClientTags(clientId);
    const tagResponse = tagList.map((t) => ({
      id: t.tagId,
      tag: t.tagName,
      createdAt: t.createdAt,
    }));
    log.debug({ userId: user.id, organizationId: organization.id, clientId, count: tagResponse.length }, "tags:list");
    return c.json({ tags: tagResponse });
  }
);

/**
 * POST /tags/global/:clientId - Add a tag to a user
 */
tags.post(
  "/global/:clientId",
  protect({
    permission: { resource: "tag", action: "create" },
    resource: { type: "client", extractor: { param: "clientId" }, action: "update" },
  }),
  async (c) => {
    const user = c.get("authUser");
    const organization = c.get("authOrg");
    const clientId = c.get("verifiedResourceId")!;
    const services = createServicesFromContext(c);

    const parseResult = await validateJson(c, AddTagToClientInputSchema);
    if (!parseResult.success) {
      return parseResult.response;
    }
    const data = parseResult.data;

    // Ensure tag exists and get tag ID
    const tagId = await services.tag.ensureTag(data.tag, "admin");
    await services.tag.assignTagToClient(clientId, tagId);
    const tag = {
      id: tagId,
      tag: data.tag,
      createdAt: new Date(),
    };
    log.info({ userId: user.id, organizationId: organization.id, clientId, tag: data.tag }, "tags:add");
    return c.json({ tag });
  }
);

/**
 * DELETE /tags/global/:clientId/:tag - Remove a tag from a user
 */
tags.delete(
  "/global/:clientId/:tag",
  protect({
    permission: { resource: "tag", action: "delete" },
    resource: { type: "client", extractor: { param: "clientId" }, action: "update" },
  }),
  async (c) => {
    const user = c.get("authUser");
    const organization = c.get("authOrg");
    const clientId = c.get("verifiedResourceId")!;
    const tagName = c.req.param("tag");
    const services = createServicesFromContext(c);

    // Find tag by name
    const tagList = await services.tag.getClientTags(clientId);
    const tag = tagList.find((t) => t.tagName === tagName);

    if (!tag) {
      throw new NotFoundError("Tag", tagName);
    }

    await services.tag.removeTagFromClient(clientId, tag.tagId);
    log.info({ userId: user.id, organizationId: organization.id, clientId, tag: tagName }, "tags:remove");
    return c.json({ success: true });
  }
);

// =============================================================================
// EXECUTE OPERATIONS (for engine)
// =============================================================================

/**
 * POST /tags/execute - Execute tag operations
 * Used by the engine to process tagAction from nodes
 *
 * Body:
 * - clientId: The client to apply tags to
 * - add: string[] - tags to add
 * - remove: string[] - tags to remove
 */
tags.post(
  "/execute",
  protect({
    permission: { resource: "tag", action: "create" },
    resource: { type: "client", extractor: { body: "clientId" }, action: "update" },
  }),
  async (c) => {
    const user = c.get("authUser");
    const organization = c.get("authOrg");
    const clientId = c.get("verifiedResourceId")!;
    const services = createServicesFromContext(c);

    const parseResult = await validateJson(c, ExecuteTagOperationsInputSchema);
    if (!parseResult.success) {
      return parseResult.response;
    }
    const data = parseResult.data;
    const { add, remove } = data;

    // Execute with organization context for tag auto-creation
    await services.tag.executeOperations(clientId, { add, remove }, { triggeredBy: "manual", performedBy: user.id });

    log.info(
      {
        userId: user.id,
        organizationId: organization.id,
        clientId,
        addCount: add?.length || 0,
        removeCount: remove?.length || 0,
      },
      "tags:execute"
    );
    return c.json({ success: true });
  }
);

export { tags };
