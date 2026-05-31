/**
 * Session Schema - Client sessions and interactions
 *
 * Tables for runtime session management:
 * - clients: End users who interact with channels
 * - journeySessions: Active journey sessions
 * - interactions: Event sourcing log
 * - sentMessages: Message tracking
 * - agentConversations: AI agent conversation history
 */

import type { AgentState } from "@journey/schemas";
import { boolean, index, jsonb, pgTable, text, timestamp, unique, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { journeys } from "./journey";
import { messagingChannels } from "./channels";
import { organization } from "./organization";
import { platformEnum, sessionStatusEnum, sessionModeEnum, messageTypeEnum } from "./enums";

// =============================================================================
// CLIENTS & JOURNEY SESSIONS
// Multi-channel support for Telegram, WhatsApp, and future platforms
// =============================================================================

/**
 * Clients - End users who interact with messaging channels
 * Different from app users (auth users) who manage journeys
 */
export const clients = pgTable(
  "clients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    platform: platformEnum("platform").notNull().default("telegram"),
    platformUserId: text("platform_user_id").notNull(), // Platform-specific user ID
    // Organization scoping - same platform user in different orgs = different client records
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    firstName: text("first_name"),
    lastName: text("last_name"),
    username: text("username"),
    metadata: jsonb("metadata"), // Other preferences
    isTest: boolean("is_test").default(false), // True for simulator/test clients - easy filtering from analytics
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Ensure unique user per platform per organization
    uniqueIndex("idx_clients_platform_user_org").on(table.platform, table.platformUserId, table.organizationId),
    index("idx_clients_org").on(table.organizationId),
  ]
);

/**
 * Journey Sessions - Active journey sessions for clients
 * Tracks user progress through a journey
 */
export const journeySessions = pgTable(
  "journey_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    channelId: uuid("channel_id").references(() => messagingChannels.id, { onDelete: "cascade" }), // Nullable for simulator sessions
    journeyId: uuid("journey_id")
      .notNull()
      .references(() => journeys.id, { onDelete: "cascade" }),
    // Denormalized org ID for efficient filtering without joins
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    currentNodeId: text("current_node_id").notNull(),
    status: sessionStatusEnum("status").notNull().default("active"),
    mode: sessionModeEnum("mode").notNull().default("live"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_journey_sessions_journey").on(table.journeyId),
    index("idx_journey_sessions_client").on(table.clientId),
    index("idx_journey_sessions_channel").on(table.channelId),
    index("idx_journey_sessions_status").on(table.status),
    index("idx_journey_sessions_mode").on(table.mode), // Index for filtering by session mode
    index("idx_journey_sessions_org").on(table.organizationId), // Index for org-level queries
    // Compound index for querying sessions by status and last update time
    index("idx_journey_sessions_status_updated").on(table.status, table.updatedAt),
    // Composite index for user activity timeline: lookup by client_id with updated_at
    // Note: Renamed from _desc - Drizzle .on() creates ASC indexes; use ORDER BY for DESC queries
    index("idx_journey_sessions_client_updated").on(table.clientId, table.updatedAt),
  ]
);

/**
 * Interactions - Event sourcing log for analytics and conversation history
 * Single source of truth for all session events including conversation messages.
 * Descending timestamp index optimizes cache recovery (recent-first queries).
 */
export const interactions = pgTable(
  "interactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => journeySessions.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // 'user.click', 'system.message', etc.
    nodeId: text("node_id").notNull(),
    payload: jsonb("payload").notNull(), // Event-specific data
    metadata: jsonb("metadata"), // Debug info, adapter type
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_interactions_session_time").on(table.sessionId, table.timestamp),
    // Descending index for cache recovery (recent-first queries)
    // Created via raw migration: CREATE INDEX idx_interactions_session_time_desc
    // ON interactions (session_id, timestamp DESC);
  ]
);

/**
 * Sent Messages - Tracks all messages sent during journey execution
 * Stores platform message IDs for edit/delete and reply threading capabilities
 */
export const sentMessages = pgTable(
  "sent_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => journeySessions.id, { onDelete: "cascade" }),
    nodeId: text("node_id").notNull(), // Journey node that triggered the message
    // Direct reference to interaction event for 1:1 message correlation
    interactionEventId: uuid("interaction_event_id")
      .notNull()
      .references(() => interactions.id, { onDelete: "cascade" }),
    platform: platformEnum("platform").notNull(),
    platformMessageId: text("platform_message_id"), // Telegram message_id
    platformChatId: text("platform_chat_id").notNull(), // Telegram chat_id
    messageType: messageTypeEnum("message_type").notNull(),
    content: text("content"), // Message text/caption (for debugging)
    replyToMessageId: text("reply_to_message_id"), // For threading - reference to another sent message
    metadata: jsonb("metadata"), // Additional platform-specific data
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
    editedAt: timestamp("edited_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_sent_messages_session").on(table.sessionId),
    index("idx_sent_messages_platform_msg").on(table.platform, table.platformMessageId),
    // NEW: Index for interaction event lookups
    index("idx_sent_messages_interaction_event").on(table.interactionEventId),
    // NEW: Unique constraint ensuring 1:1 relationship
    uniqueIndex("idx_sent_messages_interaction_unique").on(table.interactionEventId),
  ]
);

/**
 * Node Outputs - Persists node execution outputs for session recovery
 * Stores outputs from webhook, condition, CRM handlers and handler state
 * Critical for recovering stateful handlers (Agent, Questionnaire) after cache expiry
 */
export const nodeOutputs = pgTable(
  "node_outputs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => journeySessions.id, { onDelete: "cascade" }),
    // Sanitized label is the key used in session.nodeOutputs (e.g., "Get_Customer")
    sanitizedLabel: text("sanitized_label").notNull(),
    nodeId: text("node_id").notNull(),
    nodeLabel: text("node_label"), // Original label for display
    nodeType: text("node_type"), // e.g., "webhook", "condition", "agent"
    // The actual output data - matches NodeOutput type from engine
    data: jsonb("data").$type<Record<string, unknown>>().notNull(),
    executedAt: timestamp("executed_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Only one output per session per sanitized label
    unique("node_outputs_session_label_unique").on(table.sessionId, table.sanitizedLabel),
    index("idx_node_outputs_session").on(table.sessionId),
    index("idx_node_outputs_updated").on(table.updatedAt),
  ]
);

