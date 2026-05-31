/**
 * Message Detail Schema
 *
 * Complete message record - what was sent/received and context.
 *
 * @module @journey/ai-report/schemas/messages
 */

import { z } from "zod";

/**
 * Button state within a message.
 */
export const MessageButtonSchema = z.object({
  id: z.string(),
  label: z.string(),
  wasClicked: z.boolean().default(false),
});

export type MessageButton = z.infer<typeof MessageButtonSchema>;

/**
 * Complete message record - what was sent/received and context.
 */
export const MessageDetailSchema = z.object({
  timestamp: z.string().datetime(),
  direction: z.enum(["inbound", "outbound"]),

  // Content
  content: z.string(),
  contentType: z.enum(["text", "media", "structured"]).default("text"),

  // Context
  nodeId: z.string(),
  nodeLabel: z.string().optional(),

  // For outbound messages
  buttons: z.array(MessageButtonSchema).optional(),

  // For inbound messages
  selectedButtonId: z.string().optional(),
  selectedButtonLabel: z.string().optional(),
  isTextInput: z.boolean().optional(),

  // Processing info
  processedByNodeId: z.string().optional(), // Which node processed this input
  processingDurationMs: z.number().optional(),
});

export type MessageDetail = z.infer<typeof MessageDetailSchema>;

/**
 * Detailed error record for debugging.
 */
export const ErrorDetailSchema = z.object({
  timestamp: z.string().datetime(),
  nodeId: z.string(),
  nodeType: z.string(),
  nodeLabel: z.string().optional(),

  errorType: z.enum([
    "node_execution",
    "workflow_error",
    "webhook_failure",
    "guard_rejection",
    "timeout",
    "validation",
    "llm_error",
    "tool_error",
    "unknown",
  ]),

  message: z.string(),
  stack: z.string().optional(),

  // Recovery
  wasRecovered: z.boolean().default(false),
  recoveryAction: z.string().optional(),

  // Context
  inputData: z.unknown().optional(),
  outputData: z.unknown().optional(),
});

export type ErrorDetail = z.infer<typeof ErrorDetailSchema>;
