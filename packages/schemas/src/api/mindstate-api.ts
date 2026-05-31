/**
 * Mindstate API Input Schemas
 *
 * Validation schemas for mindstate definition CRUD operations.
 */

import { z } from "zod";
import {
  MainAgentSchema,
  SystemAgentSchema,
  CreateStateParameterSchema,
  AnalysisModeSchema,
  MindstateStatusSchema,
} from "../mindstate";

/**
 * Create Mindstate Definition Input
 * POST /mindstates/definitions
 */
export const CreateMindstateDefinitionInputSchema = z.object({
  key: z
    .string()
    .min(1, "Key is required")
    .max(100)
    .regex(/^[a-z0-9-]+$/, "Key must be lowercase alphanumeric with hyphens"),
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().optional(),
  mainAgentConfig: MainAgentSchema.optional(),
  defaultAgents: z.array(SystemAgentSchema).optional(),
  defaultParameters: z.array(CreateStateParameterSchema).optional(),
  analysisMode: AnalysisModeSchema.optional(),
  categories: z.array(z.string()).optional(),
});
export type CreateMindstateDefinitionInput = z.infer<typeof CreateMindstateDefinitionInputSchema>;

/**
 * Update Mindstate Definition Input
 * PUT /mindstates/definitions/:key
 */
export const UpdateMindstateDefinitionInputSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, "Key must be lowercase alphanumeric with hyphens")
    .optional(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().nullable().optional(),
  mainAgentConfig: MainAgentSchema.optional(),
  defaultAgents: z.array(SystemAgentSchema).optional(),
  defaultParameters: z.array(CreateStateParameterSchema).optional(),
  analysisMode: AnalysisModeSchema.optional(),
  categories: z.array(z.string()).optional(),
  status: MindstateStatusSchema.optional(),
});
export type UpdateMindstateDefinitionInput = z.infer<typeof UpdateMindstateDefinitionInputSchema>;

/**
 * Preview Mindstate Analysis Input
 * POST /mindstates/definitions/:key/preview
 */
export const PreviewMindstateInputSchema = z.object({
  conversationHistory: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })
    )
    .min(1, "At least one message is required"),
  currentParameters: z.array(CreateStateParameterSchema).optional(),
});
export type PreviewMindstateInput = z.infer<typeof PreviewMindstateInputSchema>;

/**
 * Analyze Client Mindstate Input
 * POST /mindstates/clients/:clientId/:key/analyze
 */
export const AnalyzeClientMindstateInputSchema = z.object({
  messageId: z.string().optional().describe("Optional message ID for tracking"),
  forceAnalysis: z.boolean().optional().describe("Skip analysis mode checks"),
});
export type AnalyzeClientMindstateInput = z.infer<typeof AnalyzeClientMindstateInputSchema>;
