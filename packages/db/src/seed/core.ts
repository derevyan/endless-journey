/**
 * Core Database Seed Script
 *
 * Seeds minimal required data for a working database:
 * - Test users (with properly hashed passwords)
 * - Organizations and journey assignments
 *
 * This is the minimum required for the application to function.
 * Use `pnpm db:seed:core` to run only core seeds.
 *
 * @module seed/core
 */

import { createLogger, serializeError } from "@journey/logger";
import "dotenv/config";
import { closeDatabaseConnection } from "../client";

// Core seed functions
import { seedOrganisationsAndJourneys } from "./seed-organizations";
import { seedUsers } from "./seed-users";

const log = createLogger("db:seed:core");

// =============================================================================
// CORE SEEDING
// =============================================================================

/**
 * Run core seeds only - minimum for application to work
 */
export async function runCoreSeeds() {
  log.info("🌱 Running core seeds...");

  // Users first (required for organizations)
  await seedUsers();

  // Organizations and journeys (required for app functionality)
  await seedOrganisationsAndJourneys();

  log.info("✅ Core seeding completed!");
}

// =============================================================================
// MAIN (when run directly)
// =============================================================================

async function main() {
  log.info("🚀 Starting core database seed...");

  try {
    await runCoreSeeds();

    log.info("📝 Core seed completed. Users and organizations ready.");
    log.info("   Run `pnpm db:seed:demo` for development sample data.");
    log.info("   Run `pnpm db:seed` for full seeding including E2E data.");
  } catch (error) {
    log.error({ err: serializeError(error) }, "seed:core:error");
    process.exit(1);
  } finally {
    await closeDatabaseConnection();
  }
}

// Only run main if this is the entry point (ESM-compatible check)
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  main();
}
