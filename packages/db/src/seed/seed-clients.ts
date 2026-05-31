/**
 * Clients Seeding Module
 *
 * Seeds test channel users (clients) for E2E testing.
 *
 * @module seed/seed-clients
 */

import { createLogger } from "@journey/logger";
import { and, eq } from "drizzle-orm";
import { db } from "../client";
import { clients, user, variables } from "../schema";
import { TEST_CHANNEL_USERS } from "./data";

const log = createLogger("db:seed:clients");

/**
 * Seed test channel users for E2E testing
 * Includes global tags (CRM-level) that persist across all journeys
 */
export async function seedChannelUsers() {
  log.info("🌱 Seeding test channel users...");

  // Get demo user's organization ID
  const demoUsers = await db.select().from(user).where(eq(user.email, "demo@journey.app"));
  if (demoUsers.length === 0) {
    log.warn("seed:demoUserNotFound - Cannot seed clients without organization");
    return;
  }
  const orgId = `org_${demoUsers[0].id}`;

  for (const userData of TEST_CHANNEL_USERS) {
    const existing = await db
      .select()
      .from(clients)
      .where(
        and(
          eq(clients.organizationId, orgId),
          eq(clients.platform, userData.platform),
          eq(clients.platformUserId, userData.platformUserId)
        )
      )
      .limit(1);

    let clientId: string;
    if (existing.length > 0) {
      clientId = existing[0].id;
      await db
        .update(clients)
        .set({
          firstName: userData.firstName,
          lastName: userData.lastName,
          username: userData.username,
          updatedAt: new Date(),
        })
        .where(eq(clients.id, clientId));
      const displayName = userData.firstName || userData.username || clientId;
      log.info({ clientId, displayName }, "seed:channelUserUpdated");
    } else {
      const [created] = await db
        .insert(clients)
        .values({
          platformUserId: userData.platformUserId,
          platform: userData.platform,
          organizationId: orgId,
          firstName: userData.firstName,
          lastName: userData.lastName,
          username: userData.username,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning({ id: clients.id });
      clientId = created.id;
      const displayName = userData.firstName || userData.username || clientId;
      log.info({ clientId, displayName }, "seed:channelUserCreated");
    }

    if (userData.userVars && Object.keys(userData.userVars).length > 0) {
      await db
        .delete(variables)
        .where(and(eq(variables.scope, "user"), eq(variables.ownerId, clientId)));

      const variableRows = Object.entries(userData.userVars).map(([key, value]) => ({
        organizationId: orgId,
        scope: "user" as const,
        ownerId: clientId,
        key,
        value,
        description: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      await db.insert(variables).values(variableRows);
    }
  }
}
