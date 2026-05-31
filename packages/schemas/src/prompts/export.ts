/**
 * Prompt Export/Import Schemas
 *
 * Zod schemas for bulk prompt export and import operations.
 *
 * @module schemas/prompts/export
 */

import { z } from "zod";
import { PromptTypeSchema, PromptContentSchema } from "./types";

// =============================================================================
// EXPORT VERSION SCHEMA
// =============================================================================

/**
 * Exported version data - simplified version of PromptVersionResponse
 * Excludes internal fields (id, createdBy, createdAt) that are regenerated on import
 */
export const PromptExportVersionSchema = z.object({
  versionId: z.string(),
  content: PromptContentSchema,
  labels: z.array(z.string()),
  notes: z.string().nullable(),
});
export type PromptExportVersion = z.infer<typeof PromptExportVersionSchema>;

// =============================================================================
// PROMPT EXPORT DATA SCHEMA
// =============================================================================

/**
 * Single prompt export format
 * Contains all data needed to recreate a prompt with its versions
 */
export const PromptExportDataSchema = z.object({
  name: z.string(),
  description: z.string().nullable(),
  type: PromptTypeSchema,
  tags: z.array(z.string()),
  isSystem: z.boolean(),
  versions: z.array(PromptExportVersionSchema).min(1, "At least one version is required"),
});
export type PromptExportData = z.infer<typeof PromptExportDataSchema>;

// =============================================================================
// MANIFEST SCHEMA
// =============================================================================

/**
 * Export manifest - metadata about the export archive
 */
export const PromptsExportManifestSchema = z.object({
  exportVersion: z.literal("1.0"),
  exportedAt: z.string(),
  promptCount: z.number().int().nonnegative(),
});
export type PromptsExportManifest = z.infer<typeof PromptsExportManifestSchema>;
