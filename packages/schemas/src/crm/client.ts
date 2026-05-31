import { z } from "zod";

/**
 * CRM Client Schemas
 *
 * Schemas for client entities, profiles, and filters.
 */

// Client stage info (nested in profile)
export const ClientStageInfoSchema = z.object({
  stageId: z.string().uuid(),
  stageName: z.string(),
  stageColor: z.string().nullable(),
  assignedAt: z.coerce.date().nullable(),
  assignedBy: z.string().uuid().nullable(),
});

// Client field value (nested in profile)
export const ClientFieldValueSchema = z.object({
  fieldId: z.string().uuid(),
  fieldName: z.string(),
  fieldKey: z.string(),
  fieldType: z.string(),
  value: z.unknown(),
  updatedAt: z.coerce.date().nullable(),
});

// CRM client (simplified list view)
export const CrmClientSchema = z.object({
  id: z.string().uuid(),
  platform: z.string(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  username: z.string().nullable(),
  stageId: z.string().uuid().nullable(),
  stageName: z.string().nullable(),
  stageColor: z.string().nullable(),
  totalSessions: z.number().int(),
  lastActiveAt: z.coerce.date().nullable(),
  tags: z.array(z.string()),
});

// CRM client profile (detailed view)
export const CrmClientProfileSchema = z.object({
  id: z.string().uuid(),
  platform: z.string(),
  platformUserId: z.string(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  username: z.string().nullable(),
  createdAt: z.coerce.date().nullable(),
  updatedAt: z.coerce.date().nullable(),
  stage: ClientStageInfoSchema.nullable(),
  customFields: z.array(ClientFieldValueSchema),
  tags: z.array(z.string()),
  totalSessions: z.number().int(),
  lastActiveAt: z.coerce.date().nullable(),
});

// Client filters (for querying)
export const ClientFiltersSchema = z.object({
  stageId: z.string().uuid().optional(),
  stageIds: z.array(z.string().uuid()).optional(),
  pipelineId: z.string().uuid().optional(),
  journeyId: z.string().uuid().optional(),
  search: z.string().optional(),
  tags: z.array(z.string()).optional(),
  noStage: z.boolean().optional(),
  dateFrom: z.string().optional(), // ISO date string
  dateTo: z.string().optional(), // ISO date string
});

// =============================================================================
// CLIENT OPERATION INPUTS
// =============================================================================

// Assign client to stage
export const AssignClientStageInputSchema = z.object({
  stageId: z.string().uuid("Invalid stage ID"),
  notes: z.string().optional(),
});

// Update client field values
export const UpdateClientFieldsInputSchema = z.object({
  values: z.array(
    z.object({
      fieldId: z.string().uuid("Invalid field ID"),
      value: z.unknown(),
    })
  ),
});

// Add tag to client
export const AddClientTagInputSchema = z.object({
  tag: z.string().min(1, "Tag is required").max(100, "Tag too long"),
});

// Inferred types
export type ClientStageInfo = z.infer<typeof ClientStageInfoSchema>;
export type ClientFieldValue = z.infer<typeof ClientFieldValueSchema>;
export type CrmClient = z.infer<typeof CrmClientSchema>;
export type CrmClientProfile = z.infer<typeof CrmClientProfileSchema>;
export type ClientFilters = z.infer<typeof ClientFiltersSchema>;
export type AssignClientStageInput = z.infer<typeof AssignClientStageInputSchema>;
export type UpdateClientFieldsInput = z.infer<typeof UpdateClientFieldsInputSchema>;
export type AddClientTagInput = z.infer<typeof AddClientTagInputSchema>;
