/**
 * Mindstate Version Types
 * Type definitions for mindstate definition versioning
 */

import { z } from "zod";
import type { MainAgent, SystemAgent, StateParameter } from "../mindstate";

// ============================================================================
// VERSION CONFIGURATION
// ============================================================================

/**
 * Configuration snapshot stored in a version
 * Contains all the editable aspects of a mindstate definition
 */
export interface MindstateVersionConfig {
  mainAgentConfig: MainAgent;
  defaultAgents: SystemAgent[];
  defaultParameters: StateParameter[];
  analysisMode: "automatic" | "selective" | "node-triggered" | "manual";
  categories: string[];
}

// ============================================================================
// VERSION METADATA
// ============================================================================

/**
 * Version record metadata (without full configuration)
 * Used in version list displays
 */
export interface MindstateDefinitionVersion {
  id: string;
  definitionId: string;
  versionId: string;
  notes: string | null;
  createdBy: string | null;
  createdAt: Date | string;
}

/**
 * Full version data with configuration
 * Returned when retrieving a specific version
 */
export interface VersionedMindstateData {
  version: MindstateDefinitionVersion;
  data: MindstateVersionConfig;
}

/**
 * Result of atomic save operation
 */
export interface AtomicSaveMindstateResult {
  version: MindstateDefinitionVersion;
  versionId: string;
}

// ============================================================================
// INPUT SCHEMAS
// ============================================================================

/**
 * Input schema for manual version save (with explicit version ID)
 */
export const SaveMindstateVersionInputSchema = z.object({
  versionId: z.string().regex(/^v\d+$/, "Version ID must match pattern v001, v002, etc."),
  notes: z.string().optional(),
  configuration: z.object({
    mainAgentConfig: z.any(),
    defaultAgents: z.array(z.any()),
    defaultParameters: z.array(z.any()),
    analysisMode: z.enum(["automatic", "selective", "node-triggered", "manual"]),
    categories: z.array(z.string()),
  }),
});

/**
 * Input schema for atomic save (server generates version ID)
 * Preferred method for save operations
 */
export const AtomicSaveMindstateInputSchema = z.object({
  notes: z.string().optional(),
  configuration: z.object({
    mainAgentConfig: z.any(),
    defaultAgents: z.array(z.any()),
    defaultParameters: z.array(z.any()),
    analysisMode: z.enum(["automatic", "selective", "node-triggered", "manual"]),
    categories: z.array(z.string()),
  }),
});

/**
 * Inferred types from schemas
 */
export type SaveMindstateVersionInput = z.infer<typeof SaveMindstateVersionInputSchema>;
export type AtomicSaveMindstateInput = z.infer<typeof AtomicSaveMindstateInputSchema>;
