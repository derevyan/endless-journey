/**
 * CRM Custom Field Service
 *
 * CRUD operations for custom field definitions and values.
 *
 * @module modules/crm/services/field-service
 */

import { crmCustomFieldDefinitions, crmClientFieldValues, clients } from "@journey/db/schema";
import { createLogger, serializeError } from "@journey/logger";
import { BadRequestError, NotFoundError } from "@journey/schemas";
import type {
  ClientFieldValue,
  CreateFieldInput,
  CustomFieldDefinition,
  UpdateFieldInput,
} from "@journey/schemas";
import { and, eq, asc, inArray } from "drizzle-orm";

import { assertIdsBelongToOrg, assertUniqueIds, getNextPosition, reorderByIds } from "./db-helpers";
import type { CrmServiceContext } from "./service-context";

const log = createLogger("crm-field-service");

// =============================================================================
// FIELD DEFINITIONS CRUD
// =============================================================================

/**
 * Get all custom field definitions for an organization
 */
export async function getCustomFields(ctx: CrmServiceContext): Promise<CustomFieldDefinition[]> {
  const { db, organizationId } = ctx;
  try {
    const fields = await db
      .select()
      .from(crmCustomFieldDefinitions)
      .where(eq(crmCustomFieldDefinitions.organizationId, organizationId))
      .orderBy(asc(crmCustomFieldDefinitions.position));

    log.debug({ organizationId, count: fields.length }, "crmFieldService:getCustomFields");
    return fields as CustomFieldDefinition[];
  } catch (error) {
    log.error({ organizationId, err: serializeError(error) }, "crmFieldService:getCustomFields:error");
    throw error;
  }
}

/**
 * Get a single custom field definition
 */
export async function getCustomFieldById(
  ctx: CrmServiceContext,
  fieldId: string
): Promise<CustomFieldDefinition | null> {
  const { db, organizationId } = ctx;
  try {
    const [field] = await db
      .select()
      .from(crmCustomFieldDefinitions)
      .where(
        and(
          eq(crmCustomFieldDefinitions.id, fieldId),
          eq(crmCustomFieldDefinitions.organizationId, organizationId)
        )
      )
      .limit(1);

    return (field as CustomFieldDefinition) || null;
  } catch (error) {
    log.error({ fieldId, organizationId, err: serializeError(error) }, "crmFieldService:getCustomFieldById:error");
    throw error;
  }
}

/**
 * Create a new custom field definition
 */
export async function createCustomField(
  ctx: CrmServiceContext,
  data: CreateFieldInput
): Promise<CustomFieldDefinition> {
  const { db, organizationId } = ctx;
  try {
    const nextPosition = await getNextPosition(
      db,
      crmCustomFieldDefinitions,
      crmCustomFieldDefinitions.position,
      eq(crmCustomFieldDefinitions.organizationId, organizationId)
    );

    // Validate key format (snake_case)
    const keyRegex = /^[a-z][a-z0-9_]*$/;
    if (!keyRegex.test(data.key)) {
      throw new BadRequestError("Field key must be lowercase letters, numbers, and underscores, starting with a letter");
    }

    const [field] = await db
      .insert(crmCustomFieldDefinitions)
      .values({
        organizationId,
        name: data.name,
        key: data.key,
        fieldType: data.fieldType,
        description: data.description || null,
        isRequired: data.isRequired || false,
        position: nextPosition,
        validation: data.validation || null,
        defaultValue: data.defaultValue || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    log.info({ organizationId, fieldId: field.id, key: data.key }, "crmFieldService:createCustomField");
    return field as CustomFieldDefinition;
  } catch (error) {
    log.error({ organizationId, data, err: serializeError(error) }, "crmFieldService:createCustomField:error");
    throw error;
  }
}

/**
 * Update a custom field definition
 */
export async function updateCustomField(
  ctx: CrmServiceContext,
  fieldId: string,
  data: UpdateFieldInput
): Promise<CustomFieldDefinition | null> {
  const { db, organizationId } = ctx;
  try {
    const [field] = await db
      .update(crmCustomFieldDefinitions)
      .set({
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.isRequired !== undefined && { isRequired: data.isRequired }),
        ...(data.validation !== undefined && { validation: data.validation }),
        ...(data.defaultValue !== undefined && { defaultValue: data.defaultValue }),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(crmCustomFieldDefinitions.id, fieldId),
          eq(crmCustomFieldDefinitions.organizationId, organizationId)
        )
      )
      .returning();

    if (field) {
      log.info({ fieldId, organizationId }, "crmFieldService:updateCustomField");
    }
    return (field as CustomFieldDefinition) || null;
  } catch (error) {
    log.error({ fieldId, organizationId, data, err: serializeError(error) }, "crmFieldService:updateCustomField:error");
    throw error;
  }
}

/**
 * Delete a custom field definition
 */
export async function deleteCustomField(
  ctx: CrmServiceContext,
  fieldId: string
): Promise<boolean> {
  const { db, organizationId } = ctx;
  try {
    const result = await db
      .delete(crmCustomFieldDefinitions)
      .where(
        and(
          eq(crmCustomFieldDefinitions.id, fieldId),
          eq(crmCustomFieldDefinitions.organizationId, organizationId)
        )
      )
      .returning({ id: crmCustomFieldDefinitions.id });

    const deleted = result.length > 0;
    if (deleted) {
      log.info({ fieldId, organizationId }, "crmFieldService:deleteCustomField");
    }
    return deleted;
  } catch (error) {
    log.error({ fieldId, organizationId, err: serializeError(error) }, "crmFieldService:deleteCustomField:error");
    throw error;
  }
}

/**
 * Reorder custom fields
 */
export async function reorderCustomFields(
  ctx: CrmServiceContext,
  fieldIds: string[]
): Promise<void> {
  const { db, organizationId } = ctx;
  try {
    const uniqueIds = assertUniqueIds(fieldIds, "Field");
    await assertIdsBelongToOrg(
      db,
      crmCustomFieldDefinitions,
      crmCustomFieldDefinitions.id,
      crmCustomFieldDefinitions.organizationId,
      uniqueIds,
      organizationId,
      "Field"
    );

    await reorderByIds(uniqueIds, async (id, position) => {
      await db
        .update(crmCustomFieldDefinitions)
        .set({ position, updatedAt: new Date() })
        .where(
          and(
            eq(crmCustomFieldDefinitions.id, id),
            eq(crmCustomFieldDefinitions.organizationId, organizationId)
          )
        );
    });

    log.info({ organizationId, fieldCount: uniqueIds.length }, "crmFieldService:reorderCustomFields");
  } catch (error) {
    log.error({ organizationId, fieldIds, err: serializeError(error) }, "crmFieldService:reorderCustomFields:error");
    throw error;
  }
}

// =============================================================================
// CLIENT FIELD VALUES
// =============================================================================

/**
 * Get all custom field values for a client
 */
export async function getClientFieldValues(
  ctx: CrmServiceContext,
  clientId: string
): Promise<ClientFieldValue[]> {
  const { db, organizationId } = ctx;
  try {
    // Get all field definitions for the org
    const fieldDefs = await getCustomFields(ctx);

    // Get existing values
    const existingValues = await db
      .select({
        fieldId: crmClientFieldValues.fieldId,
        value: crmClientFieldValues.value,
        updatedAt: crmClientFieldValues.updatedAt,
      })
      .from(crmClientFieldValues)
      .innerJoin(
        crmCustomFieldDefinitions,
        eq(crmCustomFieldDefinitions.id, crmClientFieldValues.fieldId)
      )
      .where(
        and(
          eq(crmClientFieldValues.clientId, clientId),
          eq(crmCustomFieldDefinitions.organizationId, organizationId)
        )
      );

    // Build map of existing values
    const valueMap = new Map<string, { value: unknown; updatedAt: Date | null }>();
    for (const v of existingValues) {
      valueMap.set(v.fieldId, { value: v.value, updatedAt: v.updatedAt });
    }

    // Return all fields with their values (or default/null)
    return fieldDefs.map((field) => {
      const existing = valueMap.get(field.id);
      return {
        fieldId: field.id,
        fieldKey: field.key,
        fieldName: field.name,
        fieldType: field.fieldType,
        value: existing?.value ?? field.defaultValue ?? null,
        updatedAt: existing?.updatedAt || null,
      };
    });
  } catch (error) {
    log.error({ clientId, organizationId, err: serializeError(error) }, "crmFieldService:getClientFieldValues:error");
    throw error;
  }
}

/**
 * Update client's custom field values
 */
export async function updateClientFieldValues(
  ctx: CrmServiceContext,
  clientId: string,
  values: Array<{ fieldId: string; value: unknown }>,
  updatedBy: string
): Promise<void> {
  const { db, organizationId, publisher } = ctx;
  // Early return if no values to update
  if (!values || values.length === 0) {
    return;
  }

  try {
    // Verify client exists
    const [client] = await db
      .select({ id: clients.id })
      .from(clients)
      .where(eq(clients.id, clientId))
      .limit(1);

    if (!client) {
      throw new NotFoundError("Client", clientId);
    }

    // Verify all fields belong to organization and get field metadata
    const fieldIds = values.map((v) => v.fieldId);
    const validFields = await db
      .select({
        id: crmCustomFieldDefinitions.id,
        key: crmCustomFieldDefinitions.key,
        name: crmCustomFieldDefinitions.name,
      })
      .from(crmCustomFieldDefinitions)
      .where(
        and(
          eq(crmCustomFieldDefinitions.organizationId, organizationId),
          inArray(crmCustomFieldDefinitions.id, fieldIds)
        )
      );

    const validFieldIds = new Set(validFields.map((f) => f.id));
    const fieldMetaMap = new Map(validFields.map((f) => [f.id, { key: f.key, name: f.name }]));

    // Get existing values for event publishing
    const existingValues = await db
      .select({
        fieldId: crmClientFieldValues.fieldId,
        value: crmClientFieldValues.value,
      })
      .from(crmClientFieldValues)
      .where(
        and(
          eq(crmClientFieldValues.clientId, clientId),
          inArray(crmClientFieldValues.fieldId, fieldIds)
        )
      );
    const existingValueMap = new Map(existingValues.map((v) => [v.fieldId, v.value]));

    for (const { fieldId, value } of values) {
      if (!validFieldIds.has(fieldId)) {
        throw new NotFoundError("CustomField", fieldId);
      }

      // Upsert the value
      await db
        .insert(crmClientFieldValues)
        .values({
          clientId,
          fieldId,
          value,
          updatedBy,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [crmClientFieldValues.clientId, crmClientFieldValues.fieldId],
          set: {
            value,
            updatedBy,
            updatedAt: new Date(),
          },
        });
    }

    // Publish CRM events for each field update - stored in events table, queried via /api/events/crm
    const eventContext = {
      organizationId,
      clientId,
      performedBy: updatedBy,
      triggeredBy: "manual" as const,
    };

    for (const { fieldId, value } of values) {
      const fieldMeta = fieldMetaMap.get(fieldId);
      if (fieldMeta) {
        await publisher.crm.fieldUpdated(eventContext, {
          fieldId,
          fieldKey: fieldMeta.key,
          fieldName: fieldMeta.name,
          previousValue: existingValueMap.get(fieldId) ?? null,
          newValue: value,
        });
      }
    }

    log.info({ clientId, organizationId, fieldCount: values.length }, "crmFieldService:updateClientFieldValues");
  } catch (error) {
    log.error({ clientId, organizationId, err: serializeError(error) }, "crmFieldService:updateClientFieldValues:error");
    throw error;
  }
}

/**
 * Validate a field value against its definition
 */
export function validateFieldValue(
  fieldDef: CustomFieldDefinition,
  value: unknown
): { valid: boolean; error?: string } {
  const { fieldType, validation, isRequired } = fieldDef;

  // Check required
  if (isRequired && (value === null || value === undefined || value === "")) {
    return { valid: false, error: `${fieldDef.name} is required` };
  }

  // Skip validation if value is empty and not required
  if (value === null || value === undefined || value === "") {
    return { valid: true };
  }

  switch (fieldType) {
    case "text": {
      if (typeof value !== "string") {
        return { valid: false, error: `${fieldDef.name} must be a string` };
      }
      if (validation?.minLength && value.length < validation.minLength) {
        return { valid: false, error: `${fieldDef.name} must be at least ${validation.minLength} characters` };
      }
      if (validation?.maxLength && value.length > validation.maxLength) {
        return { valid: false, error: `${fieldDef.name} must be at most ${validation.maxLength} characters` };
      }
      if (validation?.pattern && !new RegExp(validation.pattern).test(value)) {
        return { valid: false, error: `${fieldDef.name} format is invalid` };
      }
      break;
    }
    case "number": {
      const num = typeof value === "number" ? value : Number(value);
      if (isNaN(num)) {
        return { valid: false, error: `${fieldDef.name} must be a number` };
      }
      if (validation?.min !== undefined && num < validation.min) {
        return { valid: false, error: `${fieldDef.name} must be at least ${validation.min}` };
      }
      if (validation?.max !== undefined && num > validation.max) {
        return { valid: false, error: `${fieldDef.name} must be at most ${validation.max}` };
      }
      break;
    }
    case "date": {
      const date = new Date(value as string);
      if (isNaN(date.getTime())) {
        return { valid: false, error: `${fieldDef.name} must be a valid date` };
      }
      break;
    }
    case "select": {
      if (!validation?.options) {
        return { valid: true };
      }
      const validValues = validation.options.map((o) => o.value);
      if (!validValues.includes(value as string)) {
        return { valid: false, error: `${fieldDef.name} must be one of: ${validValues.join(", ")}` };
      }
      break;
    }
    case "multi_select": {
      if (!Array.isArray(value)) {
        return { valid: false, error: `${fieldDef.name} must be an array` };
      }
      if (!validation?.options) {
        return { valid: true };
      }
      const validValues = validation.options.map((o) => o.value);
      for (const v of value) {
        if (!validValues.includes(v as string)) {
          return { valid: false, error: `${fieldDef.name} contains invalid value: ${v}` };
        }
      }
      break;
    }
  }

  return { valid: true };
}
