import { z } from "zod";

/**
 * CRM Common Schemas
 *
 * Shared enums used across CRM entities.
 */

// Field type for custom CRM fields
export const FieldTypeSchema = z.enum([
  "text",
  "number",
  "date",
  "select",
  "multi_select",
]);

// Message delivery status (matches DB enum in packages/db/src/schema/enums.ts)
export const MessageStatusSchema = z.enum([
  "pending",
  "sent",
  "delivered",
  "read",
  "failed",
]);

// Activity source tracking
export const ActivitySourceSchema = z.enum(["crm", "journey", "message"]);

// Inferred types
export type FieldType = z.infer<typeof FieldTypeSchema>;
export type MessageStatus = z.infer<typeof MessageStatusSchema>;
export type ActivitySource = z.infer<typeof ActivitySourceSchema>;
