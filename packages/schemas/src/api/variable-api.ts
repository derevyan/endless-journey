/**
 * Variable API Input Schemas
 *
 * Validation schemas for global and journey variable operations.
 */

import { z } from "zod";

/**
 * Set Global Variable Input
 * PUT /variables/global/:key
 */
export const SetGlobalVariableInputSchema = z.object({
  value: z.unknown().refine((val) => val !== undefined, "Value is required"),
  description: z.string().optional(),
});
export type SetGlobalVariableInput = z.infer<typeof SetGlobalVariableInputSchema>;

/**
 * Set Journey Variable Input
 * PUT /variables/journey/:journeyId/:key
 */
export const SetJourneyVariableInputSchema = z.object({
  value: z.unknown().refine((val) => val !== undefined, "Value is required"),
  description: z.string().optional(),
});
export type SetJourneyVariableInput = z.infer<typeof SetJourneyVariableInputSchema>;

/**
 * Execute Variable Operations Input
 * POST /variables/execute
 */
export const ExecuteVariableInputSchema = z
  .object({
    clientId: z.string().min(1, "Client ID is required"),
    set: z
      .record(z.string(), z.unknown())
      .optional()
      .describe("Variables to set: { key: value }"),
    unset: z
      .array(z.string())
      .optional()
      .describe("Variable keys to unset"),
  })
  .refine(
    (data) => {
      const hasSet = data.set && Object.keys(data.set).length > 0;
      const hasUnset = data.unset && data.unset.length > 0;
      return hasSet || hasUnset;
    },
    {
      message: "At least one of 'set' or 'unset' must be provided with values",
    }
  );
export type ExecuteVariableInput = z.infer<typeof ExecuteVariableInputSchema>;
