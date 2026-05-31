import { z } from "zod";

/**
 * CRM Stage Schemas
 *
 * Schemas for pipeline stage entities and CRUD operations.
 */

// Pipeline stage entity
export const PipelineStageSchema = z.object({
  id: z.string().uuid(),
  pipelineId: z.string().uuid(),
  organizationId: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  color: z.string().nullable(),
  position: z.number().int(),
  isDefault: z.boolean().nullable(),
  isSystem: z.boolean().nullable(),
  createdAt: z.coerce.date().nullable(),
  updatedAt: z.coerce.date().nullable(),
});

// Stage with client count (for list views)
export const PipelineStageWithCountSchema = PipelineStageSchema.extend({
  clientCount: z.number().int(),
});

// Client stage assignment (per pipeline)
export const ClientStageAssignmentSchema = z.object({
  id: z.string().uuid(),
  clientId: z.string().uuid(),
  organizationId: z.string().uuid(),
  pipelineId: z.string().uuid(),
  pipelineName: z.string(),
  pipelineColor: z.string().nullable(),
  stageId: z.string().uuid(),
  stageName: z.string(),
  stageColor: z.string().nullable(),
  assignedBy: z.string().uuid().nullable(),
  assignedAt: z.coerce.date().nullable(),
  notes: z.string().nullable(),
});

// Client stage history entry
export const StageHistoryEntrySchema = z.object({
  id: z.string().uuid(),
  clientId: z.string().uuid(),
  pipelineId: z.string().uuid().nullable(),
  pipelineName: z.string().nullable(),
  fromStageId: z.string().uuid().nullable(),
  fromStageName: z.string().nullable(),
  toStageId: z.string().uuid(),
  toStageName: z.string(),
  changedBy: z.string().uuid().nullable(),
  changedAt: z.coerce.date().nullable(),
  notes: z.string().nullable(),
  durationMs: z.number().int().nullable(),
});

// Create stage input
export const CreateStageInputSchema = z.object({
  pipelineId: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional(),
  color: z.string().optional(),
  isDefault: z.boolean().optional(),
});

// Update stage input
export const UpdateStageInputSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  color: z.string().optional(),
  position: z.number().int().optional(),
  isDefault: z.boolean().optional(),
});

// Reorder stages input
export const ReorderStagesInputSchema = z.object({
  pipelineId: z.string().uuid("Invalid pipeline ID"),
  stageIds: z.array(z.string().uuid("Invalid stage ID")),
});

// Inferred types
export type PipelineStage = z.infer<typeof PipelineStageSchema>;
export type PipelineStageWithCount = z.infer<typeof PipelineStageWithCountSchema>;
export type ClientStageAssignment = z.infer<typeof ClientStageAssignmentSchema>;
export type StageHistoryEntry = z.infer<typeof StageHistoryEntrySchema>;
export type CreateStageInput = z.infer<typeof CreateStageInputSchema>;
export type UpdateStageInput = z.infer<typeof UpdateStageInputSchema>;
export type ReorderStagesInput = z.infer<typeof ReorderStagesInputSchema>;
