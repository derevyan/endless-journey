/**
 * Version Management Utilities
 *
 * Shared utilities for version ID parsing and generation.
 * Used by both Journey and Workflow version services to ensure
 * consistent version numbering (v001, v002, etc.).
 *
 * @module @journey/schemas/version-management
 */

import { z } from "zod";

// =============================================================================
// VERSION ID UTILITIES
// =============================================================================

/**
 * Version ID format pattern: v001, v002, etc.
 */
export const VERSION_ID_PATTERN = /^v(\d+)$/;

/**
 * Parse a version ID string into its numeric component.
 *
 * @param versionId - Version ID in format "v001", "v002", etc.
 * @returns The numeric version number, or 0 if invalid
 *
 * @example
 * ```ts
 * parseVersionNumber("v001") // => 1
 * parseVersionNumber("v042") // => 42
 * parseVersionNumber("invalid") // => 0
 * ```
 */
export function parseVersionNumber(versionId: string): number {
  const match = versionId.match(VERSION_ID_PATTERN);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Generate the next version ID from the latest version.
 *
 * @param latestVersionId - The most recent version ID, or null if no versions exist
 * @returns Next version ID in format "v001", "v002", etc.
 *
 * @example
 * ```ts
 * generateNextVersionId(null) // => "v001"
 * generateNextVersionId("v001") // => "v002"
 * generateNextVersionId("v099") // => "v100"
 * ```
 */
export function generateNextVersionId(latestVersionId: string | null): string {
  const currentNum = latestVersionId ? parseVersionNumber(latestVersionId) : 0;
  return `v${String(currentNum + 1).padStart(3, "0")}`;
}

// =============================================================================
// ATOMIC SAVE RESULT SCHEMA
// =============================================================================

/**
 * Generic atomic save result schema.
 * Used by both Journey and Workflow atomic save operations.
 *
 * The version field is generic to support different version types
 * (JourneyVersion, WorkflowVersion).
 */
export const AtomicSaveResultSchema = z.object({
  /** The saved version metadata */
  version: z
    .object({
      id: z.string().uuid(),
      versionId: z.string(),
      notes: z.string().nullable(),
      createdBy: z.string().nullable(),
      createdAt: z.coerce.date(),
    })
    .loose(), // Allow additional fields from specific version types
  /** The generated version ID */
  versionId: z.string(),
});

/**
 * Base atomic save result type.
 * Can be extended with specific version types.
 */
export interface AtomicSaveResultBase {
  version: {
    id: string;
    versionId: string;
    notes: string | null;
    createdBy: string | null;
    createdAt: Date;
  };
  versionId: string;
}
