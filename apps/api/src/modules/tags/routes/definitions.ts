/**
 * Tag Definitions Routes
 *
 * REST API for managing tag definitions (the tag registry).
 * Tags are organization-wide and follow users across all journeys.
 *
 * Routes:
 * - GET /tags/global - List tags for organization
 * - POST /tags/global - Create tag
 * - PUT /tags/global/:tag - Update tag by name
 * - DELETE /tags/global/:tag - Delete tag by name
 *
 * @module modules/tags/routes/definitions
 */

import { createLogger } from "@journey/logger";
import { CreateTagDefinitionInputSchema, UpdateTagDefinitionInputSchema, NotFoundError } from "@journey/schemas";

import { createProtectedRouter, protect } from "../../../lib/protected-router";
import { validateJson } from "../../../lib/zod-validator";
import { createServicesFromContext } from "../../../services";

const log = createLogger("api:tag-definitions");

const tagDefinitionsRouter = createProtectedRouter({
  defaultPermission: { resource: "tag", action: "read" },
});

// =============================================================================
// TAG DEFINITIONS (organization-wide)
// =============================================================================

/**
 * GET /tags/global - List all tag definitions for current organization
 */
tagDefinitionsRouter.get("/global", async (c) => {
  const user = c.get("authUser");
  const organization = c.get("authOrg");
  const services = createServicesFromContext(c);

  const tags = await services.tag.getTagDefinitions();

  // Transform to match existing API response shape
  const response = tags.map((t) => ({
    id: t.id,
    tag: t.name,
    description: t.description,
    color: t.color,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  }));

  log.debug({ userId: user.id, organizationId: organization.id, count: tags.length }, "tagDefinitions:list");
  return c.json({ tags: response });
});

/**
 * POST /tags/global - Add a tag definition
 */
tagDefinitionsRouter.post(
  "/global",
  protect({ permission: { resource: "tag", action: "create" } }),
  async (c) => {
    const user = c.get("authUser");
    const organization = c.get("authOrg");
    const services = createServicesFromContext(c);

    const parseResult = await validateJson(c, CreateTagDefinitionInputSchema);
    if (!parseResult.success) {
      return parseResult.response;
    }
    const data = parseResult.data;

    const tag = await services.tag.createTagDefinition({
      name: data.tag,
      description: data.description,
      color: data.color,
      performedBy: "admin",
    });

    // Transform to match existing API response shape
    const response = {
      id: tag.id,
      tag: tag.name,
      description: tag.description,
      color: tag.color,
      createdAt: tag.createdAt,
      updatedAt: tag.updatedAt,
    };

    log.info({ userId: user.id, organizationId: organization.id, tag: data.tag }, "tagDefinitions:add");
    return c.json({ tag: response });
  }
);

/**
 * PUT /tags/global/:tag - Update a tag definition by name
 */
tagDefinitionsRouter.put(
  "/global/:tag",
  protect({ permission: { resource: "tagDefinition", action: "update" } }),
  async (c) => {
    const user = c.get("authUser");
    const organization = c.get("authOrg");
    const tagName = c.req.param("tag");
    const services = createServicesFromContext(c);

    const parseResult = await validateJson(c, UpdateTagDefinitionInputSchema);
    if (!parseResult.success) {
      return parseResult.response;
    }
    const data = parseResult.data;

    // Find tag by name
    const existingTag = await services.tag.getTagDefinitionByName(tagName);
    if (!existingTag) {
      throw new NotFoundError("Tag", tagName);
    }

    const updated = await services.tag.updateTagDefinition(existingTag.id, {
      description: data.description,
      color: data.color,
    });

    if (!updated) {
      throw new NotFoundError("Tag", tagName);
    }

    // Transform to match existing API response shape
    const response = {
      id: updated.id,
      tag: updated.name,
      description: updated.description,
      color: updated.color,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };

    log.info({ userId: user.id, organizationId: organization.id, tag: tagName }, "tagDefinitions:update");
    return c.json({ tag: response });
  }
);

/**
 * DELETE /tags/global/:tag - Remove a tag definition by name
 */
tagDefinitionsRouter.delete(
  "/global/:tag",
  protect({ permission: { resource: "tag", action: "delete" } }),
  async (c) => {
    const user = c.get("authUser");
    const organization = c.get("authOrg");
    const tagName = c.req.param("tag");
    const services = createServicesFromContext(c);

    // Find tag by name
    const existingTag = await services.tag.getTagDefinitionByName(tagName);
    if (!existingTag) {
      throw new NotFoundError("Tag", tagName);
    }

    const deleted = await services.tag.deleteTagDefinition(existingTag.id);

    if (!deleted) {
      throw new NotFoundError("Tag", tagName);
    }

    log.info({ userId: user.id, organizationId: organization.id, tag: tagName }, "tagDefinitions:remove");
    return c.json({ success: true });
  }
);

export { tagDefinitionsRouter as tagDefinitions };
