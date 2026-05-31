/**
 * Tags Schema - Global tagging system
 *
 * Tables for tag management:
 * - tagDefinitions: Registry of all tags
 * - clientTags: Tag assignments to clients
 */

import { index, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { organization } from "./organization";
import { clients } from "./session";

// =============================================================================
// TAGS SYSTEM (Global scope only)
// =============================================================================

/**
 * Tag Definitions - Registry of all tags (organization-wide)
 * Tags are assigned to clients and persist across all journeys.
 */
export const tagDefinitions = pgTable(
  "tag_definitions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    color: text("color"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_tag_defs_org").on(table.organizationId),
    unique("tag_defs_unique_org_name").on(table.organizationId, table.name),
  ]
);

/**
 * Client Tags - Assignments of Global Tags to Clients
 */
export const clientTags = pgTable(
  "client_tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tagDefinitions.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("client_tags_unique").on(table.clientId, table.tagId),
    index("idx_client_tags_client").on(table.clientId),
    index("idx_client_tags_tag").on(table.tagId),
  ]
);
