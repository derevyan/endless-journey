/**
 * Journey Event Payloads
 *
 * Payload schemas for journey lifecycle events.
 *
 * @module schemas/events/payloads/journey
 */

import { z } from "zod";

// =============================================================================
// JOURNEY CRUD EVENTS
// =============================================================================

/**
 * Payload for journey.created event
 * Emitted when a new journey is created
 */
export const JourneyCreatedPayloadSchema = z.object({
  journeyId: z.string(),
  journeyName: z.string(),
  slug: z.string(),
  createdBy: z.string(),
});

export type JourneyCreatedPayload = z.infer<typeof JourneyCreatedPayloadSchema>;

/**
 * Payload for journey.updated event
 * Emitted when journey configuration is updated
 */
export const JourneyUpdatedPayloadSchema = z.object({
  journeyId: z.string(),
  journeyName: z.string(),
  changes: z.record(z.string(), z.unknown()),
  updatedBy: z.string(),
});

export type JourneyUpdatedPayload = z.infer<typeof JourneyUpdatedPayloadSchema>;

/**
 * Payload for journey.deleted event
 * Emitted when a journey is deleted
 */
export const JourneyDeletedPayloadSchema = z.object({
  journeyId: z.string(),
  journeyName: z.string(),
  slug: z.string(),
  deletedBy: z.string(),
});

export type JourneyDeletedPayload = z.infer<typeof JourneyDeletedPayloadSchema>;

/**
 * Payload for journey.activated event
 * Emitted when a journey is activated
 */
export const JourneyActivatedPayloadSchema = z.object({
  journeyId: z.string(),
  journeyName: z.string(),
  activatedBy: z.string(),
});

export type JourneyActivatedPayload = z.infer<typeof JourneyActivatedPayloadSchema>;

/**
 * Payload for journey.deactivated event
 * Emitted when a journey is deactivated
 */
export const JourneyDeactivatedPayloadSchema = z.object({
  journeyId: z.string(),
  journeyName: z.string(),
  mode: z.enum(["pause", "terminate", "complete"]),
  sessionsAffected: z.number(),
  deactivatedBy: z.string(),
});

export type JourneyDeactivatedPayload = z.infer<typeof JourneyDeactivatedPayloadSchema>;

// =============================================================================
// SESSION LIFECYCLE EVENTS
// =============================================================================

/**
 * Payload for journey.session.started event
 * Emitted when a new journey session is created and started
 */
export const JourneySessionStartedPayloadSchema = z.object({
  sessionId: z.string(),
  journeyName: z.string().optional(),
  startNodeId: z.string().optional(),
  channelId: z.string().optional(),
});

export type JourneySessionStartedPayload = z.infer<typeof JourneySessionStartedPayloadSchema>;

/**
 * Payload for journey.session.completed event
 * Emitted when a journey session finishes
 */
export const JourneySessionCompletedPayloadSchema = z.object({
  sessionId: z.string(),
  journeyName: z.string().optional(),
  completionStatus: z.enum(["completed", "dropped"]).optional(),
  finalNodeId: z.string().optional(),
  channelId: z.string().optional(),
});

export type JourneySessionCompletedPayload = z.infer<typeof JourneySessionCompletedPayloadSchema>;

// =============================================================================
// SCHEDULE AND WEBHOOK EVENTS
// =============================================================================

/**
 * Payload for journey.schedule.fired event
 * Emitted when a cron schedule triggers
 */
export const JourneyScheduleFiredPayloadSchema = z.object({
  triggerId: z.string(),
  cronExpression: z.string().optional(),
});

export type JourneyScheduleFiredPayload = z.infer<typeof JourneyScheduleFiredPayloadSchema>;

/**
 * Payload for journey.webhook.received event
 * Emitted when an external webhook is called
 */
export const JourneyWebhookReceivedPayloadSchema = z.object({
  triggerId: z.string(),
  webhookPayload: z.unknown().optional(),
});

export type JourneyWebhookReceivedPayload = z.infer<typeof JourneyWebhookReceivedPayloadSchema>;
