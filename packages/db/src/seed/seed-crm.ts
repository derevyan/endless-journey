/**
 * CRM Seeding Module
 *
 * Seeds CRM pipelines and stages for organizations.
 *
 * @module seed/seed-crm
 */

import { createLogger } from "@journey/logger";
import { and, eq } from "drizzle-orm";
import { db } from "../client";
import { clients, crmClientStages, crmPipelines, crmPipelineStages, organization, user } from "../schema";
import { DEFAULT_PIPELINE_STAGES, PARTNER_PIPELINE_STAGES, SUPPORT_PIPELINE_STAGES } from "./data";

const log = createLogger("db:seed:crm");

/**
 * Seed default CRM pipelines for all organizations
 * Creates a "Sales Pipeline" with preset stages for each organization
 */
export async function seedDefaultPipelines() {
  log.info("🌱 Seeding default CRM pipelines...");

  // Get all organizations
  const orgs = await db.select().from(organization);

  for (const org of orgs) {
    // Check if a default pipeline already exists for this organization
    const existingPipeline = await db
      .select()
      .from(crmPipelines)
      .where(and(eq(crmPipelines.organizationId, org.id), eq(crmPipelines.isDefault, true)));

    if (existingPipeline.length > 0) {
      log.info({ orgId: org.id, pipelineId: existingPipeline[0].id }, "seed:defaultPipelineExists");
      continue;
    }

    // Create the default pipeline
    const pipelineName = "Sales Pipeline";
    const [pipeline] = await db
      .insert(crmPipelines)
      .values({
        organizationId: org.id,
        name: pipelineName,
        slug: "sales-pipeline",
        description: "Default sales pipeline with standard stages",
        position: 0,
        isDefault: true,
        isActive: true,
        color: "#3b82f6",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    log.info({ orgId: org.id, pipelineId: pipeline.id, name: pipeline.name }, "seed:defaultPipelineCreated");

    // Create the preset stages
    for (const stageData of DEFAULT_PIPELINE_STAGES) {
      await db.insert(crmPipelineStages).values({
        pipelineId: pipeline.id,
        organizationId: org.id,
        name: stageData.name,
        color: stageData.color,
        position: stageData.position,
        isDefault: stageData.isDefault,
        isSystem: stageData.isSystem,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    log.info({ orgId: org.id, pipelineId: pipeline.id, stageCount: DEFAULT_PIPELINE_STAGES.length }, "seed:pipelineStagesCreated");
  }

  log.info({ orgCount: orgs.length }, "seed:defaultPipelinesComplete");
}

/**
 * Seed additional pipelines (Support and Partner Onboarding)
 */
export async function seedAdditionalPipelines() {
  log.info("🌱 Seeding additional CRM pipelines...");

  // Get all organizations
  const orgs = await db.select().from(organization);

  for (const org of orgs) {
    // Create Support Pipeline
    const existingSupportPipeline = await db
      .select()
      .from(crmPipelines)
      .where(and(eq(crmPipelines.organizationId, org.id), eq(crmPipelines.slug, "support-pipeline")));

    if (existingSupportPipeline.length === 0) {
      const [supportPipeline] = await db
        .insert(crmPipelines)
        .values({
          organizationId: org.id,
          name: "Support Pipeline",
          slug: "support-pipeline",
          description: "Customer support ticket tracking pipeline",
          position: 1,
          isDefault: false,
          isActive: true,
          color: "#10b981",
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      log.info({ orgId: org.id, pipelineId: supportPipeline.id, name: supportPipeline.name }, "seed:supportPipelineCreated");

      // Create support stages
      for (const stageData of SUPPORT_PIPELINE_STAGES) {
        await db.insert(crmPipelineStages).values({
          pipelineId: supportPipeline.id,
          organizationId: org.id,
          name: stageData.name,
          color: stageData.color,
          position: stageData.position,
          isDefault: stageData.isDefault,
          isSystem: stageData.isSystem,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      log.info({ orgId: org.id, pipelineId: supportPipeline.id, stageCount: SUPPORT_PIPELINE_STAGES.length }, "seed:supportPipelineStagesCreated");
    } else {
      log.info({ orgId: org.id }, "seed:supportPipelineExists");
    }

    // Create Partner Onboarding Pipeline
    const existingPartnerPipeline = await db
      .select()
      .from(crmPipelines)
      .where(and(eq(crmPipelines.organizationId, org.id), eq(crmPipelines.slug, "partner-onboarding")));

    if (existingPartnerPipeline.length === 0) {
      const [partnerPipeline] = await db
        .insert(crmPipelines)
        .values({
          organizationId: org.id,
          name: "Partner Onboarding",
          slug: "partner-onboarding",
          description: "Partner application and onboarding tracking",
          position: 2,
          isDefault: false,
          isActive: true,
          color: "#8b5cf6",
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      log.info({ orgId: org.id, pipelineId: partnerPipeline.id, name: partnerPipeline.name }, "seed:partnerPipelineCreated");

      // Create partner stages
      for (const stageData of PARTNER_PIPELINE_STAGES) {
        await db.insert(crmPipelineStages).values({
          pipelineId: partnerPipeline.id,
          organizationId: org.id,
          name: stageData.name,
          color: stageData.color,
          position: stageData.position,
          isDefault: stageData.isDefault,
          isSystem: stageData.isSystem,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      log.info({ orgId: org.id, pipelineId: partnerPipeline.id, stageCount: PARTNER_PIPELINE_STAGES.length }, "seed:partnerPipelineStagesCreated");
    } else {
      log.info({ orgId: org.id }, "seed:partnerPipelineExists");
    }
  }

  log.info({ orgCount: orgs.length }, "seed:additionalPipelinesComplete");
}

/**
 * Seed client stage assignments across all pipelines
 * Distributes existing clients across Sales, Support, and Partner pipelines
 */
export async function seedClientStageAssignments() {
  log.info("🌱 Seeding client stage assignments...");

  // Only seed for demo user's organization (clients are only created for this org)
  const demoUsers = await db.select().from(user).where(eq(user.email, "demo@journey.app"));
  if (demoUsers.length === 0) {
    log.warn("seed:demoUserNotFound:skippingClientStages");
    return;
  }
  const demoOrgId = `org_${demoUsers[0].id}`;

  // Get the demo user's organization
  const orgs = await db.select().from(organization).where(eq(organization.id, demoOrgId));
  if (orgs.length === 0) {
    log.warn({ orgId: demoOrgId }, "seed:demoOrgNotFound:skippingClientStages");
    return;
  }

  for (const org of orgs) {
    // Get all pipelines for this organization
    const pipelines = await db.select().from(crmPipelines).where(eq(crmPipelines.organizationId, org.id));

    const salesPipeline = pipelines.find((p) => p.slug === "sales-pipeline");
    const supportPipeline = pipelines.find((p) => p.slug === "support-pipeline");
    const partnerPipeline = pipelines.find((p) => p.slug === "partner-onboarding");

    if (!salesPipeline || !supportPipeline || !partnerPipeline) {
      log.warn({ orgId: org.id }, "seed:missingPipelines");
      continue;
    }

    // Get stages for each pipeline
    const salesStages = await db.select().from(crmPipelineStages).where(eq(crmPipelineStages.pipelineId, salesPipeline.id));
    const supportStages = await db.select().from(crmPipelineStages).where(eq(crmPipelineStages.pipelineId, supportPipeline.id));
    const partnerStages = await db.select().from(crmPipelineStages).where(eq(crmPipelineStages.pipelineId, partnerPipeline.id));

    // Helper to find stage by name
    const findStage = (stages: typeof salesStages, name: string) => stages.find((s) => s.name === name);

    // Client assignments (using old format client IDs, mapped via legacy_id)
    const oldFormatAssignments = [
      // Sales Pipeline - 6 clients (including 2 Unassigned for demo visibility)
      { oldClientId: "telegram_100001", pipelineId: salesPipeline.id, stageName: "Lead" },
      { oldClientId: "telegram_100002", pipelineId: salesPipeline.id, stageName: "Closed Won" },
      { oldClientId: "telegram_100004", pipelineId: salesPipeline.id, stageName: "Qualified" },
      { oldClientId: "telegram_100010", pipelineId: salesPipeline.id, stageName: "Proposal" },
      { oldClientId: "telegram_100003", pipelineId: salesPipeline.id, stageName: "Unassigned" },
      { oldClientId: "telegram_100008", pipelineId: salesPipeline.id, stageName: "Unassigned" },

      // Support Pipeline - 3 clients
      { oldClientId: "telegram_100006", pipelineId: supportPipeline.id, stageName: "In Progress" },
      { oldClientId: "telegram_100003", pipelineId: supportPipeline.id, stageName: "New Ticket" },
      { oldClientId: "telegram_100008", pipelineId: supportPipeline.id, stageName: "Resolved" },

      // Partner Onboarding Pipeline - 3 clients
      { oldClientId: "telegram_100007", pipelineId: partnerPipeline.id, stageName: "Active Partner" },
      { oldClientId: "telegram_100009", pipelineId: partnerPipeline.id, stageName: "Onboarding" },
      { oldClientId: "telegram_100005", pipelineId: partnerPipeline.id, stageName: "Reviewing" },
    ];

    const assignments: Array<{ clientId: string; pipelineId: string; stageName: string }> = [];

    for (const assignment of oldFormatAssignments) {
      // Parse "platform_platformUserId" format (e.g., "telegram_100001")
      const [platform, platformUserId] = assignment.oldClientId.split("_") as [typeof clients.platform.enumValues[number], string];
      const client = await db
        .select({ id: clients.id })
        .from(clients)
        .where(and(eq(clients.organizationId, org.id), eq(clients.platform, platform), eq(clients.platformUserId, platformUserId)))
        .limit(1);

      if (client.length === 0) {
        log.warn({ platform, platformUserId }, "seed:clientNotFound");
        continue;
      }

      assignments.push({
        clientId: client[0].id,
        pipelineId: assignment.pipelineId,
        stageName: assignment.stageName,
      });
    }

    for (const assignment of assignments) {
      let stages = salesStages;
      if (assignment.pipelineId === supportPipeline.id) stages = supportStages;
      if (assignment.pipelineId === partnerPipeline.id) stages = partnerStages;

      const stage = findStage(stages, assignment.stageName);
      if (!stage) {
        log.warn({ clientId: assignment.clientId, stageName: assignment.stageName }, "seed:stageNotFound");
        continue;
      }

      // Check if assignment already exists
      const existing = await db
        .select()
        .from(crmClientStages)
        .where(and(eq(crmClientStages.clientId, assignment.clientId), eq(crmClientStages.pipelineId, assignment.pipelineId)));

      if (existing.length > 0) {
        log.info({ clientId: assignment.clientId, pipelineId: assignment.pipelineId }, "seed:clientStageExists");
        continue;
      }

      await db.insert(crmClientStages).values({
        clientId: assignment.clientId,
        organizationId: org.id,
        pipelineId: assignment.pipelineId,
        stageId: stage.id,
        assignedAt: new Date(),
      });

      log.info({ clientId: assignment.clientId, pipelineId: assignment.pipelineId, stageName: assignment.stageName }, "seed:clientStageAssigned");
    }
  }

  log.info("seed:clientStageAssignmentsComplete");
}
