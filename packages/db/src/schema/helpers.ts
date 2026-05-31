/**
 * Schema Column Helpers
 *
 * Reusable column patterns to ensure consistency across schema definitions.
 * These helpers enforce the conventions documented in docs/db/schema-conventions.md.
 *
 * @example
 * ```typescript
 * import { timestamps, orgIdColumn } from "./helpers";
 *
 * export const myTable = pgTable("my_table", {
 *   id: uuid("id").primaryKey().defaultRandom(),
 *   ...timestamps,
 *   organizationId: orgIdColumn(),
 * });
 * ```
 */

import { text, timestamp } from "drizzle-orm/pg-core";
import { organization } from "./organization";

// =============================================================================
// TIMESTAMP HELPERS
// =============================================================================

/**
 * Standard timestamp columns for all tables.
 * All timestamps use timezone and are NOT NULL with defaultNow().
 *
 * IMPORTANT: Both createdAt and updatedAt MUST use .notNull().defaultNow()
 * per docs/db/schema-conventions.md to ensure data integrity.
 */
export const timestamps = {
  /** Creation timestamp - set once, never updated */
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),

  /** Last modification timestamp - application must update on changes */
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

/**
 * Optional soft delete timestamp column.
 * Use with partial unique indexes for key reuse after deletion.
 *
 * @example
 * ```typescript
 * export const myTable = pgTable("my_table", {
 *   ...timestamps,
 *   deletedAt: softDeleteColumn(),
 * }, (table) => [
 *   uniqueIndex("unq_my_table_org_key")
 *     .on(table.organizationId, table.key)
 *     .where(sql`deleted_at IS NULL`),
 * ]);
 * ```
 */
export const softDeleteColumn = () => timestamp("deleted_at", { withTimezone: true });

// =============================================================================
// ORGANIZATION SCOPING HELPERS
// =============================================================================

/**
 * Standard organization ID column with cascade delete.
 * Use for tables that are directly scoped to an organization.
 *
 * @example
 * ```typescript
 * export const myTable = pgTable("my_table", {
 *   organizationId: orgIdColumn(),
 * });
 * ```
 */
export const orgIdColumn = () =>
  text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" });

// =============================================================================
// USER REFERENCE HELPERS
// =============================================================================

// Note: User reference helpers are not included here because they would
// create a circular dependency with auth.ts. Import user directly when needed:
//
// ```typescript
// import { user } from "./auth";
// createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
// ```
