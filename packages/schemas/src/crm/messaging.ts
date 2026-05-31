import { z } from "zod";
import { MessageStatusSchema } from "./common";

/**
 * CRM Messaging Schemas
 *
 * Schemas for direct messages and sending operations.
 */

// Direct message entity
export const DirectMessageSchema = z.object({
  id: z.string().uuid(),
  clientId: z.string().uuid(),
  content: z.string(),
  status: MessageStatusSchema,
  sentBy: z.string().uuid(),
  sentByName: z.string().nullable(),
  sentAt: z.coerce.date().nullable(),
  deliveredAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date().nullable(),
  errorMessage: z.string().nullable(),
});

// Send message input
export const SendMessageInputSchema = z.object({
  content: z.string().min(1),
  channelId: z.string(),
});

// Inferred types
export type DirectMessage = z.infer<typeof DirectMessageSchema>;
export type SendMessageInput = z.infer<typeof SendMessageInputSchema>;
