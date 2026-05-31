/**
 * Variables Schema - Unified key-value storage for all scopes
 *
 * Tables for variables:
 * - variables: Global, journey, and user scoped values
 */

import { index, jsonb, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { variableScopeEnum } from "./enums";
import { organization } from "./organization";

// =============================================================================
// UNIFIED VARIABLES TABLE
// =============================================================================

/**
 * Variables - Unified key-value storage for global, journey, and user scopes
 *
 * scope + ownerId determine the scope:
 * - global: ownerId = organizationId
 * - journey: ownerId = journeyId
 * - user: ownerId = clientId
 */
export const variables = pgTable(
  "variables",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Organization for multi-tenant isolation and org-scoped queries
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    scope: variableScopeEnum("scope").notNull(),
    ownerId: text("owner_id").notNull(),
    key: text("key").notNull(),
    value: jsonb("value").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("variables_org_scope_owner_key_unique").on(table.organizationId, table.scope, table.ownerId, table.key),
    index("idx_variables_org").on(table.organizationId),
    index("idx_variables_scope_owner").on(table.scope, table.ownerId),
  ]
);
