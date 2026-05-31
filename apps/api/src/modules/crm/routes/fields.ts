/**
 * CRM Custom Field Routes
 *
 * REST API for custom field management including CRUD operations
 * and reordering.
 *
 * @module modules/crm/routes/fields
 */

import { createLogger } from "@journey/logger";
import {
  NotFoundError,
  CreateFieldInputSchema,
  UpdateFieldInputSchema,
  ReorderFieldsInputSchema,
} from "@journey/schemas";

import { createProtectedRouter, protect } from "../../../lib/protected-router";
import { validateJson } from "../../../lib/zod-validator";
import { createServicesFromContext } from "../../../services";

const log = createLogger("api:crm:fields");

export const fieldsRouter = createProtectedRouter({
  defaultPermission: { resource: "crmField", action: "read" },
});

/**
 * GET /fields - List all custom field definitions
 */
fieldsRouter.get("/", async (c) => {
  const user = c.get("authUser");
  const organization = c.get("authOrg");
  const services = createServicesFromContext(c);

  const fields = await services.crm.getCustomFields();
  log.debug({ userId: user.id, organizationId: organization.id, count: fields.length }, "crm:fields:list");
  return c.json({ fields });
});

/**
 * POST /fields - Create a new custom field
 */
fieldsRouter.post(
  "/",
  protect({ permission: { resource: "crmField", action: "create" } }),
  async (c) => {
    const user = c.get("authUser");
    const organization = c.get("authOrg");
    const services = createServicesFromContext(c);

    const parseResult = await validateJson(c, CreateFieldInputSchema);
    if (!parseResult.success) {
      return parseResult.response;
    }

    const field = await services.crm.createCustomField(parseResult.data);
    log.info({ userId: user.id, organizationId: organization.id, fieldId: field.id }, "crm:fields:create");
    return c.json({ field }, 201);
  }
);

/**
 * PUT /fields/reorder - Reorder custom fields
 * NOTE: This route must come BEFORE /:fieldId to avoid matching "reorder" as fieldId
 */
fieldsRouter.put(
  "/reorder",
  protect({ permission: { resource: "crmField", action: "update" } }),
  async (c) => {
    const user = c.get("authUser");
    const organization = c.get("authOrg");
    const services = createServicesFromContext(c);

    const parseResult = await validateJson(c, ReorderFieldsInputSchema);
    if (!parseResult.success) {
      return parseResult.response;
    }

    await services.crm.reorderCustomFields(parseResult.data.fieldIds);
    log.info({ userId: user.id, organizationId: organization.id, count: parseResult.data.fieldIds.length }, "crm:fields:reorder");
    return c.json({ success: true });
  }
);

/**
 * PUT /fields/:fieldId - Update a custom field
 */
fieldsRouter.put(
  "/:fieldId",
  protect({ permission: { resource: "crmField", action: "update" } }),
  async (c) => {
    const user = c.get("authUser");
    const organization = c.get("authOrg");
    const fieldId = c.req.param("fieldId");
    const services = createServicesFromContext(c);

    const parseResult = await validateJson(c, UpdateFieldInputSchema);
    if (!parseResult.success) {
      return parseResult.response;
    }

    const field = await services.crm.updateCustomField(fieldId, parseResult.data);

    if (!field) {
      throw new NotFoundError("Field", fieldId);
    }

    log.info({ userId: user.id, organizationId: organization.id, fieldId }, "crm:fields:update");
    return c.json({ field });
  }
);

/**
 * DELETE /fields/:fieldId - Delete a custom field
 */
fieldsRouter.delete(
  "/:fieldId",
  protect({ permission: { resource: "crmField", action: "delete" } }),
  async (c) => {
    const user = c.get("authUser");
    const organization = c.get("authOrg");
    const fieldId = c.req.param("fieldId");
    const services = createServicesFromContext(c);

    const deleted = await services.crm.deleteCustomField(fieldId);

    if (!deleted) {
      throw new NotFoundError("Field", fieldId);
    }

    log.info({ userId: user.id, organizationId: organization.id, fieldId }, "crm:fields:delete");
    return c.json({ success: true });
  }
);
