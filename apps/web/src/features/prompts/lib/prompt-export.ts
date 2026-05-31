/**
 * Prompt Export/Import Library
 *
 * Functions for bulk export and import of prompts as ZIP archives.
 *
 * @module features/prompts/lib/prompt-export
 */

import JSZip from "jszip";
import {
  PromptExportDataSchema,
  PromptsExportManifestSchema,
  type PromptExportData,
  type PromptsExportManifest,
} from "@journey/schemas";
import { promptsApi, promptVersionsApi } from "@/shared/lib/api/prompts";
import { downloadBlob } from "@/shared/lib/utils";
import { createLogger, serializeError } from "@journey/logger";

const log = createLogger("prompt-export");

// =============================================================================
// EXPORT TYPES
// =============================================================================

export interface ExportResult {
  success: boolean;
  error?: string;
}

export interface ImportResult {
  success: boolean;
  importedCount: number;
  renamedCount: number;
  errors: string[];
}

// =============================================================================
// HELPERS
// =============================================================================

type PromptListItem = Awaited<ReturnType<typeof promptsApi.list>>["prompts"][number];

/**
 * Fetch all prompts with pagination (API max is 100 per page)
 */
async function fetchAllPrompts(): Promise<PromptListItem[]> {
  const allPrompts: PromptListItem[] = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const { prompts, total } = await promptsApi.list({ limit, offset });
    allPrompts.push(...prompts);

    if (allPrompts.length >= total || prompts.length < limit) {
      break;
    }
    offset += limit;
  }

  return allPrompts;
}

/**
 * Generate a unique prompt name by appending -imported suffix
 */
function generateUniqueName(baseName: string, existingNames: Set<string>): string {
  let candidate = `${baseName}-imported`;
  let counter = 2;

  while (existingNames.has(candidate)) {
    candidate = `${baseName}-imported-${counter}`;
    counter++;
  }

  return candidate;
}

// =============================================================================
// EXPORT FUNCTIONS
// =============================================================================

/**
 * Export all prompts as a ZIP archive
 *
 * Creates a ZIP file with:
 * - manifest.json: Export metadata
 * - prompts/{name}.json: Each prompt with all versions
 */
export async function exportPromptsAsArchive(): Promise<ExportResult> {
  try {
    log.info({}, "promptExport:start");

    const prompts = await fetchAllPrompts();

    if (prompts.length === 0) {
      return { success: false, error: "No prompts to export" };
    }

    // Create ZIP archive
    const zip = new JSZip();
    const promptsFolder = zip.folder("prompts");

    if (!promptsFolder) {
      return { success: false, error: "Failed to create archive folder" };
    }

    // Add each prompt with its versions
    for (const prompt of prompts) {
      const versions = await promptVersionsApi.list(prompt.name);

      const exportData: PromptExportData = {
        name: prompt.name,
        description: prompt.description,
        type: prompt.type,
        tags: prompt.tags,
        isSystem: prompt.isSystem,
        versions: versions.map((v) => ({
          versionId: v.versionId,
          content: v.content,
          labels: v.labels,
          notes: v.notes,
        })),
      };

      promptsFolder.file(`${prompt.name}.json`, JSON.stringify(exportData, null, 2));
    }

    // Add manifest
    const manifest: PromptsExportManifest = {
      exportVersion: "1.0",
      exportedAt: new Date().toISOString(),
      promptCount: prompts.length,
    };
    zip.file("manifest.json", JSON.stringify(manifest, null, 2));

    // Generate and download
    const timestamp = new Date().toISOString().split("T")[0];
    const blob = await zip.generateAsync({ type: "blob" });
    downloadBlob(blob, `prompts-${timestamp}.zip`);

    log.info({ promptCount: prompts.length }, "promptExport:success");
    return { success: true };
  } catch (error) {
    log.error({ err: serializeError(error) }, "promptExport:error");
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to export prompts",
    };
  }
}

// =============================================================================
// IMPORT FUNCTIONS
// =============================================================================

/**
 * Import prompts from a ZIP archive
 *
 * - Validates manifest and each prompt file
 * - Renames conflicting prompts with -imported suffix
 * - Creates prompts with all their versions
 */
export async function importPromptsFromArchive(archiveFile: File): Promise<ImportResult> {
  const errors: string[] = [];
  let importedCount = 0;
  let renamedCount = 0;

  try {
    log.info({ fileName: archiveFile.name }, "promptImport:start");

    // Load ZIP archive
    let zip: JSZip;
    try {
      zip = await JSZip.loadAsync(archiveFile);
    } catch {
      return { success: false, importedCount: 0, renamedCount: 0, errors: ["Invalid ZIP archive"] };
    }

    // Validate manifest
    const manifestFile = zip.file("manifest.json");
    if (!manifestFile) {
      return {
        success: false,
        importedCount: 0,
        renamedCount: 0,
        errors: ["Archive missing manifest.json"],
      };
    }

    try {
      const manifestJson = await manifestFile.async("string");
      const parsed = JSON.parse(manifestJson);
      const result = PromptsExportManifestSchema.safeParse(parsed);
      if (!result.success) {
        return {
          success: false,
          importedCount: 0,
          renamedCount: 0,
          errors: ["Invalid manifest format"],
        };
      }
    } catch {
      return {
        success: false,
        importedCount: 0,
        renamedCount: 0,
        errors: ["Failed to parse manifest.json"],
      };
    }

    // Get existing prompt names for conflict detection
    const existingPrompts = await fetchAllPrompts();
    const existingNames = new Set(existingPrompts.map((p) => p.name));

    // Get prompt files from the prompts folder
    const promptsFolder = zip.folder("prompts");
    if (!promptsFolder) {
      return {
        success: false,
        importedCount: 0,
        renamedCount: 0,
        errors: ["Archive missing prompts folder"],
      };
    }

    // Process each prompt file
    const promptFiles: { name: string; file: JSZip.JSZipObject }[] = [];
    promptsFolder.forEach((relativePath, file) => {
      if (relativePath.endsWith(".json") && !file.dir) {
        promptFiles.push({ name: relativePath, file });
      }
    });

    if (promptFiles.length === 0) {
      return {
        success: false,
        importedCount: 0,
        renamedCount: 0,
        errors: ["No prompt files found in archive"],
      };
    }

    for (const { name: fileName, file } of promptFiles) {
      try {
        // Parse and validate prompt data
        const jsonString = await file.async("string");
        let promptData: PromptExportData;

        try {
          const parsed = JSON.parse(jsonString);
          const result = PromptExportDataSchema.safeParse(parsed);
          if (!result.success) {
            const issue = result.error.issues[0];
            const path = issue?.path.join(".") || "unknown";
            const message = issue?.message || "Invalid data";
            errors.push(`${fileName}: Invalid data at ${path}: ${message}`);
            continue;
          }
          promptData = result.data;
        } catch {
          errors.push(`${fileName}: Invalid JSON`);
          continue;
        }

        // Check for name conflict and generate unique name if needed
        let finalName = promptData.name;
        let wasRenamed = false;

        if (existingNames.has(promptData.name)) {
          finalName = generateUniqueName(promptData.name, existingNames);
          wasRenamed = true;
          log.info(
            { originalName: promptData.name, newName: finalName },
            "promptImport:renamed"
          );
        }

        // Add to existing names set to prevent duplicates within import
        existingNames.add(finalName);

        // Get the first version for initial prompt creation
        const firstVersion = promptData.versions[0];
        if (!firstVersion) {
          errors.push(`${fileName}: No versions found`);
          continue;
        }

        // Create prompt with first version
        await promptsApi.create({
          name: finalName,
          description: promptData.description ?? undefined,
          type: promptData.type,
          content: firstVersion.content,
          tags: promptData.tags,
          isSystem: promptData.isSystem,
        });

        // Add remaining versions
        for (let i = 1; i < promptData.versions.length; i++) {
          const version = promptData.versions[i];
          if (!version) continue;

          await promptVersionsApi.create(finalName, {
            content: version.content,
            labels: version.labels,
            notes: version.notes ?? undefined,
          });
        }

        // Update labels for first version if it had specific labels
        if (firstVersion.labels.length > 0) {
          // Get the created prompt to find the first version ID
          const createdPrompt = await promptsApi.get(finalName);
          if (createdPrompt.latestVersion) {
            await promptVersionsApi.updateLabels(finalName, createdPrompt.latestVersion.versionId, {
              labels: firstVersion.labels,
            });
          }
        }

        importedCount++;
        if (wasRenamed) {
          renamedCount++;
        }

        log.info({ name: finalName, versionsCount: promptData.versions.length }, "promptImport:promptCreated");
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        errors.push(`${fileName}: ${errorMessage}`);
        log.error({ err: serializeError(error), fileName }, "promptImport:promptError");
      }
    }

    const success = importedCount > 0;
    log.info({ importedCount, renamedCount, errorCount: errors.length }, "promptImport:complete");

    return { success, importedCount, renamedCount, errors };
  } catch (error) {
    log.error({ err: serializeError(error) }, "promptImport:error");
    return {
      success: false,
      importedCount: 0,
      renamedCount: 0,
      errors: [error instanceof Error ? error.message : "Failed to import prompts"],
    };
  }
}
