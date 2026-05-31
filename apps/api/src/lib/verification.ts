/**
 * Verification Helpers
 *
 * Shared authorization/ownership checks used by services and routes.
 *
 * @module lib/verification
 */

import { db, type DbClient } from "@journey/db";
import { journeys } from "@journey/db/schema";
import { createLogger, serializeError } from "@journey/logger";
import { isJourneyUuid, type JourneyIdOrSlug, type JourneyUuid } from "@journey/schemas";
import { and, eq } from "drizzle-orm";

const log = createLogger("verification");

/**
 * Verify a journey belongs to an organization and return its UUID.
 * Supports both UUID and slug for flexible URL handling.
 */
export async function verifyJourneyOrganization(
  journeyIdOrSlug: JourneyIdOrSlug,
  organizationId: string,
  dbClient: DbClient = db
): Promise<JourneyUuid | null> {
  try {
    const isUUID = isJourneyUuid(journeyIdOrSlug);

    const results = await dbClient
      .select({ id: journeys.id })
      .from(journeys)
      .where(
        and(
          isUUID ? eq(journeys.id, journeyIdOrSlug) : eq(journeys.slug, journeyIdOrSlug),
          eq(journeys.organizationId, organizationId)
        )
      );

    const id = results[0]?.id;
    return id && isJourneyUuid(id) ? id : null;
  } catch (error) {
    log.error(
      { journeyIdOrSlug, organizationId, err: serializeError(error) },
      "verification:verifyJourneyOrganization:error"
    );
    return null;
  }
}
