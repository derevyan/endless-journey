/**
 * Demo Database Seed Script
 *
 * Seeds sample data for development:
 * - All core seeds (users, organizations, journeys)
 * - MindState definitions
 * - CRM pipelines and stages
 * - Variables (global and journey-specific)
 * - Tag definitions
 * - Demo agent workflows
 *
 * Use `pnpm db:seed:demo` for development environments.
 *
 * @module seed/demo
 */

import { createLogger, serializeError } from "@journey/logger";
import "dotenv/config";
import { closeDatabaseConnection } from "../client";

// Core seeds
import { runCoreSeeds } from "./core";

// Demo seed functions
import { seedAdditionalPipelines, seedDefaultPipelines } from "./seed-crm";
import { seedMindstateDefinitions } from "./seed-mindstate";
import { seedPrompts } from "./seed-prompts";
import { seedTagDefinitions } from "./seed-tags";
import { seedVariables } from "./seed-variables";
import { seedWorkflows } from "./seed-workflows";

// Import data for logging
import { GLOBAL_TAG_DEFINITIONS, GLOBAL_VARIABLES, JOURNEY_VARIABLES } from "./data";

const log = createLogger("db:seed:demo");

// =============================================================================
// DEMO SEEDING
// =============================================================================

/**
 * Run demo seeds - sample data for development
 * Includes all core seeds plus development sample data
 */
export async function runDemoSeeds() {
  log.info("🌱 Running demo seeds...");

  // Run core seeds first
  await runCoreSeeds();

  // Demo agent workflows
  await seedWorkflows();

  // MindState definitions for all organizations
  await seedMindstateDefinitions();

  // System prompts (Voice Director, etc.)
  await seedPrompts();

  // CRM pipelines for all organizations
  await seedDefaultPipelines();
  await seedAdditionalPipelines();

  // Variables (global and journey-specific)
  await seedVariables();

  // Tag definitions (organization-level tag registry)
  await seedTagDefinitions();

  log.info("✅ Demo seeding completed!");
}

// =============================================================================
// MAIN (when run directly)
// =============================================================================

async function main() {
  log.info("🚀 Starting demo database seed...");

  try {
    await runDemoSeeds();

    log.info("📝 Demo seed completed. Development data ready.");
    log.info("📝 Variables:");
    log.info(`   Global: ${GLOBAL_VARIABLES.length} variables`);
    log.info(`   Journey: ${JOURNEY_VARIABLES.length} variables`);
    log.info("📝 Tags:");
    log.info(`   ${GLOBAL_TAG_DEFINITIONS.length} tags defined`);
    log.info("📝 CRM Pipelines:");
    log.info("   Sales Pipeline, Support Pipeline, Partner Onboarding");
    log.info("📝 MindState:");
    log.info("   Default Companion with 4 agents and 9 state parameters");
    log.info("📝 Prompts:");
    log.info("   voice-director-v3, voice-director-v2 (TTS optimization)");
    log.info("📝 Agent Workflows:");
    log.info("   Demo Assistant, Multi-Agent Router");
    log.info("   Run `pnpm db:seed` for full seeding including E2E test data.");
  } catch (error) {
    log.error({ err: serializeError(error) }, "seed:demo:error");
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
