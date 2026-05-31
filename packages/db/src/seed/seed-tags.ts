/**
 * Tags Seeding Module
 *
 * Seeds tag definitions and tag assignments.
 * Tags are organization-wide and follow users across all journeys.
 *
 * @module seed/seed-tags
 */

import { createLogger } from "@journey/logger";
import { and, eq } from "drizzle-orm";
import { db } from "../client";
import { clients, clientTags, tagDefinitions, user } from "../schema";
import { GLOBAL_TAG_DEFINITIONS, TEST_GLOBAL_TAG_ASSIGNMENTS } from "./data";

const log = createLogger("db:seed:tags");

/**
 * Seed tag definitions (organization-level tag registry)
 * Requires organisation to be seeded first
 */
export async function seedTagDefinitions() {
  log.info("Seeding tag definitions...");

  // Get demo user's organization
  const demoUsers = await db.select().from(user).where(eq(user.email, "demo@journey.app"));
  if (demoUsers.length === 0) {
    log.warn("seed:demoUserNotFound:skippingTagDefinitions");
    return;
  }

  const demoUserId = demoUsers[0].id;
  const orgId = `org_${demoUserId}`;

  // Seed tag definitions
  for (const tagData of GLOBAL_TAG_DEFINITIONS) {
    const existing = await db
      .select()
      .from(tagDefinitions)
      .where(and(eq(tagDefinitions.organizationId, orgId), eq(tagDefinitions.name, tagData.tag)));

    if (existing.length === 0) {
      await db.insert(tagDefinitions).values({
        organizationId: orgId,
        name: tagData.tag,
        description: tagData.description,
        color: tagData.color || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      log.info({ tag: tagData.tag, color: tagData.color }, "seed:tagDefinitionCreated");
    } else {
      // Update existing tag definition
      await db
        .update(tagDefinitions)
        .set({
          description: tagData.description,
          color: tagData.color || null,
          updatedAt: new Date(),
        })
        .where(eq(tagDefinitions.id, existing[0].id));
      log.info({ tag: tagData.tag, color: tagData.color }, "seed:tagDefinitionUpdated");
    }
  }

  log.info({ count: GLOBAL_TAG_DEFINITIONS.length }, "seed:tagDefinitionsComplete");
}

/**
 * Seed tag assignments (assign tags to users)
 * Requires channel users and tag definitions to be seeded first
 *
 * Uses FK-based assignment table:
 * - clientTags: Links clients to tag definitions
 */
export async function seedTagAssignments() {
  log.info("Seeding tag assignments...");

  // Get demo user's organization for looking up tag definitions
  const demoUsers = await db.select().from(user).where(eq(user.email, "demo@journey.app"));
  if (demoUsers.length === 0) {
    log.warn("seed:demoUserNotFound:skippingTagAssignments");
    return;
  }

  const demoUserId = demoUsers[0].id;
  const orgId = `org_${demoUserId}`;

  // Seed tag assignments (client tags)
  // Note: TEST_GLOBAL_TAG_ASSIGNMENTS uses format "platform_platformUserId" (e.g., "telegram_100001")
  for (const [oldClientId, tags] of Object.entries(TEST_GLOBAL_TAG_ASSIGNMENTS)) {
    const [platform, platformUserId] = oldClientId.split("_") as [typeof clients.platform.enumValues[number], string];
    const client = await db
      .select({ id: clients.id })
      .from(clients)
      .where(and(eq(clients.organizationId, orgId), eq(clients.platform, platform), eq(clients.platformUserId, platformUserId)))
      .limit(1);

    if (client.length === 0) {
      log.warn({ platform, platformUserId }, "seed:clientNotFound");
      continue;
    }

    const clientId = client[0].id;

    for (const tagName of tags) {
      // Look up the tag definition ID
      const tagDef = await db
        .select()
        .from(tagDefinitions)
        .where(and(eq(tagDefinitions.organizationId, orgId), eq(tagDefinitions.name, tagName)))
        .limit(1);

      if (tagDef.length === 0) {
        log.warn({ clientId: clientId.slice(-4), tagName }, "seed:tagDefinitionNotFound");
        continue;
      }

      const tagId = tagDef[0].id;

      // Check if assignment already exists
      const existing = await db
        .select()
        .from(clientTags)
        .where(and(eq(clientTags.clientId, clientId), eq(clientTags.tagId, tagId)));

      if (existing.length === 0) {
        await db.insert(clientTags).values({
          clientId,
          tagId,
          createdAt: new Date(),
        });
        log.info({ clientId: clientId.slice(-4), tag: tagName }, "seed:tagAssigned");
      }
    }
  }

  const count = Object.values(TEST_GLOBAL_TAG_ASSIGNMENTS).flat().length;
  log.info({ count }, "seed:tagAssignmentsComplete");
}
