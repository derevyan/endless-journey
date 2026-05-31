import { z } from "zod";
import { BaseNodeDataSchema, MediaSchema } from "../../../base";

// Start node - entry point of the journey
export const StartNodeDataSchema = BaseNodeDataSchema.extend({
  type: z.literal("start"),
  // Max 4096 chars - Telegram message limit (1024 for media captions, handled at adapter level)
  content: z.string().min(1, "Content is required").max(4096, "Message must be 4096 characters or less"),
  media: MediaSchema.optional(),
});

export type StartNodeData = z.infer<typeof StartNodeDataSchema>;

// =============================================================================
// START NODE OUTPUT SCHEMA
// Mirrors what start-handler.ts stores via storeNodeOutput()
// See: start-handler.ts:46-48
// =============================================================================

/**
 * Start node output schema - stored via storeNodeOutput()
 * Uses createMessageMetadata() pattern from output-helpers.ts
 */
export const StartNodeOutputSchema = z.object({
  message: z.string().nullable(),
  messageDelivered: z.boolean(),
  mediaAttached: z
    .object({
      type: z.string(),
      url: z.string(),
    })
    .nullable(),
  journeyStartedAt: z.string(),
});

export type StartNodeOutput = z.infer<typeof StartNodeOutputSchema>;
