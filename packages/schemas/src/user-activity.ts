import { z } from "zod";
import { InteractionEventTypeSchema } from "./events/core";
import { USER_ACTIVITY_EVENT_TYPES } from "./events/event-types";

/**
 * User Activity Schemas
 *
 * Shared definitions for user activity timelines that mix session lifecycle
 * events with interaction events (messages, transitions, etc.).
 *
 * The UserActivityEventTypeSchema is now derived from INTERACTION_TO_ACTIVITY_MAP
 * in event-types.ts. This ensures activity types stay in sync with interaction
 * types - adding a new interaction type without updating the mapping will cause
 * a compile-time error.
 */

export const UserActivityEventTypeSchema = z.enum(USER_ACTIVITY_EVENT_TYPES);

export const UserActivityActorSchema = z.enum(["user", "bot", "system"]);

export const UserActivityEntrySchema = z.object({
  id: z.string(),
  userId: z.string(),
  sessionId: z.string(),
  journeyId: z.string(),
  journeyName: z.string(),
  nodeId: z.string().nullable(),
  eventType: UserActivityEventTypeSchema,
  actor: UserActivityActorSchema,
  title: z.string(),
  description: z.string().nullable(),
  timestamp: z.iso.datetime(),
  timeSincePrevMs: z.number().nullable(),
  rawType: InteractionEventTypeSchema.or(z.string()).optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type UserActivityEventType = z.infer<typeof UserActivityEventTypeSchema>;
export type UserActivityActor = z.infer<typeof UserActivityActorSchema>;
export type UserActivityEntry = z.infer<typeof UserActivityEntrySchema>;
