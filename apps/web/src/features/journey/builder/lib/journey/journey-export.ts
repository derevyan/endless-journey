import type { VersionedJourneyData, JourneyConfig } from "@journey/schemas";
import type { JourneyConfigRecord, JourneyVariable, MediaItem } from "@/shared/lib/api";
import { journeysApi, variablesApi, mediaApi } from "@/shared/lib/api";
import { downloadJson, downloadBlob } from "@/shared/lib/utils";
import { EDGE_STYLE_DEFAULTS } from "@/features/nodes/journey/config/node-theme";
import {
  JourneyConfigSchema,
  JourneyContentSchema,
  optimizeJourneyForExport,
  restoreJourneyFromExport,
} from "@journey/schemas";
import JSZip from "jszip";

// =============================================================================
// EXPORT FILE TYPES (v2.0 Enhanced Format)
// =============================================================================

interface ExportMetadata {
  version: string;
  exportedAt: string;
  journey: {
    id: string;
    slug: string | null;
    name: string;
    description: string | null;
    status: string | null;
    mindstateConfig: unknown;
    transferAllowlist: string[] | null;
    createdAt: string | null;
    updatedAt: string | null;
  };
  references: {
    defaultPipelineSlug: string | null;
  };
}

interface ExportVariable {
  key: string;
  value: unknown;
  description: string | null;
}

interface ExportVariables {
  version: string;
  variables: ExportVariable[];
}

interface ExportMediaItem {
  id: string;
  type: string;
  filename: string;
  originalUrl: string;
  key: string;
  size: number | null;
  mimeType: string | null;
  source: "tracked" | "embedded";
}

interface ExportMediaManifest {
  version: string;
  media: ExportMediaItem[];
  totalSize: number;
  totalCount: number;
}

// =============================================================================
// EMBEDDED MEDIA EXTRACTION
// =============================================================================

interface EmbeddedMedia {
  url: string;
  type: string;
  filename: string;
  nodeId: string;
  field: string;
}

/**
 * Extracts filename from a media URL
 */
function extractFilenameFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    return pathname.split("/").pop() ?? "unknown";
  } catch {
    return url.split("/").pop() ?? "unknown";
  }
}

/**
 * Extracts storage key from a media URL (the path after bucket name)
 */
function extractKeyFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    // Remove leading /journey-media/ prefix
    return pathname.replace(/^\/journey-media\//, "");
  } catch {
    return url.split("/journey-media/").pop() ?? "";
  }
}

/**
 * Extracts embedded media URLs from journey configuration nodes.
 * Scans for media objects in node data fields like `media`, `avatar`, etc.
 */
function extractEmbeddedMedia(config: JourneyConfig): EmbeddedMedia[] {
  const embedded: EmbeddedMedia[] = [];
  const seenUrls = new Set<string>();

  for (const node of config.nodes ?? []) {
    const data = node.data as Record<string, unknown>;

    // Check for media object (message nodes)
    if (data.media && typeof data.media === "object") {
      const media = data.media as Record<string, unknown>;
      if (typeof media.url === "string" && media.url.includes("journey-media")) {
        if (!seenUrls.has(media.url)) {
          seenUrls.add(media.url);
          embedded.push({
            url: media.url,
            type: (media.type as string) ?? "unknown",
            filename: (media.filename as string) ?? extractFilenameFromUrl(media.url),
            nodeId: node.id,
            field: "media",
          });
        }
      }
    }

    // Check for avatarUrl (bot persona nodes)
    if (typeof data.avatarUrl === "string" && data.avatarUrl.includes("journey-media")) {
      if (!seenUrls.has(data.avatarUrl)) {
        seenUrls.add(data.avatarUrl);
        embedded.push({
          url: data.avatarUrl,
          type: "image",
          filename: extractFilenameFromUrl(data.avatarUrl),
          nodeId: node.id,
          field: "avatarUrl",
        });
      }
    }

    // Check for imageUrl (various nodes)
    if (typeof data.imageUrl === "string" && data.imageUrl.includes("journey-media")) {
      if (!seenUrls.has(data.imageUrl)) {
        seenUrls.add(data.imageUrl);
        embedded.push({
          url: data.imageUrl,
          type: "image",
          filename: extractFilenameFromUrl(data.imageUrl),
          nodeId: node.id,
          field: "imageUrl",
        });
      }
    }
  }

  return embedded;
}

// =============================================================================
// EXPORT FUNCTIONS
// =============================================================================

/**
 * Download a single version as JSON file
 */
export function exportVersion(journeyId: string, versionId: string, versionData: VersionedJourneyData): void {
  const filename = `${journeyId}-${versionId}.json`;
  downloadJson(versionData, filename);
}

/**
 * Export journey as a single zip archive containing structure, content, and metadata files
 *
 * Downloads one file:
 * - {slug}-{date}.zip: Archive containing:
 *   - journey.json: Structure with $content references
 *   - content.json: Extracted text content
 *   - metadata.json: Journey settings and configuration
 *   - variables.json: Journey-scoped variables
 *   - media/manifest.json: Media inventory
 *
 * This format is:
 * - Simple to share (single file)
 * - Easy to backup and import
 * - Complete export of all journey data
 * - Still AI-optimized internally (split structure + content)
 */
export async function exportJourneyAsArchive(journey: JourneyConfigRecord): Promise<void> {
  const timestamp = new Date().toISOString().split("T")[0];
  const baseName = journey.slug || journey.id;

  // Split content from structure and normalize edge styles
  const { structure, content } = optimizeJourneyForExport(journey.configuration, EDGE_STYLE_DEFAULTS);

  // Create structure object with metadata
  const structureData = {
    name: journey.name,
    description: journey.description,
    configuration: structure,
  };

  // Fetch additional data via API (run in parallel)
  const [journeyVariables, mediaItems] = await Promise.all([
    variablesApi.getJourneyVariables(journey.id).catch(() => [] as JourneyVariable[]),
    mediaApi.getMediaGallery(journey.id).catch(() => [] as MediaItem[]),
  ]);

  // Create metadata.json
  const metadata: ExportMetadata = {
    version: "2.0",
    exportedAt: new Date().toISOString(),
    journey: {
      id: journey.id,
      slug: journey.slug ?? null,
      name: journey.name,
      description: journey.description ?? null,
      status: journey.status ?? null,
      mindstateConfig: journey.mindstateConfig ?? null,
      transferAllowlist: journey.transferAllowlist ?? null,
      createdAt: journey.createdAt,
      updatedAt: journey.updatedAt,
    },
    references: {
      // Note: defaultPipelineSlug would need to be added to JourneyConfigRecord
      // For now, we don't have pipeline slug in the frontend API response
      defaultPipelineSlug: null,
    },
  };

  // Create variables.json
  const variablesData: ExportVariables = {
    version: "1.0",
    variables: journeyVariables.map((v) => ({
      key: v.key,
      value: v.value,
      description: v.description,
    })),
  };

  // Extract embedded media from journey configuration
  const embeddedMedia = extractEmbeddedMedia(journey.configuration);
  const trackedUrls = new Set(mediaItems.map((m) => m.url));

  // Combine tracked media (from API) with embedded media (from node data)
  const allMedia: ExportMediaItem[] = [
    // Tracked media from API (limited info - no size/mimeType/key available)
    ...mediaItems.map((m) => ({
      id: m.id,
      type: m.type,
      filename: m.filename,
      originalUrl: m.url,
      key: extractKeyFromUrl(m.url),
      size: null, // Not available from current API
      mimeType: null, // Not available from current API
      source: "tracked" as const,
    })),
    // Embedded media from node data (exclude already tracked ones)
    ...embeddedMedia
      .filter((e) => !trackedUrls.has(e.url))
      .map((e, idx) => ({
        id: `embedded-${idx}`,
        type: e.type,
        filename: e.filename,
        originalUrl: e.url,
        key: extractKeyFromUrl(e.url),
        size: null,
        mimeType: null,
        source: "embedded" as const,
      })),
  ];

  // Create media/manifest.json
  const mediaManifest: ExportMediaManifest = {
    version: "1.0",
    media: allMedia,
    totalSize: 0, // Size not available from current API
    totalCount: allMedia.length,
  };

  // Create zip archive
  const zip = new JSZip();
  zip.file("journey.json", JSON.stringify(structureData, null, 2));
  zip.file("content.json", JSON.stringify(content, null, 2));
  zip.file("metadata.json", JSON.stringify(metadata, null, 2));
  zip.file("variables.json", JSON.stringify(variablesData, null, 2));
  zip.file("media/manifest.json", JSON.stringify(mediaManifest, null, 2));

  // Generate and download
  const blob = await zip.generateAsync({ type: "blob" });
  downloadBlob(blob, `${baseName}-${timestamp}.zip`);
}

// =============================================================================
// IMPORT TYPES AND HELPERS
// =============================================================================

/**
 * Import result type
 */
export interface ImportResult {
  success: boolean;
  journeyId?: string;
  error?: string;
  /** Warnings about data that couldn't be fully imported (e.g., media files) */
  warnings?: string[];
  /** Number of variables imported */
  variablesImported?: number;
}

/**
 * Parsed and validated journey data ready for import
 */
interface ValidatedJourneyData {
  name: string;
  description?: string;
  configuration: JourneyConfig;
}

/**
 * Result of validation - either success with data or failure with error
 */
type ValidationResult =
  | { success: true; data: ValidatedJourneyData }
  | { success: false; error: string };

/**
 * Parse and validate journey structure and content JSON strings
 *
 * This helper centralizes validation logic for archive imports:
 * - JSON parsing
 * - Name/description sanitization (XSS prevention)
 * - Schema validation with Zod
 * - Content merging
 *
 * @param structureJson - The journey structure JSON string
 * @param contentJson - The content JSON string
 * @param sourceLabel - Label for error messages (e.g., "journey.json")
 */
function validateAndMergeJourneyData(
  structureJson: string,
  contentJson: string,
  sourceLabel: string
): ValidationResult {
  // Parse structure JSON
  let structureData: unknown;
  try {
    structureData = JSON.parse(structureJson);
  } catch {
    return { success: false, error: `Invalid JSON in ${sourceLabel}` };
  }

  // Validate structure is an object
  if (!structureData || typeof structureData !== "object") {
    return { success: false, error: "Invalid structure file format" };
  }

  const structureObj = structureData as Record<string, unknown>;

  // Validate name (required)
  if (typeof structureObj.name !== "string" || structureObj.name.trim().length === 0) {
    return { success: false, error: `Journey name is required in ${sourceLabel}` };
  }

  // Sanitize name (prevent XSS/injection, limit length)
  const name = structureObj.name.trim().slice(0, 200);
  if (/<script|javascript:|on\w+=/i.test(name)) {
    return { success: false, error: "Invalid characters in journey name" };
  }

  // Validate description (optional)
  let description: string | undefined;
  if (structureObj.description != null) {
    if (typeof structureObj.description !== "string") {
      return { success: false, error: "Description must be a string" };
    }
    description = structureObj.description.trim().slice(0, 1000);
    if (/<script|javascript:|on\w+=/i.test(description)) {
      return { success: false, error: "Invalid characters in description" };
    }
  }

  // Validate configuration exists
  if (!structureObj.configuration) {
    return { success: false, error: `Configuration is required in ${sourceLabel}` };
  }

  // Validate structure configuration with Zod
  const structureConfigResult = JourneyConfigSchema.safeParse(structureObj.configuration);
  if (!structureConfigResult.success) {
    const issue = structureConfigResult.error.issues[0];
    const path = issue?.path.join(".") || "unknown";
    const message = issue?.message || "Invalid data";
    return {
      success: false,
      error: `Invalid structure at ${path}: ${message}`,
    };
  }

  // Parse content JSON
  let contentData: unknown;
  try {
    contentData = JSON.parse(contentJson);
  } catch {
    return { success: false, error: "Invalid JSON in content file" };
  }

  // Validate content file with Zod
  const contentResult = JourneyContentSchema.safeParse(contentData);
  if (!contentResult.success) {
    const issue = contentResult.error.issues[0];
    const path = issue?.path.join(".") || "unknown";
    const message = issue?.message || "Invalid data";
    return {
      success: false,
      error: `Invalid content at ${path}: ${message}`,
    };
  }

  // Merge structure with content and add edge styles
  let configuration: JourneyConfig;
  try {
    configuration = restoreJourneyFromExport(
      structureConfigResult.data,
      contentResult.data,
      EDGE_STYLE_DEFAULTS
    );
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to merge content with structure",
    };
  }

  return {
    success: true,
    data: { name, description, configuration },
  };
}

// =============================================================================
// IMPORT FUNCTIONS
// =============================================================================

/**
 * Import a journey from a zip archive containing structure, content, and metadata files
 *
 * The archive must contain:
 * - journey.json: Structure file with name, description, and configuration
 * - content.json: Content file with text values
 *
 * The archive may optionally contain:
 * - metadata.json: Journey settings and configuration (v2.0 format)
 * - variables.json: Journey-scoped variables
 * - media/manifest.json: Media inventory (warning only - files need re-uploading)
 *
 * Validates:
 * - JSON structure for both required files
 * - Required fields (name, configuration in structure; content in content file)
 * - Configuration and content schemas with Zod
 * - String sanitization (XSS prevention)
 *
 * @param archiveFile - The zip archive file (.zip)
 */
export async function importJourneyFromArchive(archiveFile: File): Promise<ImportResult> {
  try {
    // Load and parse the zip archive
    let zip: JSZip;
    try {
      zip = await JSZip.loadAsync(archiveFile);
    } catch {
      return { success: false, error: "Invalid zip archive" };
    }

    // Extract journey.json (required)
    const journeyFile = zip.file("journey.json");
    if (!journeyFile) {
      return { success: false, error: "Archive missing journey.json" };
    }

    // Extract content.json (required)
    const contentFile = zip.file("content.json");
    if (!contentFile) {
      return { success: false, error: "Archive missing content.json" };
    }

    // Extract optional enhanced files
    const variablesFile = zip.file("variables.json");
    const mediaManifestFile = zip.file("media/manifest.json");

    // Read required files from archive
    const structureJson = await journeyFile.async("string");
    const contentJson = await contentFile.async("string");

    // Validate and merge
    const validationResult = validateAndMergeJourneyData(
      structureJson,
      contentJson,
      "journey.json"
    );

    if (!validationResult.success) {
      return { success: false, error: validationResult.error };
    }

    // Create journey via API
    const journey = await journeysApi.createJourney(validationResult.data);

    // Track results
    const warnings: string[] = [];
    let variablesImported = 0;

    // Import variables if present
    if (variablesFile) {
      try {
        const variablesJson = await variablesFile.async("string");
        const varsData = JSON.parse(variablesJson) as ExportVariables;

        if (varsData.variables && Array.isArray(varsData.variables)) {
          for (const v of varsData.variables) {
            try {
              await variablesApi.setJourneyVariable(
                journey.id,
                v.key,
                v.value,
                v.description ?? undefined
              );
              variablesImported++;
            } catch {
              warnings.push(`Failed to import variable: ${v.key}`);
            }
          }
        }
      } catch {
        warnings.push("Failed to parse variables.json");
      }
    }

    // Check media manifest and add warning if media exists
    if (mediaManifestFile) {
      try {
        const mediaJson = await mediaManifestFile.async("string");
        const manifest = JSON.parse(mediaJson) as ExportMediaManifest;

        if (manifest.media && manifest.media.length > 0) {
          warnings.push(
            `${manifest.media.length} media file(s) need re-uploading. ` +
            `Files: ${manifest.media.map((m) => m.filename).join(", ")}`
          );
        }
      } catch {
        // Ignore parsing errors for optional file
      }
    }

    return {
      success: true,
      journeyId: journey.id,
      variablesImported,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to import journey",
    };
  }
}
