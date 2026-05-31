import { z } from "zod";
import { WorkflowConfigurationSchema, type WorkflowConfiguration } from "./configuration";
import { WorkflowSettingsSchema } from "./settings";
import { WorkflowStatusSchema } from "./workflow";

// Re-export for convenience
export { WorkflowConfigurationSchema, type WorkflowConfiguration };

// =============================================================================
// WORKFLOW VERSION
// =============================================================================

/**
 * Workflow Version metadata (without configuration).
 * Used for listing versions efficiently.
 */
export const WorkflowVersionSchema = z.object({
  id: z.string().uuid(),
  workflowId: z.string().uuid(),
  versionId: z.string(), // "v001", "v002", etc.
  notes: z.string().nullable(),
  createdBy: z.string().nullable(),
  createdAt: z.coerce.date(),
});

export type WorkflowVersion = z.infer<typeof WorkflowVersionSchema>;

/**
 * Input for saving a new version.
 */
export const SaveWorkflowVersionInputSchema = z.object({
  versionId: z.string().min(1),
  notes: z.string().optional(),
  configuration: WorkflowConfigurationSchema,
});

export type SaveWorkflowVersionInput = z.infer<typeof SaveWorkflowVersionInputSchema>;

/**
 * Full version data with configuration.
 * Used for restoring/exporting versions.
 */
export const VersionedWorkflowDataSchema = z.object({
  version: WorkflowVersionSchema,
  data: WorkflowConfigurationSchema,
});

export type VersionedWorkflowData = z.infer<typeof VersionedWorkflowDataSchema>;

// =============================================================================
// ATOMIC SAVE (Server-side version ID generation)
// =============================================================================

/**
 * Input for atomic save operation.
 * Version ID is generated server-side to prevent collisions.
 * Updates workflow AND creates version in a single transaction.
 */
export const AtomicWorkflowSaveInputSchema = z.object({
  /** Optional notes for the version */
  notes: z.string().optional(),
  /** Workflow configuration to save */
  configuration: WorkflowConfigurationSchema,
  /** Workflow name (optional update) */
  name: z.string().optional(),
  /** Workflow description (optional update) */
  description: z.string().optional(),
  /** Workflow status (optional update) */
  status: WorkflowStatusSchema.optional(),
  /** Workflow settings (optional update) */
  settings: WorkflowSettingsSchema.nullable().optional(),
});

export type AtomicWorkflowSaveInput = z.infer<typeof AtomicWorkflowSaveInputSchema>;

/**
 * Result of atomic save operation.
 * Returned by the /workflows/:key/save endpoint.
 */
export interface AtomicWorkflowSaveResult {
  /** The saved version metadata */
  version: WorkflowVersion;
  /** The generated version ID */
  versionId: string;
}
