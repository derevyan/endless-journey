/**
 * Variable Event Payloads
 *
 * Payload schemas for variable-related events.
 *
 * @module schemas/events/payloads/variable
 */

import { z } from "zod";
import { VariableScopeSchema } from "../../variables";

// =============================================================================
// VARIABLE EVENTS
// =============================================================================

/**
 * Payload for variable.changed event
 * Emitted when a variable value is changed
 */
export const VariableChangedPayloadSchema = z.object({
  key: z.string(),
  value: z.unknown(),
  previousValue: z.unknown().optional(),
  scope: VariableScopeSchema,
  scopeId: z.string(),
});

export type VariableChangedPayload = z.infer<typeof VariableChangedPayloadSchema>;
