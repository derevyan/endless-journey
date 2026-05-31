/**
 * Sessions Seeding Module
 *
 * Seeds test sessions and interactions for E2E testing.
 *
 * @module seed/seed-sessions
 */

import { createLogger } from "@journey/logger";
import { and, eq } from "drizzle-orm";
import { db } from "../client";
import { clients, interactions, journeySessions, messagingChannels, nodeOutputs, user } from "../schema";
import { hashSecret, safeEncrypt } from "../utils";
import { CONSOLE_TABS_TEST_SESSION_ID, TEST_BOT_ID, TEST_INTERACTIONS, TEST_SESSIONS } from "./data";
import { getJourneyIdBySlug } from "./seed-journeys";

const log = createLogger("db:seed:sessions");

/**
 * Seed test bot for the demo user
 * Creates a test bot linked to the SaaS Onboarding journey
 */
export async function seedTestBot(): Promise<string | null> {
  log.info("🌱 Seeding test bot...");

  // Get demo user
  const demoUsers = await db.select().from(user).where(eq(user.email, "demo@journey.app"));
  if (demoUsers.length === 0) {
    log.warn("seed:demoUserNotFound");
    return null;
  }

  const demoUserId = demoUsers[0].id;
  const orgId = `org_${demoUserId}`;

  // Look up the SaaS Onboarding journey by slug to get its actual ID
  const journeyId = await getJourneyIdBySlug("saas-onboarding");
  if (!journeyId) {
    log.warn("seed:saasJourneyNotFound - Skipping test bot creation");
    return null;
  }

  // Check if test bot already exists
  const existing = await db.select().from(messagingChannels).where(eq(messagingChannels.id, TEST_BOT_ID));

  if (existing.length === 0) {
    const botToken = "test_token_12345_not_real";
    await db.insert(messagingChannels).values({
      id: TEST_BOT_ID,
      organizationId: orgId,
      userId: demoUserId,
      platform: "telegram",
      botTokenEncrypted: safeEncrypt(botToken),
      botTokenHash: hashSecret(botToken),
      botUsername: "journey_test_bot",
      botName: "Journey Test Bot",
      defaultJourneyId: journeyId,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    log.info({ channelId: TEST_BOT_ID, botUsername: "journey_test_bot", journeyId }, "seed:testBotCreated");
  } else {
    // Update organizationId and defaultJourneyId if needed
    const updates: { organizationId?: string; defaultJourneyId?: string } = {};
    if (existing[0].organizationId === null) {
      updates.organizationId = orgId;
    }
    if (existing[0].defaultJourneyId !== journeyId) {
      updates.defaultJourneyId = journeyId;
    }
    if (Object.keys(updates).length > 0) {
      await db.update(messagingChannels).set(updates).where(eq(messagingChannels.id, TEST_BOT_ID));
      log.info({ channelId: TEST_BOT_ID, updates }, "seed:testBotUpdated");
    } else {
      log.info({ channelId: TEST_BOT_ID }, "seed:testBotExists");
    }
  }

  return TEST_BOT_ID;
}

/**
 * Seed test sessions for E2E testing
 * Requires test bot and channel users to be seeded first
 */
export async function seedTestSessions(channelId: string) {
  log.info("🌱 Seeding test sessions...");

  // Map session ID prefixes to journey slugs
  const journeyMapping: Record<string, string> = {
    "00000000-0000-0000-2": "saas-onboarding",
    "00000000-0000-0000-3": "abandoned-cart",
    "00000000-0000-0000-4": "support-triage",
    "00000000-0000-0000-5": "saas-onboarding", // Console tabs test session
  };

  const baseTime = new Date();
  baseTime.setHours(baseTime.getHours() - 24); // Sessions started 24 hours ago

  for (const sessionData of TEST_SESSIONS) {
    // Determine which journey this session belongs to based on ID prefix
    const prefix = sessionData.id.substring(0, 19);
    const journeySlug = journeyMapping[prefix] || "saas-onboarding";

    const journeyId = await getJourneyIdBySlug(journeySlug);
    if (!journeyId) {
      log.warn({ journeySlug }, "seed:journeyNotFound - Skipping session");
      continue;
    }

    const existing = await db.select().from(journeySessions).where(eq(journeySessions.id, sessionData.id));

    if (existing.length === 0) {
      // Get the organization ID from the channel
      const channels = await db.select().from(messagingChannels).where(eq(messagingChannels.id, channelId));
      const organizationId = channels[0]?.organizationId;

      if (!organizationId) {
        log.warn({ channelId }, "seed:channelMissingOrg - Skipping session");
        continue;
      }

      const [platformRaw, ...platformUserIdParts] = sessionData.clientId.split("_");
      const platform =
        platformRaw === "telegram" || platformRaw === "whatsapp" || platformRaw === "simulator"
          ? platformRaw
          : "telegram";
      const platformUserId = platformUserIdParts.join("_") || sessionData.clientId;
      const client = await db
        .select({ id: clients.id })
        .from(clients)
        .where(
          and(
            eq(clients.organizationId, organizationId),
            eq(clients.platform, platform),
            eq(clients.platformUserId, platformUserId)
          )
        )
        .limit(1);

      if (client.length === 0) {
        log.warn({ sessionId: sessionData.id, platform, platformUserId }, "seed:clientNotFound - Skipping session");
        continue;
      }

      await db.insert(journeySessions).values({
        id: sessionData.id,
        clientId: client[0].id,
        channelId: channelId,
        journeyId: journeyId,
        organizationId: organizationId,
        currentNodeId: sessionData.currentNodeId,
        status: sessionData.status,
        createdAt: baseTime,
        updatedAt: new Date(),
        completedAt: sessionData.status === "completed" ? new Date() : null,
      });
      log.info({ sessionId: sessionData.id.slice(-4), status: sessionData.status }, "seed:sessionCreated");
    } else {
      // Update existing session status/node data
      await db
        .update(journeySessions)
        .set({
          status: sessionData.status,
          currentNodeId: sessionData.currentNodeId,
          updatedAt: new Date(),
        })
        .where(eq(journeySessions.id, sessionData.id));
      log.info({ sessionId: sessionData.id.slice(-4), status: sessionData.status }, "seed:sessionUpdated");
    }
  }
}

/**
 * Seed test interactions for path visualization
 * Requires test sessions to be seeded first
 */
export async function seedInteractions() {
  log.info("🌱 Seeding test interactions...");

  const baseTime = new Date();
  baseTime.setHours(baseTime.getHours() - 24); // Base time 24 hours ago

  for (const [sessionId, interactionList] of Object.entries(TEST_INTERACTIONS)) {
    // Check if interactions already exist for this session
    const existing = await db.select().from(interactions).where(eq(interactions.sessionId, sessionId));

    if (existing.length > 0) {
      // Delete existing interactions and recreate with updated data
      await db.delete(interactions).where(eq(interactions.sessionId, sessionId));
      log.info({ sessionId: sessionId.slice(-4), count: existing.length }, "seed:replacingInteractions");
    }

    let interactionCount = 0;
    for (const interaction of interactionList) {
      const timestamp = new Date(baseTime.getTime() + interaction.offsetMinutes * 60 * 1000);

      await db.insert(interactions).values({
        sessionId: sessionId,
        type: interaction.type,
        nodeId: interaction.nodeId,
        payload: interaction.payload,
        timestamp: timestamp,
      });
      interactionCount++;
    }

    log.info({ sessionId: sessionId.slice(-4), count: interactionCount }, "seed:interactionsCreated");
  }
}

/**
 * Seed test node outputs for Outputs tab testing
 * Seeds outputs for the console tabs test session
 */
export async function seedNodeOutputs() {
  log.info("🌱 Seeding test node outputs...");

  // Check if outputs already exist for this session
  const existing = await db
    .select()
    .from(nodeOutputs)
    .where(eq(nodeOutputs.sessionId, CONSOLE_TABS_TEST_SESSION_ID));

  if (existing.length > 0) {
    // Delete existing outputs and recreate with updated data
    await db.delete(nodeOutputs).where(eq(nodeOutputs.sessionId, CONSOLE_TABS_TEST_SESSION_ID));
    log.info({ sessionId: CONSOLE_TABS_TEST_SESSION_ID.slice(-4), count: existing.length }, "seed:replacingNodeOutputs");
  }

  const baseTime = new Date();
  baseTime.setHours(baseTime.getHours() - 24);

  // Insert test node outputs (batch insert for performance)
  const outputs = [
    {
      sessionId: CONSOLE_TABS_TEST_SESSION_ID,
      sanitizedLabel: "Get_Customer",
      nodeId: "webhook-node-1",
      nodeLabel: "Get Customer",
      nodeType: "webhook",
      data: { email: "alice@example.com", customerId: "CUST-001", plan: "pro" },
      executedAt: new Date(baseTime.getTime() + 2 * 60 * 1000),
    },
    {
      sessionId: CONSOLE_TABS_TEST_SESSION_ID,
      sanitizedLabel: "CRM_Sync",
      nodeId: "crm-sync",
      nodeLabel: "CRM Sync",
      nodeType: "crm",
      data: { status: "synced", pipelineStage: "qualified", updatedAt: "2024-01-15T10:05:00Z" },
      executedAt: new Date(baseTime.getTime() + 5 * 60 * 1000),
    },
    {
      sessionId: CONSOLE_TABS_TEST_SESSION_ID,
      sanitizedLabel: "Plan_Check",
      nodeId: "plan-check",
      nodeLabel: "Plan Check",
      nodeType: "condition",
      data: { condition: "plan_interest === 'pro'", result: true, branch: "pro-tips" },
      executedAt: new Date(baseTime.getTime() + 6 * 60 * 1000),
    },
  ];

  await db.insert(nodeOutputs).values(outputs);

  log.info({ sessionId: CONSOLE_TABS_TEST_SESSION_ID.slice(-4), count: outputs.length }, "seed:nodeOutputsCreated");
}
