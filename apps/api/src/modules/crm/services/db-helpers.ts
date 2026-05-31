/**
 * CRM Database Helpers
 *
 * Reusable database query patterns for CRM services.
 * Provides organization-scoped entity lookups to reduce duplication.
 *
 * @module modules/crm/services/db-helpers
 */

import type { DbClient } from "@journey/db";
import { BadRequestError } from "@journey/schemas";
import type { Column, SQL, Table } from "drizzle-orm";
import { and, eq, inArray, sql } from "drizzle-orm";

/**
 * Get an entity by ID within an organization scope.
 *
 * @example
 * ```ts
 * const pipeline = await getEntityById(
 *   crmPipelines,
 *   crmPipelines.id,
 *   crmPipelines.organizationId,
 *   pipelineId,
 *   organizationId
 * );
 * ```
 */
export async function getEntityById<T>(
  db: DbClient,
  table: Table,
  idColumn: Column,
  orgColumn: Column,
  id: string,
  organizationId: string
): Promise<T | null> {
  const [entity] = await db
    .select()
    .from(table)
    .where(and(eq(idColumn, id), eq(orgColumn, organizationId)))
    .limit(1);
  return (entity as T) ?? null;
}

/**
 * Check if an entity exists within an organization scope.
 *
 * @example
 * ```ts
 * const exists = await entityExistsInOrg(
 *   crmPipelines,
 *   crmPipelines.id,
 *   crmPipelines.organizationId,
 *   pipelineId,
 *   organizationId
 * );
 * ```
 */
export async function entityExistsInOrg(
  db: DbClient,
  table: Table,
  idColumn: Column,
  orgColumn: Column,
  id: string,
  organizationId: string
): Promise<boolean> {
  const results = await db
    .select()
    .from(table)
    .where(and(eq(idColumn, id), eq(orgColumn, organizationId)))
    .limit(1);
  return results.length > 0;
}

/**
 * Get an entity by a unique field within an organization scope.
 * Useful for lookups by slug, name, or other unique identifiers.
 *
 * @example
 * ```ts
 * const pipeline = await getEntityByField(
 *   crmPipelines,
 *   crmPipelines.slug,
 *   slug,
 *   crmPipelines.organizationId,
 *   organizationId
 * );
 * ```
 */
export async function getEntityByField<T>(
  db: DbClient,
  table: Table,
  fieldColumn: Column,
  fieldValue: string,
  orgColumn: Column,
  organizationId: string
): Promise<T | null> {
  const [entity] = await db
    .select()
    .from(table)
    .where(and(eq(fieldColumn, fieldValue), eq(orgColumn, organizationId)))
    .limit(1);
  return (entity as T) ?? null;
}

/**
 * Get the next position for an ordered entity.
 */
export async function getNextPosition(
  db: DbClient,
  table: Table,
  positionColumn: Column,
  whereClause?: SQL
): Promise<number> {
  const baseQuery = db
    .select({ maxPosition: sql<number>`COALESCE(MAX(${positionColumn}), -1)::int` })
    .from(table);

  const results = whereClause ? await baseQuery.where(whereClause) : await baseQuery;
  const maxPosition = results[0]?.maxPosition ?? -1;
  return maxPosition + 1;
}

/**
 * Ensure a list of IDs is unique.
 */
export function assertUniqueIds(ids: string[], entityLabel: string): string[] {
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length !== ids.length) {
    throw new BadRequestError(`${entityLabel} reorder list contains duplicate IDs.`);
  }
  return uniqueIds;
}

/**
 * Validate that all IDs belong to the organization (and optional extra scope).
 */
export async function assertIdsBelongToOrg(
  db: DbClient,
  table: Table,
  idColumn: Column,
  orgColumn: Column,
  ids: string[],
  organizationId: string,
  entityLabel: string,
  extraWhere?: SQL
): Promise<void> {
  if (ids.length === 0) return;

  const conditions = [eq(orgColumn, organizationId), inArray(idColumn, ids)];
  if (extraWhere) {
    conditions.push(extraWhere);
  }

  const results = await db
    .select()
    .from(table)
    .where(and(...conditions));

  if (results.length !== ids.length) {
    throw new BadRequestError(`${entityLabel} IDs must belong to the specified scope.`);
  }
}

/**
 * Reorder entities by ID using the provided update function.
 */
export async function reorderByIds(
  ids: string[],
  updateFn: (id: string, position: number) => Promise<void>
): Promise<void> {
  for (let i = 0; i < ids.length; i++) {
    await updateFn(ids[i], i);
  }
}
