import { z } from "zod";
import { BaseNodeDataSchema } from "../../../base";
import { DurationSchema } from "../../../follow-up";

// Wait node - simple delay/pause in the journey
// Unlike MESSAGE with timer (which waits for user action OR timeout),
// WAIT always waits for the specified duration
//
// Uses DurationSchema from follow-up.ts which supports flexible units:
// seconds, minutes, hours, days (max 7 days)
export const WaitNodeDataSchema = BaseNodeDataSchema.extend({
  type: z.literal("wait"),
  duration: DurationSchema,
  // Optional description of why we're waiting
  reason: z.string().optional(),
});

export type WaitNodeData = z.infer<typeof WaitNodeDataSchema>;

// =============================================================================
// WAIT NODE OUTPUT SCHEMA
// Mirrors what wait-handler.ts stores via storeNodeOutput()
// See: wait-handler.ts:71-76
// =============================================================================

/**
 * Wait node output schema - stored via storeNodeOutput()
 * Stores wait timing metadata for observability and analytics
 */
export const WaitNodeOutputSchema = z.object({
  duration: z.number(),
  delayMs: z.number(),
  timerScheduledAt: z.string(),
  expectedCompletionAt: z.string(),
});

export type WaitNodeOutput = z.infer<typeof WaitNodeOutputSchema>;
