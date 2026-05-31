/**
 * Channel API Input Schemas
 *
 * Validation schemas for channel (bot) CRUD operations.
 */

import { z } from "zod";

/**
 * Create Channel Input
 * POST /channels
 */
export const CreateChannelInputSchema = z.object({
  botToken: z.string().min(1, "Bot token is required"),
});
export type CreateChannelInput = z.infer<typeof CreateChannelInputSchema>;

/**
 * Update Channel Input
 * PUT /channels/:id
 */
export const UpdateChannelInputSchema = z.object({
  defaultJourneyId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
  botName: z.string().min(1).max(100).optional(),
});
export type UpdateChannelInput = z.infer<typeof UpdateChannelInputSchema>;
