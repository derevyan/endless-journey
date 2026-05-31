/**
 * Journey Export Script
 *
 * Exports a journey from the database to seed files.
 * Creates five files in the seed directory:
 * - journey.json: Structure with $content: references (direct format)
 * - content.json: Extracted text content
 * - metadata.json: Journey settings and configuration
 * - variables.json: Journey-scoped variables
 * - media/manifest.json: Media inventory
 *
 * Run with: pnpm --filter @journey/db export:journey <slug>
 *
 * @module db/export-journey
 */

import { createLogger, serializeError } from "@journey/logger";
import "dotenv/config";
import { db, closeDatabaseConnection } from "./client";
import { journeys, variables, journeyMedia, crmPipelines } from "./schema";
import { optimizeJourneyForExport, type JourneyConfig } from "@journey/schemas";
import { EDGE_STYLE_DEFAULTS } from "../../../apps/web/src/features/nodes/journey/config/node-theme";
import { eq, and } from "drizzle-orm";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve } from "path";

const log = createLogger("db:export:journey");

// =============================================================================
// EXPORT FILE TYPES
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
    transferAllowlistSlugs: string[] | null;
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

// =============================================================================
// MAIN EXPORT FUNCTION
// =============================================================================

async function main() {
  const slug = process.argv[2];

  if (!slug) {
    console.error("Usage: pnpm --filter @journey/db export:journey <slug>");
    console.error("");
    console.error("Examples:");
    console.error("  pnpm --filter @journey/db export:journey saas-onboarding");
    process.exit(1);
  }

  log.info({ slug }, "export:starting");

  try {
    // 1. Query journey by slug
    const [journey] = await db.select().from(journeys).where(eq(journeys.slug, slug)).limit(1);

    if (!journey) {
      throw new Error(`Journey not found: ${slug}`);
    }

    log.info({ journeyId: journey.id, name: journey.name }, "export:journeyFound");

    // 2. Query pipeline slug if defaultPipelineId exists
    let defaultPipelineSlug: string | null = null;
    if (journey.defaultPipelineId) {
      const [pipeline] = await db
        .select({ slug: crmPipelines.slug })
        .from(crmPipelines)
        .where(eq(crmPipelines.id, journey.defaultPipelineId))
        .limit(1);
      defaultPipelineSlug = pipeline?.slug ?? null;
    }

    // 3. Query journey variables (scope="journey", ownerId=journeyId)
    const journeyVariables = await db
      .select({
        key: variables.key,
        value: variables.value,
        description: variables.description,
      })
      .from(variables)
      .where(and(eq(variables.scope, "journey"), eq(variables.ownerId, journey.id)));

    // 4. Query journey media
    const mediaItems = await db
      .select({
        id: journeyMedia.id,
        type: journeyMedia.type,
        filename: journeyMedia.filename,
        url: journeyMedia.url,
        key: journeyMedia.key,
        size: journeyMedia.size,
        mimeType: journeyMedia.mimeType,
      })
      .from(journeyMedia)
      .where(eq(journeyMedia.journeyId, journey.id));

    // 5. Resolve transfer allowlist IDs to slugs
    let transferAllowlistSlugs: string[] | null = null;
    if (journey.transferAllowlist && journey.transferAllowlist.length > 0) {
      const allowlistJourneys = await db
        .select({ id: journeys.id, slug: journeys.slug })
        .from(journeys)
        .where(
          // Query all journeys in the allowlist
          eq(journeys.organizationId, journey.organizationId)
        );

      const idToSlugMap = new Map(allowlistJourneys.map((j) => [j.id, j.slug]));
      transferAllowlistSlugs = journey.transferAllowlist
        .map((id) => idToSlugMap.get(id))
        .filter((s): s is string => s !== null && s !== undefined);
    }

    // 6. Split content and normalize edge styles
    const { structure, content } = optimizeJourneyForExport(
      journey.configuration as JourneyConfig,
      EDGE_STYLE_DEFAULTS
    );

    // 7. Determine output directory
    const outputDir = resolve(import.meta.dirname, `../../../apps/web/src/data/journeys/${slug}`);

    // Ensure output directory exists
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    // 8. Write journey.json (direct format: { nodes, edges } for seed consistency)
    const journeyPath = resolve(outputDir, "journey.json");
    writeFileSync(journeyPath, JSON.stringify(structure, null, 2));

    // 9. Write content.json
    const contentPath = resolve(outputDir, "content.json");
    writeFileSync(contentPath, JSON.stringify(content, null, 2));

    // 10. Write metadata.json
    const metadata: ExportMetadata = {
      version: "2.0",
      exportedAt: new Date().toISOString(),
      journey: {
        id: journey.id,
        slug: journey.slug,
        name: journey.name,
        description: journey.description,
        status: journey.status,
        mindstateConfig: journey.mindstateConfig,
        transferAllowlist: journey.transferAllowlist,
        createdAt: journey.createdAt?.toISOString() ?? null,
        updatedAt: journey.updatedAt?.toISOString() ?? null,
      },
      references: {
        defaultPipelineSlug,
        transferAllowlistSlugs,
      },
    };
    const metadataPath = resolve(outputDir, "metadata.json");
    writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

    // 11. Write variables.json
    const variablesData: ExportVariables = {
      version: "1.0",
      variables: journeyVariables.map((v) => ({
        key: v.key,
        value: v.value,
        description: v.description,
      })),
    };
    const variablesPath = resolve(outputDir, "variables.json");
    writeFileSync(variablesPath, JSON.stringify(variablesData, null, 2));

    // 12. Write media/manifest.json
    const mediaDir = resolve(outputDir, "media");
    if (!existsSync(mediaDir)) {
      mkdirSync(mediaDir, { recursive: true });
    }

    // Extract embedded media from journey configuration
    const embeddedMedia = extractEmbeddedMedia(journey.configuration as JourneyConfig);
    const trackedUrls = new Set(mediaItems.map((m) => m.url));

    // Combine tracked media (from journey_media table) with embedded media (from node data)
    const allMedia: ExportMediaItem[] = [
      // Tracked media from database
      ...mediaItems.map((m) => ({
        id: m.id,
        type: m.type,
        filename: m.filename,
        originalUrl: m.url,
        key: m.key,
        size: m.size,
        mimeType: m.mimeType,
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

    const mediaManifest: ExportMediaManifest = {
      version: "1.0",
      media: allMedia,
      totalSize: mediaItems.reduce((sum, m) => sum + (m.size ?? 0), 0),
      totalCount: allMedia.length,
    };
    const mediaManifestPath = resolve(mediaDir, "manifest.json");
    writeFileSync(mediaManifestPath, JSON.stringify(mediaManifest, null, 2));

    const trackedCount = mediaItems.length;
    const embeddedCount = allMedia.length - trackedCount;

    log.info({ slug, outputDir }, "export:completed");
    console.log(`✅ Exported "${journey.name}" (${slug}) to seed files:`);
    console.log(`   📄 ${journeyPath}`);
    console.log(`   📄 ${contentPath}`);
    console.log(`   📄 ${metadataPath}`);
    console.log(`   📄 ${variablesPath}`);
    console.log(`   📄 ${mediaManifestPath}`);
    console.log("");
    console.log(
      `   📊 ${journeyVariables.length} variable(s), ${allMedia.length} media file(s)` +
        (embeddedCount > 0 ? ` (${trackedCount} tracked, ${embeddedCount} embedded)` : "")
    );
    console.log("");
    console.log("Next steps:");
    console.log("   pnpm db:reset-full  # Reset database with updated seed");
  } catch (error) {
    log.error({ err: serializeError(error), slug }, "export:error");
    console.error(`❌ Export failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    process.exit(1);
  } finally {
    await closeDatabaseConnection();
  }
}

main();
