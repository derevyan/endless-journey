/**
 * Organization Schema - Better Auth organization plugin tables
 *
 * Tables for multi-tenant workspaces:
 * - organization: Workspaces
 */

import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

// =============================================================================
// BETTER AUTH ORGANIZATION TABLES
// These tables are managed by Better Auth organization plugin
// =============================================================================

/**
 * Organization - Multi-tenant workspaces (managed by Better Auth)
 */
export const organization = pgTable("organization", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").unique(),
  logo: text("logo"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
