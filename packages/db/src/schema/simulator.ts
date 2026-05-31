/**
 * Simulator Schema - Test persona management
 *
 * Tables for simulator functionality:
 * - testPersonas: Reusable test identities
 */

import { index, jsonb, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { organization } from "./organization";
import { clients } from "./session";

// =============================================================================
// SIMULATOR TEST PERSONAS
// Reusable test identities for simulator sessions
// =============================================================================

/**
 * Test Personas - Reusable test identities for simulator sessions
 * Each persona is tied to an organization and can have a persistent client.
 * Allows running multiple simulations with the same user identity.
 */
export const testPersonas = pgTable(
  "test_personas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(), // "Sales Lead", "VIP Customer"
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
    profile: jsonb("profile")
      .default({})
      .$type<{
        firstName?: string;
        lastName?: string;
        username?: string;
        languageCode?: string;
      }>(),
    userVars: jsonb("user_vars").default({}).$type<Record<string, unknown>>(), // Preset variables (reset target)
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("test_personas_org_name_unique").on(table.organizationId, table.name),
    index("idx_test_personas_org").on(table.organizationId),
  ]
);
