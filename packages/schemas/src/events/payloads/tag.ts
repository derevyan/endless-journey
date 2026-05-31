/**
 * Tag Event Payloads
 *
 * Payload schemas for tag-related events.
 *
 * @module schemas/events/payloads/tag
 */

import { z } from "zod";

// =============================================================================
// TAG EVENTS
// =============================================================================

/**
 * Payload for tag.added event
 * Emitted when a tag is added to a client
 */
export const TagAddedPayloadSchema = z.object({
  clientId: z.string(),
  tagId: z.string(),
  tagName: z.string(),
});

export type TagAddedPayload = z.infer<typeof TagAddedPayloadSchema>;

/**
 * Payload for tag.removed event
 * Emitted when a tag is removed from a client
 */
export const TagRemovedPayloadSchema = z.object({
  clientId: z.string(),
  tagId: z.string(),
  tagName: z.string(),
});

export type TagRemovedPayload = z.infer<typeof TagRemovedPayloadSchema>;
