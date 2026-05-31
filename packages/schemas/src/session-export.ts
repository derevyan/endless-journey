/**
 * Session Export Schema
 *
 * Portable session export format for offline replay and sharing.
 * Contains everything needed to reconstruct a session in the browser.
 *
 * Design principles:
 * - Self-contained (no DB lookups needed during replay)
 * - Portable (can be shared, backed up, analyzed offline)
 * - Versioned (exportVersion allows future schema evolution)
 * - Maps cleanly to EnhancedUserJourney for playback
 *
 * @module schemas/session-export
 */

import { z } from "zod";
import { InteractionEventSchema } from "./events/core";
import { NodeOutputSchema } from "./session";
import { JourneyConfigSchema } from "./journey";

/**
 * Session Export Schema - Complete snapshot of a user journey session
 * for offline replay and sharing.
 */
export const SessionExportSchema = z.object({
  // === METADATA ===
  /** Schema version for future compatibility */
  exportVersion: z.literal("1.0"),
  /** When this export was created */
  exportedAt: z.string().datetime(),

  // === JOURNEY CONTEXT ===
  /** Journey information for context and UI display */
  journey: z.object({
    id: z.string().uuid(),
    slug: z.string().min(1, "Journey slug is required"),
    name: z.string().min(1, "Journey name is required"),
  }),

  // === USER CONTEXT ===
  /** User information for displaying who this session belongs to */
  user: z.object({
    id: z.string().min(1, "User ID is required"),
    platformUserId: z.string().min(1, "Platform user ID is required"),
    displayName: z.string().min(1, "Display name is required"),
    firstName: z.string().nullable().optional(),
    lastName: z.string().nullable().optional(),
    username: z.string().nullable().optional(),
  }),

  // === SESSION STATE SNAPSHOT ===
  /** Session state at the time of export */
  session: z.object({
    id: z.string().uuid(),
    status: z.enum(["active", "completed", "dropped", "paused", "error"]),
    currentNodeId: z.string().min(1, "Current node ID is required"),
    context: z.record(z.string(), z.unknown()).default({}),
    tags: z.array(z.string()).default([]),
    nodeOutputs: z.record(z.string(), NodeOutputSchema).default({}),
    startedAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    completedAt: z.string().datetime().nullable(),
  }),

  // === EVENT LOG ===
  /** Complete interaction history for replay */
  interactions: z.array(InteractionEventSchema),

  // === OPTIONAL: JOURNEY DEFINITION ===
  /** Journey configuration for self-contained offline replay
   * Optional to maintain backward compatibility with older exports */
  journeyDefinition: JourneyConfigSchema.optional(),

  // === OPTIONAL: PLATFORM MESSAGE CORRELATION ===
  /** Telegram/WhatsApp message IDs for debugging and message operations
   * Correlates interaction events with platform message records */
  platformMessages: z
    .array(
      z.object({
        interactionEventId: z.string().uuid(),
        platformMessageId: z.string(),
        platformChatId: z.string(),
        messageType: z.string(),
        sentAt: z.string().datetime(),
      })
    )
    .optional(),

  // === OPTIONAL: SESSION CONTEXT ===
  /** Additional session context for analysis and debugging */
  sessionContext: z
    .object({
      organizationId: z.string().uuid(),
      channelId: z.string().uuid().nullable(),
      mode: z.enum(["live", "test", "simulation"]),
      platform: z.enum(["telegram", "whatsapp", "simulator"]).nullable(),
      channelName: z.string().optional(),
    })
    .optional(),
});

export type SessionExport = z.infer<typeof SessionExportSchema>;

/**
 * Validation result type for session JSON loading
 */
export type SessionExportValidationResult =
  | { success: true; data: SessionExport }
  | { success: false; error: string };
