/**
 * Journey Transfers Schema - Audit log for journey-to-journey transfers
 *
 * Tables for transfer tracking:
 * - journeyTransfers: Audit log for journey transfers
 */

import { boolean, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { journeys } from "./journey";
import { organization } from "./organization";
import { clients, journeySessions } from "./session";
import { transferTriggerEnum } from "./enums";

// =============================================================================
// JOURNEY TRANSFERS AUDIT LOG
// =============================================================================

/**
 * Journey Transfers - Audit log for journey-to-journey transfers
 * Tracks all transfer attempts (success and failure) for debugging and analytics
 */
export const journeyTransfers = pgTable(
  "journey_transfers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Organization for multi-tenant filtering and analytics
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    fromJourneyId: uuid("from_journey_id")
      .notNull()
      .references(() => journeys.id, { onDelete: "cascade" }),
    toJourneyId: uuid("to_journey_id")
      .notNull()
      .references(() => journeys.id, { onDelete: "cascade" }),
    // Session references with FK constraints (set null on session delete to preserve audit log)
    fromSessionId: uuid("from_session_id").references(() => journeySessions.id, { onDelete: "set null" }),
    toSessionId: uuid("to_session_id").references(() => journeySessions.id, { onDelete: "set null" }),
    triggeredBy: transferTriggerEnum("triggered_by").notNull(),
    success: boolean("success").notNull(),
    errorMessage: text("error_message"), // Error details if failed
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_journey_transfers_org").on(table.organizationId),
    index("idx_journey_transfers_client").on(table.clientId),
    index("idx_journey_transfers_from").on(table.fromJourneyId),
    index("idx_journey_transfers_to").on(table.toJourneyId),
    index("idx_journey_transfers_created").on(table.createdAt),
    // Composite indexes for common query patterns
    index("idx_journey_transfers_from_to").on(table.fromJourneyId, table.toJourneyId),
    index("idx_journey_transfers_sessions").on(table.fromSessionId, table.toSessionId),
  ]
);
