/**
 * Workflow Seeding Module
 *
 * Seeds demo agent workflows from JSON configuration files.
 * Follows the same pattern as seed-journeys.ts.
 *
 * @module seed/seed-workflows
 */

import { createLogger } from "@journey/logger";
import { eq, and } from "drizzle-orm";
import { db } from "../client";
import { agentWorkflows, workflowVersions, user, organization } from "../schema";
import { WORKFLOW_CONFIGS, USER_ORG_ASSIGNMENTS } from "./data";
import type { WorkflowConfigData } from "./types";

const log = createLogger("db:seed:workflows");

// =============================================================================
// WORKFLOW FILTERING
// =============================================================================

/** Workflows exclusive to specific users (not seeded to demo accounts) */
const USER_EXCLUSIVE_WORKFLOWS: Record<string, string[]> = {};

/** Additional workflows to grant to specific users (in addition to non-exclusive ones) */
const USER_ADDITIONAL_WORKFLOWS: Record<string, string[]> = {
  "demo@journey.app": ["questionnaire-demo"],
};

/**
 * Get workflows to seed for a specific user email.
 * - Users with exclusive workflows only get those workflows
 * - Other users get all workflows EXCEPT exclusive ones, plus any additional granted workflows
 */
function getWorkflowsForUser(email: string): WorkflowConfigData[] {
  const exclusiveWorkflows = USER_EXCLUSIVE_WORKFLOWS[email];
  const additionalWorkflows = USER_ADDITIONAL_WORKFLOWS[email] || [];

  if (exclusiveWorkflows) {
    // User has exclusive workflows - only seed those
    return WORKFLOW_CONFIGS.filter((w) => exclusiveWorkflows.includes(w.key));
  }

  // Other users get all workflows except exclusive ones, plus any additional granted workflows
  const allExclusiveKeys = Object.values(USER_EXCLUSIVE_WORKFLOWS).flat();
  return WORKFLOW_CONFIGS.filter(
    (w) => !allExclusiveKeys.includes(w.key) || additionalWorkflows.includes(w.key)
  );
}

// =============================================================================
// SEED FUNCTION
// =============================================================================

/**
 * Seed demo agent workflows for testing.
 *
 * Loads workflow configurations from JSON files in apps/web/src/data/workflows/
 * and seeds them for users listed in USER_ORG_ASSIGNMENTS.
 *
 * Workflow distribution:
 * - All users get all demo workflows.
 */
export async function seedWorkflows() {
  log.info("🤖 Seeding agent workflows...");

  // Get all users who should have demo workflows
  const userEmails = Object.keys(USER_ORG_ASSIGNMENTS);

  for (const email of userEmails) {
    // Look up user by email
    const users = await db.select().from(user).where(eq(user.email, email));

    if (users.length === 0) {
      log.warn({ email }, "seed:workflows:userNotFound");
      continue;
    }

    const userId = users[0].id;
    const orgId = `org_${userId}`;

    // Verify organization exists
    const orgs = await db.select().from(organization).where(eq(organization.id, orgId));
    if (orgs.length === 0) {
      log.warn({ email, orgId }, "seed:workflows:orgNotFound");
      continue;
    }

    // Get workflows for this specific user
    const workflowsForUser = getWorkflowsForUser(email);
    log.info({ email, workflowCount: workflowsForUser.length }, "seed:workflows:filtering");

    // Seed each workflow from configs
    for (const workflow of workflowsForUser) {
      // Check if workflow already exists for this org
      const existing = await db
        .select()
        .from(agentWorkflows)
        .where(and(eq(agentWorkflows.key, workflow.key), eq(agentWorkflows.organizationId, orgId)))
        .limit(1);

      if (existing.length > 0) {
        // Update existing workflow configuration
        await db
          .update(agentWorkflows)
          .set({
            name: workflow.name,
            description: workflow.description,
            configuration: workflow.configuration,
            status: workflow.status,
            updatedBy: userId,
            updatedAt: new Date(),
          })
          .where(eq(agentWorkflows.id, existing[0].id));
        log.info({ email, key: workflow.key }, "seed:workflows:updated");
        continue;
      }

      // Create new workflow
      const [created] = await db
        .insert(agentWorkflows)
        .values({
          organizationId: orgId,
          key: workflow.key,
          name: workflow.name,
          description: workflow.description,
          status: workflow.status,
          configuration: workflow.configuration,
          createdBy: userId,
          updatedBy: userId,
        })
        .returning();

      // Create initial version
      await db.insert(workflowVersions).values({
        workflowId: created.id,
        versionId: "v001",
        notes: "Initial version (seeded)",
        configuration: workflow.configuration,
        createdBy: userId,
      });

      log.info({ email, key: workflow.key, workflowId: created.id }, "seed:workflows:created");
    }
  }

  log.info("✅ Agent workflows seeded");
}
