/**
 * Workflow Export/Import
 *
 * Handles exporting and importing workflow configurations as JSON files.
 * Follows the journey pattern but uses a simpler single-file format.
 *
 * @module features/agent-workflows/lib/workflow-export
 */

import type { WorkflowConfiguration, WorkflowSettings } from "@journey/schemas";
import { WorkflowConfigurationSchema, WorkflowSettingsSchema } from "@journey/schemas";
import { workflowsApi } from "@/shared/lib/api/workflows";
import { downloadJson } from "@/shared/lib/utils";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Workflow export data format.
 * Contains all data needed to recreate a workflow.
 */
export interface WorkflowExportData {
  /** Workflow name */
  name: string;
  /** Workflow description */
  description?: string;
  /** The workflow graph (nodes and edges) */
  configuration: WorkflowConfiguration;
  /** Workflow-level settings */
  settings?: WorkflowSettings;
  /** Export metadata */
  exportedAt: string;
  /** Format version for future compatibility */
  version: "1.0";
}

/**
 * Import result type
 */
export interface WorkflowImportResult {
  success: boolean;
  workflowId?: string;
  workflowKey?: string;
  error?: string;
}

// =============================================================================
// EXPORT FUNCTIONS
// =============================================================================

/**
 * Export workflow as a JSON file.
 *
 * Downloads a single JSON file containing:
 * - Workflow metadata (name, description)
 * - Full configuration (nodes, edges, variables)
 * - Settings (LLM defaults, execution settings)
 *
 * @param workflow - The workflow to export
 */
export function exportWorkflowAsJson(workflow: {
  key: string;
  name: string;
  description?: string;
  configuration: WorkflowConfiguration;
  settings: WorkflowSettings | null;
}): void {
  const timestamp = new Date().toISOString().split("T")[0];
  const filename = `${workflow.key}-${timestamp}.json`;

  const exportData: WorkflowExportData = {
    name: workflow.name,
    description: workflow.description,
    configuration: workflow.configuration,
    settings: workflow.settings ?? undefined,
    exportedAt: new Date().toISOString(),
    version: "1.0",
  };

  downloadJson(exportData, filename);
}

// =============================================================================
// IMPORT FUNCTIONS
// =============================================================================

/**
 * Validation result type
 */
type ValidationResult =
  | { success: true; data: WorkflowExportData }
  | { success: false; error: string };

/**
 * Validate workflow import data
 */
function validateWorkflowImportData(json: string): ValidationResult {
  // Parse JSON
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return { success: false, error: "Invalid JSON file" };
  }

  // Validate is an object
  if (!data || typeof data !== "object") {
    return { success: false, error: "Invalid workflow file format" };
  }

  const obj = data as Record<string, unknown>;

  // Validate version
  if (obj.version !== "1.0") {
    return { success: false, error: "Unsupported workflow version" };
  }

  // Validate name (required)
  if (typeof obj.name !== "string" || obj.name.trim().length === 0) {
    return { success: false, error: "Workflow name is required" };
  }

  // Sanitize name (prevent XSS/injection, limit length)
  const name = obj.name.trim().slice(0, 200);
  if (/<script|javascript:|on\w+=/i.test(name)) {
    return { success: false, error: "Invalid characters in workflow name" };
  }

  // Validate description (optional)
  let description: string | undefined;
  if (obj.description != null) {
    if (typeof obj.description !== "string") {
      return { success: false, error: "Description must be a string" };
    }
    description = obj.description.trim().slice(0, 2000);
    if (/<script|javascript:|on\w+=/i.test(description)) {
      return { success: false, error: "Invalid characters in description" };
    }
  }

  // Validate configuration
  if (!obj.configuration) {
    return { success: false, error: "Configuration is required" };
  }

  const configResult = WorkflowConfigurationSchema.safeParse(obj.configuration);
  if (!configResult.success) {
    const issue = configResult.error.issues[0];
    const path = issue?.path.join(".") || "unknown";
    const message = issue?.message || "Invalid data";
    return {
      success: false,
      error: `Invalid configuration at ${path}: ${message}`,
    };
  }

  // Validate settings (optional)
  let settings: WorkflowSettings | undefined;
  if (obj.settings) {
    const settingsResult = WorkflowSettingsSchema.safeParse(obj.settings);
    if (!settingsResult.success) {
      const issue = settingsResult.error.issues[0];
      const path = issue?.path.join(".") || "unknown";
      const message = issue?.message || "Invalid data";
      return {
        success: false,
        error: `Invalid settings at ${path}: ${message}`,
      };
    }
    settings = settingsResult.data;
  }

  return {
    success: true,
    data: {
      name,
      description,
      configuration: configResult.data,
      settings,
      exportedAt: typeof obj.exportedAt === "string" ? obj.exportedAt : new Date().toISOString(),
      version: "1.0",
    },
  };
}

/**
 * Generate a unique workflow key from the name.
 * Converts to lowercase, replaces spaces with hyphens, removes special characters.
 */
function generateKeyFromName(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 50);

  // Add timestamp suffix for uniqueness
  const timestamp = Date.now().toString(36).slice(-4);
  return `${base}-${timestamp}`;
}

/**
 * Import a workflow from a JSON file.
 *
 * Creates a new workflow with a generated unique key.
 *
 * @param file - The JSON file to import
 */
export async function importWorkflowFromJson(file: File): Promise<WorkflowImportResult> {
  try {
    // Read file content
    const json = await file.text();

    // Validate
    const validationResult = validateWorkflowImportData(json);
    if (!validationResult.success) {
      return { success: false, error: validationResult.error };
    }

    const { name, description, configuration, settings } = validationResult.data;

    // Generate unique key
    const key = generateKeyFromName(name);

    // Create workflow via API
    const workflow = await workflowsApi.create({
      key,
      name,
      description,
      configuration,
      settings: settings ?? null,
      status: "draft",
    });

    return {
      success: true,
      workflowId: workflow.id,
      workflowKey: workflow.key,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to import workflow",
    };
  }
}
