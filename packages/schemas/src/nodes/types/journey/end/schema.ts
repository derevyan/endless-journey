import { z } from "zod";
import { BaseNodeDataSchema } from "../../../base";
import { ButtonsSchema } from "../../../button";

// End node - exit point of the journey (clean terminal state, no message content)
export const EndNodeDataSchema = BaseNodeDataSchema.extend({
  type: z.literal("end"),
  // Content is optional - end nodes are clean terminal states
  // Use a message node before the end node for user-facing content
  content: z.string().max(4096).optional(),
  // Optional final action buttons with { id, text, edgeId } format
  buttons: ButtonsSchema.optional(),
  // Note: Tags are now managed via tagAction in BaseNodeDataSchema (add/remove operations)
});

export type EndNodeData = z.infer<typeof EndNodeDataSchema>;

// =============================================================================
// END NODE OUTPUT SCHEMA
// Mirrors what end-handler.ts stores via storeNodeOutput()
// See: end-handler.ts:47-50
// =============================================================================

/**
 * End node output schema - stored via storeNodeOutput()
 * Uses createMessageMetadata() pattern from output-helpers.ts
 */
export const EndNodeOutputSchema = z.object({
  message: z.string().nullable(),
  messageDelivered: z.boolean(),
  mediaAttached: z
    .object({
      type: z.string(),
      url: z.string(),
    })
    .nullable(),
  journeyCompletedAt: z.string(),
  sessionStatus: z.literal("completed"),
});

export type EndNodeOutput = z.infer<typeof EndNodeOutputSchema>;
