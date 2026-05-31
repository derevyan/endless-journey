/**
 * AI Report Routes
 *
 * API endpoints for generating AI-optimized execution reports.
 *
 * @module modules/ai-report/routes
 */

import { z } from "zod";
import { createLogger } from "@journey/logger";
import { db } from "@journey/db";
import {
  type JourneyIdOrSlug,
  createJourneyIdOrSlug,
  ForbiddenError,
  BadRequestError,
} from "@journey/schemas";
import { createProtectedRouter } from "../../../lib/protected-router";
import { validateQuery } from "../../../lib/zod-validator";
import { createServicesFromContext } from "../../../services";
import { generateReport, getSessionJourneyId } from "../services";

const log = createLogger("api:ai-report");

/**
 * Parse and validate journey ID or slug.
 */
function parseJourneyIdOrSlug(value: string): JourneyIdOrSlug {
  try {
    return createJourneyIdOrSlug(value);
  } catch (error) {
    throw new BadRequestError("Invalid journeyId", { journeyId: value }, error);
  }
}

const aiReport = createProtectedRouter({
  defaultPermission: { resource: "session", action: "read" },
});

const ReportQuerySchema = z.object({
  includeGraph: z.coerce.boolean().optional().default(true),
  includeMessages: z.coerce.boolean().optional().default(true),
  includeWorkflows: z.coerce.boolean().optional().default(true),
  includeLLMDetails: z.coerce.boolean().optional().default(true),
  includeInputMessages: z.coerce.boolean().optional().default(true),
  systemPromptMaxChars: z.coerce.number().int().min(0).optional(),
  conversationHistoryMaxChars: z.coerce.number().int().min(0).optional(),
  fromTimestamp: z.string().datetime().optional(),
  toTimestamp: z.string().datetime().optional(),
  maxEvents: z.coerce.number().int().min(1).max(10000).optional(),
});

/**
 * GET /sessions/:sessionId/ai-report - Generate AI-optimized execution report
 *
 * Generates a comprehensive report for AI consumption including:
 * - Full journey graph
 * - Chronological event log
 * - AI conversation history with LLM call details
 * - Workflow executions
 * - Variable changes
 * - Detected issues
 *
 * Query params:
 * - includeGraph: boolean (default: true) - Include journey graph
 * - includeMessages: boolean (default: true) - Include message history
 * - includeWorkflows: boolean (default: true) - Include workflow executions
 * - includeLLMDetails: boolean (default: true) - Include full LLM prompts/responses
 * - includeInputMessages: boolean (default: true) - Include input messages to LLM
 * - systemPromptMaxChars: number (optional) - Truncate system prompts
 * - conversationHistoryMaxChars: number (optional) - Truncate conversation history
 * - fromTimestamp: ISO datetime (optional) - Filter events after this time
 * - toTimestamp: ISO datetime (optional) - Filter events before this time
 * - maxEvents: number (optional) - Maximum events to include
 */
aiReport.get("/sessions/:sessionId/ai-report", async (c) => {
  const user = c.get("authUser");
  const organization = c.get("authOrg");
  const services = createServicesFromContext(c);

  const sessionId = c.req.param("sessionId");

  // Parse and validate query parameters
  const queryResult = validateQuery(c, ReportQuerySchema);
  if (!queryResult.success) {
    return queryResult.response;
  }
  const options = queryResult.data;

  // Service context for database operations
  const ctx = { db, organizationId: organization.id };

  // 1. Get session's journey ID for access check
  const journeyId = await getSessionJourneyId(ctx, sessionId);

  // 2. Verify user has access to the journey
  const journey = await services.journey.getJourneyById(
    parseJourneyIdOrSlug(journeyId),
    organization.id
  );
  if (!journey) {
    throw new ForbiddenError("Access denied to session");
  }

  // 3. Generate the report using service layer
  const { report, metadata } = await generateReport(ctx, {
    sessionId,
    journey: {
      id: journey.id,
      name: journey.name,
      slug: journey.slug,
      configuration: journey.configuration,
    },
    options,
  });

  log.info(
    {
      userId: user.id,
      organizationId: organization.id,
      sessionId,
      journeyId: journey.id,
      ...metadata,
    },
    "aiReport:generate:success"
  );

  return c.json(report);
});

export { aiReport as aiReportRoutes };
