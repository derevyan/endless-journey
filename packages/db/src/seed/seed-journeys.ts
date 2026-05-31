/**
 * Journey Seeding Module
 *
 * Seeds journey configurations and templates.
 *
 * @module seed/seed-journeys
 */

import { createLogger } from "@journey/logger";
import { eq } from "drizzle-orm";
import { db } from "../client";
import { journeys } from "../schema";
import { JOURNEY_CONFIGS } from "./data";

const log = createLogger("db:seed:journeys");

/**
 * Helper function to get journey ID by slug
 * Returns null if journey not found
 */
export async function getJourneyIdBySlug(slug: string): Promise<string | null> {
  const journey = await db.select().from(journeys).where(eq(journeys.slug, slug)).limit(1);
  return journey.length > 0 ? journey[0].id : null;
}

/**
 * Seed journey configurations
 *
 * NOTE: Journey creation now happens in seed-organizations.ts with organizationId.
 * This function only updates existing journeys' metadata.
 */
export async function seedJourneyConfigs() {
  log.info("🌱 Checking journey configurations...");

  // Journey creation is now handled by seedOrganisationsAndJourneys in seed-organizations.ts
  // This function now only handles updates for existing journeys
  for (const journeyData of JOURNEY_CONFIGS) {
    const existingById = await db.select().from(journeys).where(eq(journeys.id, journeyData.id));

    if (existingById.length > 0) {
      // Update existing journey metadata only (NOT configuration - preserve user changes)
      await db
        .update(journeys)
        .set({
          slug: journeyData.slug,
          name: journeyData.name,
          description: journeyData.description,
          // NOTE: configuration is NOT updated to preserve user changes made via UI
          updatedAt: new Date(),
        })
        .where(eq(journeys.id, journeyData.id));
      log.info({ slug: journeyData.slug, name: journeyData.name }, "seed:journeyMetadataUpdated");
    }
    // Journey creation is handled by seed-organizations.ts
  }
}

