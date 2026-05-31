/**
 * Seed Test Database Script
 *
 * Seeds the test database with minimal data required for tests:
 * - Test users (via Better Auth API)
 * - Test organizations
 * - Basic journey templates
 * - Test bot channel
 * - Tag definitions
 * - CRM pipelines
 *
 * Run with: NODE_ENV=test pnpm db:test:seed
 *
 * NOTE: The API server should be running for user creation.
 */

import { createLogger, serializeError } from "@journey/logger";
import "dotenv/config";

const log = createLogger("db:test:seed");

// Force test environment
if (process.env.NODE_ENV !== "test") {
  log.error("This script can only run in test environment.");
  log.error("Set NODE_ENV=test before running.");
  process.exit(1);
}

// Now import database client (will use test DB)
import { closeDatabaseConnection } from "../client";

// Import seed functions (they will use test DB connection)
import { seedChannelUsers } from "../seed/seed-clients";
import { seedDefaultPipelines } from "../seed/seed-crm";
import { seedJourneyConfigs } from "../seed/seed-journeys";
import { seedOrganisationsAndJourneys } from "../seed/seed-organizations";
import { seedTestBot, seedTestSessions } from "../seed/seed-sessions";
import { seedTagDefinitions } from "../seed/seed-tags";
import { seedUsers } from "../seed/seed-users";
import { seedVariables } from "../seed/seed-variables";

async function main() {
  log.info("🌱 Starting TEST database seed...");
  log.warn({ database: "TEST" }, "Seeding test database");

  try {
    // Seed users first (required for organizations)
    log.info("1/8 Seeding users...");
    await seedUsers();

    // Seed organizations and link users
    log.info("2/8 Seeding organizations...");
    await seedOrganisationsAndJourneys();

    // Seed journey configs
    log.info("3/8 Seeding journey configs...");
    await seedJourneyConfigs();

    // Seed test bot channel
    log.info("4/8 Seeding test bot...");
    await seedTestBot();

    // Seed channel users (test clients)
    log.info("5/8 Seeding channel users...");
    await seedChannelUsers();

    // Seed tag definitions
    log.info("6/8 Seeding tag definitions...");
    await seedTagDefinitions();

    // Seed CRM pipelines
    log.info("7/8 Seeding CRM pipelines...");
    await seedDefaultPipelines();

    // Seed variables
    log.info("8/8 Seeding variables...");
    await seedVariables();

    log.info("✅ Test database seed completed successfully!");
  } catch (error) {
    log.error({ err: serializeError(error) }, "seed:error");
    process.exit(1);
  } finally {
    await closeDatabaseConnection();
  }
}

main();
