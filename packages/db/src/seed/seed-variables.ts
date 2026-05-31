/**
 * Variables Seeding Module
 *
 * Seeds global and journey variables.
 *
 * @module seed/seed-variables
 */

import { createLogger } from "@journey/logger";
import { and, eq } from "drizzle-orm";
import { db } from "../client";
import { user, variables } from "../schema";
import { GLOBAL_VARIABLES, JOURNEY_VARIABLES } from "./data";
import { getJourneyIdBySlug } from "./seed-journeys";

const log = createLogger("db:seed:variables");

/**
 * Seed global and journey variables for testing
 * Requires organisation and journey to be seeded first
 */
export async function seedVariables() {
  log.info("🌱 Seeding variables...");

  // Get demo user's organization
  const demoUsers = await db.select().from(user).where(eq(user.email, "demo@journey.app"));
  if (demoUsers.length === 0) {
    log.warn("seed:demoUserNotFound:skippingVariables");
    return;
  }

  const demoUserId = demoUsers[0].id;
  const orgId = `org_${demoUserId}`;

  // Get the SaaS Onboarding journey ID
  const journeyId = await getJourneyIdBySlug("saas-onboarding");
  if (!journeyId) {
    log.warn("seed:saasJourneyNotFound - Skipping journey variables");
    // Still seed global variables
  }

  // Seed global variables
  for (const varData of GLOBAL_VARIABLES) {
    const existing = await db
      .select()
      .from(variables)
      .where(and(eq(variables.scope, "global"), eq(variables.ownerId, orgId), eq(variables.key, varData.key)));

    if (existing.length === 0) {
      await db.insert(variables).values({
        organizationId: orgId,
        scope: "global",
        ownerId: orgId,
        key: varData.key,
        value: varData.value,
        description: varData.description,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      log.info({ key: varData.key, type: typeof varData.value }, "seed:globalVariableCreated");
    } else {
      // Update existing variable
      await db
        .update(variables)
        .set({
          value: varData.value,
          description: varData.description,
          updatedAt: new Date(),
        })
        .where(eq(variables.id, existing[0].id));
      log.info({ key: varData.key }, "seed:globalVariableUpdated");
    }
  }

  // Seed journey variables for SaaS Onboarding
  if (journeyId) {
    for (const varData of JOURNEY_VARIABLES) {
      const existing = await db
        .select()
        .from(variables)
        .where(and(eq(variables.scope, "journey"), eq(variables.ownerId, journeyId), eq(variables.key, varData.key)));

      if (existing.length === 0) {
        await db.insert(variables).values({
          organizationId: orgId,
          scope: "journey",
          ownerId: journeyId,
          key: varData.key,
          value: varData.value,
          description: varData.description,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        log.info({ key: varData.key, journeyId: journeyId.slice(-4) }, "seed:journeyVariableCreated");
      } else {
        // Update existing variable
        await db
          .update(variables)
          .set({
            value: varData.value,
            description: varData.description,
            updatedAt: new Date(),
          })
          .where(eq(variables.id, existing[0].id));
        log.info({ key: varData.key }, "seed:journeyVariableUpdated");
      }
    }
  }

  log.info({ globalCount: GLOBAL_VARIABLES.length, journeyCount: journeyId ? JOURNEY_VARIABLES.length : 0 }, "seed:variablesComplete");
}
