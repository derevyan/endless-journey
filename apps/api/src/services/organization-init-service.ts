/**
 * Organization Initialization Service
 *
 * Handles automatic provisioning of default resources when a new organization is created.
 * This includes:
 * - Default CRM pipeline with standard stages
 * - Demo "Starter Template" journey
 * - Default MindState definition
 *
 * This service is called via Better Auth's organizationHooks.afterCreateOrganization
 * and ensures every new organization has a consistent starting point.
 *
 * @module services/organization-init-service
 */

import { createLogger, serializeError } from "@journey/logger";
import { JourneyConfigSchema } from "@journey/schemas";

import { createServicesForOrganization } from "./create-services";

// Import the Starter Template journey configuration
import starterTemplateJourney from "../../../web/src/data/journeys/starter-template/journey.json";

const log = createLogger("organization-init");

const starterTemplateConfig = JourneyConfigSchema.parse(starterTemplateJourney);

/**
 * Demo journey configuration for new organizations
 */
const DEMO_JOURNEY = {
  name: "Starter Template",
  description: "A simple 3-step journey to get you started. Edit this or create your own!",
  configuration: starterTemplateConfig,
};

/**
 * Initialize a new organization with default resources
 *
 * This function is idempotent - safe to call multiple times.
 * Errors are logged but don't block organization creation.
 *
 * @param organizationId - The ID of the newly created organization
 * @param userId - The ID of the user who created the organization (creator/owner)
 */
export async function initializeOrganization(organizationId: string, userId: string): Promise<void> {
  log.info({ organizationId, userId }, "organizationInit:start");

  const results = {
    pipeline: false,
    journey: false,
    mindstate: false,
  };

  const services = createServicesForOrganization({ organizationId, userId });

  // 1. Create default CRM pipeline
  try {
    await services.crm.ensureDefaultPipeline();
    results.pipeline = true;
    log.debug({ organizationId }, "organizationInit:pipeline:success");
  } catch (error) {
    log.error({ organizationId, err: serializeError(error) }, "organizationInit:pipeline:error");
    // Continue - don't block org creation
  }

  // 2. Create demo journey
  try {
    await services.journey.createJourney(organizationId, userId, {
      name: DEMO_JOURNEY.name,
      description: DEMO_JOURNEY.description,
      configuration: DEMO_JOURNEY.configuration,
    });
    results.journey = true;
    log.debug({ organizationId }, "organizationInit:journey:success");
  } catch (error) {
    log.error({ organizationId, err: serializeError(error) }, "organizationInit:journey:error");
    // Continue - don't block org creation
  }

  // 3. Create default MindState definition
  try {
    await services.mindstate.ensureDefaultMindstate();
    results.mindstate = true;
    log.debug({ organizationId }, "organizationInit:mindstate:success");
  } catch (error) {
    log.error({ organizationId, err: serializeError(error) }, "organizationInit:mindstate:error");
    // Continue - don't block org creation
  }

  log.info({ organizationId, userId, results }, "organizationInit:complete");
}
