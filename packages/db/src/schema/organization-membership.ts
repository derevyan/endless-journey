/**
 * Organization Membership Schema - Better Auth organization plugin tables
 *
 * Tables for multi-tenant workspaces:
 * - member: Membership links
 * - invitation: Pending invitations
 */

import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { organization } from "./organization";
import { memberRoleEnum, invitationStatusEnum } from "./enums";

// =============================================================================
// BETTER AUTH ORGANIZATION MEMBERSHIP TABLES
// =============================================================================

/**
 * Member - Organization membership (managed by Better Auth)
 * Links users to organizations with roles
 */
export const member = pgTable(
  "member",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    role: memberRoleEnum("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_member_org").on(table.organizationId), index("idx_member_user").on(table.userId)]
);

/**
 * Invitation - Pending organization invitations (managed by Better Auth)
 */
export const invitation = pgTable("invitation", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  role: memberRoleEnum("role").notNull(),
  inviterId: text("inviter_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  status: invitationStatusEnum("status").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
