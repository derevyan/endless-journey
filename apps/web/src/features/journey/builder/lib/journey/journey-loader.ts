import type { JourneyConfig } from "@/features/nodes/journey/react-flow-types";
import { EDGE_STYLE_DEFAULTS } from "@/features/nodes/journey/config/node-theme";
import { createLogger, serializeError } from "@journey/logger";
import {
  JourneyConfigSchema,
  JourneyContentSchema,
  ManifestSchema,
  restoreJourneyFromExport,
} from "@journey/schemas";

// Dynamic imports using Vite's import.meta.glob
// This allows adding new journeys without modifying source code
const journeyModules = import.meta.glob<{ default: unknown }>(
  "@/data/journeys/*/journey.json",
  { eager: false }
);
const contentModules = import.meta.glob<{ default: unknown }>(
  "@/data/journeys/*/content.json",
  { eager: false }
);
const manifestModule = () =>
  import("@/data/journeys/manifest.json") as Promise<{ default: unknown }>;

const log = createLogger("journey-loader");

/**
 * Loads and validates a journey configuration from JSON
 *
 * Journeys are stored in split format:
 * - journey.json: Structure with $content: references (no inline content)
 * - content.json: All text content keyed by path
 *
 * This function loads both files, merges them, and returns the full configuration.
 */
export async function loadJourneyConfig(
  journeyId: string
): Promise<JourneyConfig> {
  try {
    log.info({ journeyId }, "loadJourneyConfig:start");

    // Find the journey structure file
    const journeyPath = Object.keys(journeyModules).find((path) =>
      path.includes(`/${journeyId}/journey.json`)
    );
    if (!journeyPath) {
      throw new Error(`Journey "${journeyId}" not found`);
    }

    // Find the content file
    const contentPath = Object.keys(contentModules).find((path) =>
      path.includes(`/${journeyId}/content.json`)
    );
    if (!contentPath) {
      throw new Error(`Content file for journey "${journeyId}" not found`);
    }

    // Load both files
    const [structureModule, contentModule] = await Promise.all([
      journeyModules[journeyPath](),
      contentModules[contentPath](),
    ]);

    // Validate structure (with $content: references)
    const structureData = structureModule.default;
    const validatedStructure = JourneyConfigSchema.parse(structureData);

    // Validate content
    const contentData = contentModule.default;
    const validatedContent = JourneyContentSchema.parse(contentData);

    // Merge structure with content (resolves $content: refs, adds edge styles)
    const merged = restoreJourneyFromExport(
      validatedStructure,
      validatedContent,
      EDGE_STYLE_DEFAULTS
    );

    log.debug(
      {
        journeyId,
        nodes: merged.nodes.length,
        edges: merged.edges.length,
        contentEntries: Object.keys(validatedContent.content).length,
      },
      "loadJourneyConfig:success"
    );

    // Cast is safe - zod validated the structure, types differ only in enum vs literal representation
    return merged as unknown as JourneyConfig;
  } catch (error) {
    log.error({ journeyId, err: serializeError(error) }, "loadJourneyConfig:error");
    if (error instanceof Error) {
      throw new Error(`Invalid journey configuration: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Lists available journeys from manifest
 */
export async function listAvailableJourneys(): Promise<
  Array<{ id: string; name: string; description?: string }>
> {
  try {
    log.info("listAvailableJourneys:start");
    const module = await manifestModule();
    const validated = ManifestSchema.parse(module.default);
    log.debug({ journeys: validated.journeys.length }, "listAvailableJourneys:success");
    return validated.journeys;
  } catch (error) {
    log.error({ err: serializeError(error) }, "listAvailableJourneys:error");
    if (error instanceof Error) {
      throw new Error(`Invalid manifest: ${error.message}`);
    }
    throw error;
  }
}
