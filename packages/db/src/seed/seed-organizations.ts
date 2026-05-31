/**
 * Organization Seeding Module
 *
 * Seeds organizations and assigns journeys to them.
 *
 * @module seed/seed-organizations
 */

import { createLogger } from "@journey/logger";
import { and, eq } from "drizzle-orm";
import { db } from "../client";
import { crmPipelines, journeys, member, organization, user } from "../schema";
import { JOURNEY_CONFIGS, USER_ORG_ASSIGNMENTS } from "./data";

const log = createLogger("db:seed:organizations");

/**
 * Map journey slugs to their appropriate pipeline slugs
 */
const JOURNEY_PIPELINE_MAPPING: Record<string, string> = {
  "saas-onboarding": "sales-pipeline",
  "starter-template": "sales-pipeline",
  "abandoned-cart": "sales-pipeline",
  "support-triage": "support-pipeline",
  "event-registration": "partner-onboarding",
};

/**
 * Seed organisations and assign journeys to them
 */
export async function seedOrganisationsAndJourneys() {
  log.info("🌱 Seeding organisations and journey assignments...");

  for (const [email, config] of Object.entries(USER_ORG_ASSIGNMENTS)) {
    // Look up user by email
    const users = await db.select().from(user).where(eq(user.email, email));

    if (users.length === 0) {
      log.warn({ email }, "seed:userNotFound");
      continue;
    }

    const userId = users[0].id;
    const orgId = `org_${userId}`;
    const orgSlug = `user-${userId}`;

    // Check if organisation already exists
    const existingOrg = await db.select().from(organization).where(eq(organization.id, orgId));

    if (existingOrg.length === 0) {
      // Create organisation
      await db.insert(organization).values({
        id: orgId,
        name: config.orgName,
        slug: orgSlug,
        createdAt: new Date(),
      });
      log.info({ email, orgId, orgName: config.orgName }, "seed:orgCreated");

      // Create owner membership
      await db.insert(member).values({
        id: `mem_${userId}`,
        userId,
        organizationId: orgId,
        role: "owner",
        createdAt: new Date(),
      });
      log.info({ email, orgId, role: "owner" }, "seed:memberCreated");
    } else {
      log.info({ email, orgId }, "seed:orgExists");
    }

    // Create or update journeys for this organisation
    for (const journeyId of config.journeyIds) {
      // Look up journey config by ID
      const journeyConfig = JOURNEY_CONFIGS.find((j) => j.id === journeyId);
      if (!journeyConfig) continue;

      // Check if journey already exists
      const existingJourney = await db.select().from(journeys).where(eq(journeys.id, journeyConfig.id));

      // Get the appropriate pipeline for this journey
      const pipelineSlug = JOURNEY_PIPELINE_MAPPING[journeyConfig.slug ?? ""] || "sales-pipeline";
      const pipeline = await db
        .select()
        .from(crmPipelines)
        .where(and(eq(crmPipelines.organizationId, orgId), eq(crmPipelines.slug, pipelineSlug)))
        .limit(1);

      const defaultPipelineId = pipeline.length > 0 ? pipeline[0].id : null;

      if (existingJourney.length === 0) {
        // Create journey with organizationId and defaultPipelineId inline
        await db.insert(journeys).values({
          id: journeyConfig.id,
          slug: journeyConfig.slug,
          name: journeyConfig.name,
          description: journeyConfig.description,
          status: journeyConfig.status,
          configuration: journeyConfig.configuration,
          organizationId: orgId,
          defaultPipelineId: defaultPipelineId,
          createdBy: userId,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        log.info({ email, journeySlug: journeyConfig.slug, pipelineSlug }, "seed:journeyCreated");
      } else {
        // Journey already exists - update defaultPipelineId if needed
        if (defaultPipelineId) {
          await db
            .update(journeys)
            .set({ defaultPipelineId, updatedAt: new Date() })
            .where(eq(journeys.id, journeyConfig.id));
        }
        log.info({ email, journeySlug: journeyConfig.slug }, "seed:journeyAlreadyExists");
      }
    }
  }
}
