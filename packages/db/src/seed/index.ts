/**
 * Database Seed Script
 *
 * Full database seeding including:
 * - Core: Users, organizations, journeys
 * - Demo: MindState, CRM pipelines, variables, tags, workflows
 * - E2E: Test bots, clients, sessions, interactions
 *
 * Seed commands:
 * - `pnpm db:seed:core` - Minimal seeds (users + orgs)
 * - `pnpm db:seed:demo` - Development sample data
 * - `pnpm db:seed` - Full seeding including E2E data
 *
 * @module seed
 */

import { createLogger, serializeError } from "@journey/logger";
import "dotenv/config";
import { closeDatabaseConnection } from "../client";

// Demo seeds (includes core seeds)
import { runDemoSeeds } from "./demo";

// E2E seed functions
import { seedChannelUsers } from "./seed-clients";
import { seedClientStageAssignments } from "./seed-crm";
import { seedJourneyConfigs } from "./seed-journeys";
import { seedInteractions, seedNodeOutputs, seedTestBot, seedTestSessions } from "./seed-sessions";
import { seedTagAssignments } from "./seed-tags";

// Import data for logging
import { GLOBAL_TAG_DEFINITIONS, GLOBAL_VARIABLES, JOURNEY_VARIABLES } from "./data";

const log = createLogger("db:seed");

// =============================================================================
// E2E SEEDING
// =============================================================================

/**
 * Run E2E seeds - heavy test data for end-to-end testing
 * Requires demo seeds to be run first
 */
async function runE2ESeeds() {
  log.info("🧪 Running E2E seeds...");

  // Update journey metadata
  await seedJourneyConfigs();

  // Seed test bot for E2E tests
  const channelId = await seedTestBot();

  if (channelId) {
    await seedChannelUsers();
    await seedTestSessions(channelId);
    await seedInteractions();
    await seedNodeOutputs();
    await seedTagAssignments();
    await seedClientStageAssignments();
  }

  log.info("✅ E2E seeding completed!");
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  log.info("🚀 Starting full database seed...");

  try {
    // Run demo seeds (includes core seeds)
    await runDemoSeeds();

    // Run E2E seeds on top
    await runE2ESeeds();

    log.info("✅ Database seeding completed!");
    log.info("📝 Demo User Credentials:");
    log.info("   Email: demo@journey.app");
    log.info("   Password: demo1234");
    log.info("   Journeys: SaaS Onboarding Demo, Starter Template");
    log.info("📝 Arina User Credentials:");
    log.info("   Email: arina@journey.app");
    log.info("   Password: arina1234");
    log.info("   Journeys: SaaS Onboarding Demo, Customer Support Triage, Questionnaire Demo");
    log.info("📝 Default User Credentials (development testing):");
    log.info("   Email: default@journey.app");
    log.info("   Password: default1234");
    log.info("   Journeys: SaaS Onboarding Demo, Starter Template");
    log.info("📝 Test Data for E2E (Users Viewer):");
    log.info("   Bot: @journey_test_bot");
    log.info("   Channel Users: 10 diverse test users (Alice, Bob, Charlie, Diana, Anonymous, Emma, Frank, Grace, Henry, Isabel)");
    log.info("   Sessions: Multiple sessions across different journeys (active, completed, dropped, paused)");
    log.info("   Interactions: Path history for each session");
    log.info("📝 Variables:");
    log.info(`   Global: ${GLOBAL_VARIABLES.length} variables (total_conversions, loyalty_multiplier, feature_flags, promo_codes, badge_definitions)`);
    log.info(
      `   Journey: ${JOURNEY_VARIABLES.length} variables (journey_starts, plan_selections, avg_completion_time_hours, conversion_rate, feedback_responses)`
    );
    log.info("📝 Tags:");
    log.info(`   ${GLOBAL_TAG_DEFINITIONS.length} tags (VIP, beta-tester, newsletter, customer, churned, enterprise, referrer, early-adopter, nps:*)`);
    log.info("   Tags assigned to test users (Alice=VIP+beta-tester, Bob=customer+newsletter, etc.)");
    log.info("📝 CRM Pipelines:");
    log.info("   Sales Pipeline: 7 stages (Unassigned, Lead, Qualified, Proposal, Negotiation, Closed Won, Closed Lost)");
    log.info("   Support Pipeline: 6 stages (Unassigned, New Ticket, In Progress, Awaiting Response, Resolved, Closed)");
    log.info("   Partner Onboarding: 7 stages (Unassigned, Applied, Reviewing, Approved, Onboarding, Active Partner, Inactive)");
    log.info("   System stages: Unassigned (cannot be deleted)");
    log.info("   Client assignments: 10 clients distributed across all pipelines");
    log.info("📝 MindState:");
    log.info("   Default Companion: AI companion tracking emotional, cognitive, and motivational states");
    log.info("   4 System Agents: General Observer, Emotion Analyzer, Cognitive Analyst, Motivation Tracker");
    log.info("   9 State Parameters: Mood, Stress, Energy, Focus, Cognitive Load, Interest, Urgency, Rapport, Topic Familiarity");
    log.info("📝 Agent Workflows:");
    log.info("   Demo Assistant: Simple single-agent workflow (Start → Agent → End)");
    log.info("   Multi-Agent Router: Intent routing workflow (Guard → Router → If/Else → Support/Sales → End)");
    log.info("   Available for: demo@journey.app, default@journey.app");
    log.info("📝 Test Users:");
    log.info("   Users created directly in database with hashed passwords");
  } catch (error) {
    log.error({ err: serializeError(error) }, "seed:error");
    process.exit(1);
  } finally {
    await closeDatabaseConnection();
  }
}

main();
