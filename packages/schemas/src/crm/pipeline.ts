import { z } from "zod";

/**
 * CRM Pipeline Schemas
 *
 * Schemas for pipeline entities and CRUD operations.
 */

// Pipeline entity
export const PipelineSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  position: z.number().int(),
  isDefault: z.boolean().nullable(),
  isActive: z.boolean().nullable(),
  color: z.string().nullable(),
  createdAt: z.coerce.date().nullable(),
  updatedAt: z.coerce.date().nullable(),
});

// Pipeline with counts (for list views)
export const PipelineWithStageCountSchema = PipelineSchema.extend({
  stageCount: z.number().int(),
  clientCount: z.number().int(),
});

// Create pipeline input
export const CreatePipelineInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  color: z.string().optional(),
});

// Update pipeline input
export const UpdatePipelineInputSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  color: z.string().optional(),
  isActive: z.boolean().optional(),
});

// Reorder pipelines input
export const ReorderPipelinesInputSchema = z.object({
  pipelineIds: z.array(z.string().uuid("Invalid pipeline ID")),
});

// Inferred types
export type Pipeline = z.infer<typeof PipelineSchema>;
export type PipelineWithStageCount = z.infer<typeof PipelineWithStageCountSchema>;
export type CreatePipelineInput = z.infer<typeof CreatePipelineInputSchema>;
export type UpdatePipelineInput = z.infer<typeof UpdatePipelineInputSchema>;
export type ReorderPipelinesInput = z.infer<typeof ReorderPipelinesInputSchema>;
