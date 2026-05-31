/**
 * Automation Schemas
 *
 * Defines types for automation triggers and events.
 * Used by the event bus system to match events to journeys.
 *
 * @module schemas/automation
 */

import { z } from "zod";

// =============================================================================
// TRIGGER TYPES
// =============================================================================

/**
 * Trigger types that can start an automation journey
 */
export const TriggerTypeSchema = z.enum([
  "user_message", // Default - user initiates via messaging (existing behavior)
  "tag_change", // Tag added or removed from user
  "variable_condition", // Variable meets a condition
  "journey_completed", // Another journey finished
  "schedule", // Cron-based scheduled trigger
  "webhook", // External API call
]);

export type TriggerType = z.infer<typeof TriggerTypeSchema>;

// =============================================================================
// TRIGGER CONFIGURATIONS (Discriminated Union)
// =============================================================================

/**
 * User message trigger - the default, existing behavior
 */
export const UserMessageTriggerSchema = z.object({
  type: z.literal("user_message"),
});

/**
 * Tag change trigger - fires when a tag is added or removed
 * Tags are global (organization-wide) and follow users across all journeys.
 */
export const TagChangeTriggerSchema = z.object({
  type: z.literal("tag_change"),
  tagName: z.string().min(1),
  action: z.enum(["added", "removed"]),
});

/**
 * Variable condition trigger - fires when a variable meets a condition
 * Uses expr-eval expressions like "value >= 100" or "value == 'gold'"
 */
export const VariableConditionTriggerSchema = z.object({
  type: z.literal("variable_condition"),
  variableKey: z.string().min(1),
  scope: z.enum(["user", "journey", "global"]),
  expression: z.string().min(1), // e.g., "value >= 100", "value == 'gold'"
});

/**
 * Journey completed trigger - fires when another journey finishes
 */
export const JourneyCompletedTriggerSchema = z.object({
  type: z.literal("journey_completed"),
  sourceJourneyId: z.string().uuid().optional(), // If not specified, matches any journey completion
});

/**
 * Schedule trigger - fires on a cron schedule
 */
export const ScheduleTriggerSchema = z.object({
  type: z.literal("schedule"),
  cron: z.string().min(1), // e.g., "0 9 * * *" for 9am daily
  timezone: z.string().optional(), // e.g., "America/New_York", defaults to UTC
});

/**
 * Webhook trigger - fires when external system calls the webhook
 */
export const WebhookTriggerSchema = z.object({
  type: z.literal("webhook"),
  // Secret key is generated server-side, not part of config
});

/**
 * Combined trigger configuration (discriminated union)
 */
export const TriggerConfigSchema = z.discriminatedUnion("type", [
  UserMessageTriggerSchema,
  TagChangeTriggerSchema,
  VariableConditionTriggerSchema,
  JourneyCompletedTriggerSchema,
  ScheduleTriggerSchema,
  WebhookTriggerSchema,
]);

export type TriggerConfig = z.infer<typeof TriggerConfigSchema>;
export type UserMessageTrigger = z.infer<typeof UserMessageTriggerSchema>;
export type TagChangeTrigger = z.infer<typeof TagChangeTriggerSchema>;
export type VariableConditionTrigger = z.infer<typeof VariableConditionTriggerSchema>;
export type JourneyCompletedTrigger = z.infer<typeof JourneyCompletedTriggerSchema>;
export type ScheduleTrigger = z.infer<typeof ScheduleTriggerSchema>;
export type WebhookTrigger = z.infer<typeof WebhookTriggerSchema>;

// =============================================================================
// AUTOMATION EVENTS (for BullMQ queue)
// =============================================================================

/**
 * Tag added event - emitted when a tag is assigned to a user
 * Tags are global (organization-wide) and follow users across all journeys.
 */
export const TagAddedEventSchema = z.object({
  type: z.literal("tag.added"),
  clientId: z.string(),
  tagName: z.string(),
  organizationId: z.string(),
  channelId: z.string().optional(),
});

/**
 * Tag removed event - emitted when a tag is removed from a user
 * Tags are global (organization-wide) and follow users across all journeys.
 */
export const TagRemovedEventSchema = z.object({
  type: z.literal("tag.removed"),
  clientId: z.string(),
  tagName: z.string(),
  organizationId: z.string(),
  channelId: z.string().optional(),
});

/**
 * Variable changed event - emitted when a variable value changes
 */
export const VariableChangedEventSchema = z.object({
  type: z.literal("variable.changed"),
  key: z.string(),
  value: z.unknown(),
  previousValue: z.unknown().optional(),
  scope: z.enum(["user", "journey", "global"]),
  scopeId: z.string(), // clientId for user, journeyId for journey, orgId for global
  organizationId: z.string(),
  clientId: z.string().optional(), // Present for user scope
});

/**
 * Journey started event - emitted when a user starts a journey
 */
export const JourneyStartedEventSchema = z.object({
  type: z.literal("journey.started"),
  clientId: z.string(),
  journeyId: z.string(),
  sessionId: z.string(),
  organizationId: z.string(),
  channelId: z.string().optional(),
});

/**
 * Journey completed event - emitted when a user finishes a journey
 */
export const JourneyCompletedEventSchema = z.object({
  type: z.literal("journey.completed"),
  clientId: z.string(),
  journeyId: z.string(),
  sessionId: z.string(),
  organizationId: z.string(),
  channelId: z.string().optional(),
  completionStatus: z.enum(["completed", "dropped"]).optional(),
});

/**
 * Schedule fired event - emitted when a cron schedule triggers
 */
export const ScheduleFiredEventSchema = z.object({
  type: z.literal("schedule.fired"),
  triggerId: z.string(),
  journeyId: z.string(),
  organizationId: z.string(),
});

/**
 * Webhook received event - emitted when external webhook is called
 */
export const WebhookReceivedEventSchema = z.object({
  type: z.literal("webhook.received"),
  triggerId: z.string(),
  journeyId: z.string(),
  organizationId: z.string(),
  payload: z.unknown(), // The webhook payload
  clientId: z.string().optional(), // If the webhook specifies a target user
});

/**
 * Combined automation event (discriminated union)
 */
export const AutomationEventSchema = z.discriminatedUnion("type", [
  TagAddedEventSchema,
  TagRemovedEventSchema,
  VariableChangedEventSchema,
  JourneyStartedEventSchema,
  JourneyCompletedEventSchema,
  ScheduleFiredEventSchema,
  WebhookReceivedEventSchema,
]);

export type AutomationEvent = z.infer<typeof AutomationEventSchema>;
export type TagAddedEvent = z.infer<typeof TagAddedEventSchema>;
export type TagRemovedEvent = z.infer<typeof TagRemovedEventSchema>;
export type VariableChangedEvent = z.infer<typeof VariableChangedEventSchema>;
export type JourneyStartedEvent = z.infer<typeof JourneyStartedEventSchema>;
export type JourneyCompletedEvent = z.infer<typeof JourneyCompletedEventSchema>;
export type ScheduleFiredEvent = z.infer<typeof ScheduleFiredEventSchema>;
export type WebhookReceivedEvent = z.infer<typeof WebhookReceivedEventSchema>;

// =============================================================================
// HELPER TYPES
// =============================================================================

/**
 * Event types that can be emitted
 */
export const AutomationEventTypeSchema = z.enum([
  "tag.added",
  "tag.removed",
  "variable.changed",
  "journey.started",
  "journey.completed",
  "schedule.fired",
  "webhook.received",
]);

export type AutomationEventType = z.infer<typeof AutomationEventTypeSchema>;
