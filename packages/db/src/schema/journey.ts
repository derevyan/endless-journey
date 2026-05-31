/**
 * Journey Schema - Journey builder core tables
 *
 * Tables for journey management:
 * - journeys: Journey blueprints
 * - journeyVersions: Version history
 * - journeyMedia: Uploaded media files
 */

import type { JourneyConfig, JourneyMindstateConfig } from "@journey/schemas";
import { relations } from "drizzle-orm";
import { bigint, index, jsonb, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { crmPipelines } from "./crm";
import { organization } from "./organization";
import { journeyStatusEnum, mediaTypeEnum } from "./enums";

// =============================================================================
// JOURNEY BUILDER TABLES
// =============================================================================

/**
 * Journeys - The journey blueprints/templates
 * Owned by organizations, created by users
 */
export const journeys = pgTable(
  "journeys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").unique(), // URL-friendly identifier (e.g., "saas-onboarding")
    name: text("name").notNull(),
    description: text("description"),
    status: journeyStatusEnum("status").notNull().default("draft"),
    configuration: jsonb("configuration").$type<JourneyConfig>().notNull(),
    // Organization that owns this journey (required for multi-tenancy)
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    // Optional mindstate tracking configuration
    mindstateConfig: jsonb("mindstate_config").$type<JourneyMindstateConfig>(),
    // Allowlist of journey IDs users can be transferred to (empty/null = no transfers allowed)
    transferAllowlist: jsonb("transfer_allowlist").$type<string[]>(),
    // Default CRM pipeline for clients entering this journey
    defaultPipelineId: uuid("default_pipeline_id").references(() => crmPipelines.id, { onDelete: "set null" }),
    // User who created/last modified this journey (for tracking)
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_journeys_org").on(table.organizationId),
    index("idx_journeys_pipeline").on(table.defaultPipelineId),
  ]
);

/**
 * Journey Versions - Version history for journey configurations
 * Stores snapshots of journey state for restore/audit purposes
 */
export const journeyVersions = pgTable(
  "journey_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    journeyId: uuid("journey_id")
      .notNull()
      .references(() => journeys.id, { onDelete: "cascade" }),
    versionId: text("version_id").notNull(), // "v001", "v002", etc.
    notes: text("notes"),
    configuration: jsonb("configuration").$type<JourneyConfig>().notNull(),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_journey_versions_journey").on(table.journeyId),
    unique("unq_journey_version").on(table.journeyId, table.versionId),
  ]
);

export const journeyVersionsRelations = relations(journeyVersions, ({ one }) => ({
  journey: one(journeys, {
    fields: [journeyVersions.journeyId],
    references: [journeys.id],
  }),
  creator: one(user, {
    fields: [journeyVersions.createdBy],
    references: [user.id],
  }),
}));

// =============================================================================
// MEDIA LIBRARY
// =============================================================================

/**
 * Journey Media - Uploaded media files (images/videos) scoped to journeys
 * Each journey has its own media gallery
 */
export const journeyMedia = pgTable(
  "journey_media",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    journeyId: uuid("journey_id")
      .notNull()
      .references(() => journeys.id, { onDelete: "cascade" }),
    uploadedBy: text("uploaded_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: mediaTypeEnum("type").notNull(),
    url: text("url").notNull(),
    filename: text("filename").notNull(),
    key: text("key").notNull(), // S3/MinIO key for deletion
    size: bigint("size", { mode: "number" }), // File size in bytes
    mimeType: text("mime_type"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_journey_media_journey").on(table.journeyId)]
);
