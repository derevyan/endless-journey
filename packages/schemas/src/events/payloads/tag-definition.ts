/**
 * Tag Definition Event Payloads
 *
 * Payload schemas for tag definition lifecycle events.
 *
 * @module schemas/events/payloads/tag-definition
 */

import { z } from "zod";

// =============================================================================
// TAG DEFINITION LIFECYCLE EVENTS
// =============================================================================

/**
 * Payload for tag.definition.created event
 * Emitted when a new tag definition is created
 */
export const TagDefinitionCreatedPayloadSchema = z.object({
  tagId: z.string(),
  tagName: z.string(),
  color: z.string().nullable(),
  createdBy: z.string(),
});

export type TagDefinitionCreatedPayload = z.infer<typeof TagDefinitionCreatedPayloadSchema>;

/**
 * Payload for tag.definition.updated event
 * Emitted when a tag definition is updated
 */
export const TagDefinitionUpdatedPayloadSchema = z.object({
  tagId: z.string(),
  tagName: z.string(),
  changes: z.record(z.string(), z.unknown()),
  updatedBy: z.string(),
});

export type TagDefinitionUpdatedPayload = z.infer<typeof TagDefinitionUpdatedPayloadSchema>;

/**
 * Payload for tag.definition.deleted event
 * Emitted when a tag definition is deleted
 */
export const TagDefinitionDeletedPayloadSchema = z.object({
  tagId: z.string(),
  tagName: z.string(),
  deletedBy: z.string(),
});

export type TagDefinitionDeletedPayload = z.infer<typeof TagDefinitionDeletedPayloadSchema>;
