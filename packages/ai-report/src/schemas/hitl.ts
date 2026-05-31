/**
 * HITL Decision Schema
 *
 * Track Human-in-the-Loop decisions during journey execution.
 *
 * @module @journey/ai-report/schemas/hitl
 */

import { z } from "zod";

/**
 * HITL decision types.
 */
export const HITLDecisionTypeSchema = z.enum([
  "approved",
  "rejected",
  "edited",
  "timeout",
  "cancelled",
]);

export type HITLDecisionType = z.infer<typeof HITLDecisionTypeSchema>;

/**
 * HITL decision detail schema.
 */
export const HITLDecisionDetailSchema = z.object({
  timestamp: z.string().datetime(),
  nodeId: z.string(),
  nodeLabel: z.string().optional(),

  // Request info
  requestId: z.string(),
  requestedAt: z.string().datetime().optional(),

  // What was being approved
  toolName: z.string().optional(),
  actionDescription: z.string().optional(),

  // Decision result
  decision: HITLDecisionTypeSchema,
  decidedBy: z.string().optional(), // User ID or name of approver
  decisionReason: z.string().optional(),

  // Edit tracking
  wasEdited: z.boolean().default(false),
  originalArgs: z.unknown().optional(),
  editedArgs: z.unknown().optional(),

  // Timing
  responseTimeMs: z.number().optional(),

  // Additional context
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type HITLDecisionDetail = z.infer<typeof HITLDecisionDetailSchema>;
