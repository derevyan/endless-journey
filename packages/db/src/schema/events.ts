/**
 * Events Schema - Universal event store and dead letter queue
 *
 * Tables for event management:
 * - events: Universal event storage
 * - failedEvents: Dead letter queue for failed events
 */

import { index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { failedEventStatusEnum } from "./enums";
import { organization } from "./organization";
import { clients, journeySessions } from "./session";
import { journeys } from "./journey";

// =============================================================================
// EVENTS TABLE (Universal Event Store)
// =============================================================================

/**
 * Events - Universal event storage for replay, audit, and debugging
 * Stores ALL events across the system with proper indexing for efficient queries
 */
export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: text("type").notNull(),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
    version: integer("version").notNull().default(1),
    // FK constraints added for referential integrity
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
    sessionId: uuid("session_id").references(() => journeySessions.id, { onDelete: "set null" }),
    journeyId: uuid("journey_id").references(() => journeys.id, { onDelete: "set null" }),
    source: text("source").notNull(),
    performedBy: text("performed_by"),
    sequence: integer("sequence").notNull(),
    correlationId: uuid("correlation_id"),
    causedBy: uuid("caused_by"),
    payload: jsonb("payload").notNull().default({}),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_events_org_sequence").on(table.organizationId, table.sequence),
    index("idx_events_org_type_timestamp").on(table.organizationId, table.type, table.timestamp),
    index("idx_events_session").on(table.sessionId, table.timestamp),
    index("idx_events_client").on(table.clientId, table.timestamp),
    index("idx_events_journey").on(table.journeyId, table.timestamp),
    index("idx_events_created_at").on(table.createdAt),
    index("idx_events_correlation").on(table.correlationId),
  ]
);
// =============================================================================
// FAILED EVENTS (Dead Letter Queue)
// Stores failed event processing for retry and analysis
// =============================================================================

/**
 * Failed Events - Dead Letter Queue for failed event processing
 * Stores events that failed during EventQueue processing for later retry/analysis
 */
export const failedEvents = pgTable(
  "failed_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id").references(() => journeySessions.id, { onDelete: "set null" }),
    journeyId: uuid("journey_id").references(() => journeys.id, { onDelete: "set null" }),
    organizationId: text("organization_id").references(() => organization.id, { onDelete: "cascade" }),

    // Event data
    eventType: text("event_type").notNull(), // 'message' | 'button_click' | 'timeout'
    eventPayload: jsonb("event_payload").notNull(), // Full JourneyEvent payload

    // Context snapshot for debugging
    sessionContext: jsonb("session_context"), // Session context at time of failure
    currentNodeId: text("current_node_id"),

    // Error details
    errorMessage: text("error_message").notNull(),
    errorStack: text("error_stack"),

    // Retry tracking
    retryCount: integer("retry_count").default(0),
    status: failedEventStatusEnum("status").default("pending"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_failed_events_session").on(table.sessionId),
    index("idx_failed_events_org_status").on(table.organizationId, table.status),
    index("idx_failed_events_created").on(table.createdAt),
  ]
);
