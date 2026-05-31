/**
 * Parity Testing Routes
 *
 * Test-only endpoints used by blade-runner parity backends.
 * Mounted only in NODE_ENV=test to avoid exposing in production.
 *
 * @module testing/parity-routes
 */

import type { Context } from "hono";
import { createLogger } from "@journey/logger";
import { db } from "@journey/db";
import { clients, durableTimers, journeySessions, messagingChannels } from "@journey/db/schema";
import { and, desc, eq, gte } from "drizzle-orm";
import { BadRequestError, NotFoundError, SkipTimerRequestSchema } from "@journey/schemas";
import type { AuthenticatedVariables } from "../lib/auth-helpers";
import { createProtectedRouter, protect } from "../lib/protected-router";
import { validateJson } from "../lib/zod-validator";
import { getTimerByStatus, listTimersByStatus } from "../modules/simulator/services/timer-service";
import type { SimulatorServiceContext } from "../modules/simulator/services/service-context";
import { publishers } from "../event-bus/publishers";
import {
  getTimerQueue,
  handleTimerFired,
  isJobLockedError,
  pauseSessionTimers,
  resumeSessionTimers,
} from "../services/timers";

const log = createLogger("api:parity-testing");

export const parityTesting = createProtectedRouter({ auditLogging: false });

function createSimulatorContext(c: Context<{ Variables: AuthenticatedVariables }>): SimulatorServiceContext {
  const organization = c.get("authOrg");
  if (!organization) {
    throw new BadRequestError("Organization required for timer queries");
  }
  return {
    db,
    organizationId: organization.id,
    publisher: publishers,
  };
}

// =============================================================================
// GET /testing/parity/channels/:id/sessions/latest - Latest session for channel
// =============================================================================

parityTesting.get(
  "/channels/:id/sessions/latest",
  protect({
    permission: { resource: "session", action: "read" },
    skipAudit: true,
  }),
  async (c) => {
    const channelId = c.req.param("id");
    const organization = c.get("authOrg");

    const sinceRaw = c.req.query("since");
    let sinceDate: Date | null = null;
    if (sinceRaw) {
      const asNumber = Number(sinceRaw);
      const parsed = Number.isFinite(asNumber) ? new Date(asNumber) : new Date(sinceRaw);
      if (Number.isNaN(parsed.getTime())) {
        throw new BadRequestError("Invalid since timestamp", { since: sinceRaw });
      }
      sinceDate = parsed;
    }

    const channel = await db
      .select({ organizationId: messagingChannels.organizationId })
      .from(messagingChannels)
      .where(eq(messagingChannels.id, channelId))
      .limit(1);

    if (!channel[0] || channel[0].organizationId !== organization.id) {
      throw new NotFoundError("Channel", channelId);
    }

    const conditions = [eq(journeySessions.channelId, channelId)];
    if (sinceDate) {
      conditions.push(gte(journeySessions.createdAt, sinceDate));
    }

    const results = await db
      .select({
        sessionId: journeySessions.id,
        journeyId: journeySessions.journeyId,
        currentNodeId: journeySessions.currentNodeId,
        status: journeySessions.status,
        createdAt: journeySessions.createdAt,
        updatedAt: journeySessions.updatedAt,
        userId: clients.id,
        firstName: clients.firstName,
        lastName: clients.lastName,
        username: clients.username,
      })
      .from(journeySessions)
      .innerJoin(clients, eq(journeySessions.clientId, clients.id))
      .where(and(...conditions))
      .orderBy(desc(journeySessions.createdAt))
      .limit(1);

    const latest = results[0];
    if (!latest) {
      return c.json({ session: null });
    }

    log.debug({ channelId, sessionId: latest.sessionId }, "parity:sessions:latest");

    return c.json({
      session: {
        id: latest.sessionId,
        journeyId: latest.journeyId,
        currentNodeId: latest.currentNodeId,
        status: latest.status,
        createdAt: latest.createdAt,
        updatedAt: latest.updatedAt,
        user: {
          id: latest.userId,
          firstName: latest.firstName,
          lastName: latest.lastName,
          username: latest.username,
        },
      },
    });
  }
);

// =============================================================================
// GET /testing/parity/sessions/:id/timers - List active timers for a session
// =============================================================================

parityTesting.get(
  "/sessions/:id/timers",
  protect({
    resource: { type: "session", extractor: { param: "id" }, action: "read" },
    skipAudit: true,
  }),
  async (c) => {
    const sessionId = c.get("verifiedResourceId")!;

    const simulatorCtx = createSimulatorContext(c);
    const timersByStatus = await listTimersByStatus(simulatorCtx, sessionId, ["active", "paused"]);
    const timers = timersByStatus.map((timer) => ({
      id: timer.id,
      edgeId: timer.edgeId,
      firesAt: timer.firesAt,
      createdAt: timer.createdAt,
      bullmqJobId: timer.bullmqJobId,
      channelId: timer.channelId,
    }));

    log.debug({ sessionId, timerCount: timers.length }, "parity:timers:list");

    return c.json({ timers });
  }
);

// =============================================================================
// POST /testing/parity/sessions/:id/timers/pause - Pause active timers
// =============================================================================

parityTesting.post(
  "/sessions/:id/timers/pause",
  protect({
    resource: { type: "session", extractor: { param: "id" }, action: "execute" },
    skipAudit: true,
  }),
  async (c) => {
    const sessionId = c.get("verifiedResourceId")!;
    const pausedCount = await pauseSessionTimers(sessionId, { preserveJobId: true });

    log.info({ sessionId, pausedCount }, "parity:timers:paused");

    return c.json({ pausedCount });
  }
);

// =============================================================================
// POST /testing/parity/sessions/:id/timers/resume - Resume paused timers
// =============================================================================

parityTesting.post(
  "/sessions/:id/timers/resume",
  protect({
    resource: { type: "session", extractor: { param: "id" }, action: "execute" },
    skipAudit: true,
  }),
  async (c) => {
    const sessionId = c.get("verifiedResourceId")!;
    const resumedCount = await resumeSessionTimers(sessionId);

    log.info({ sessionId, resumedCount }, "parity:timers:resumed");

    return c.json({ resumedCount });
  }
);

// =============================================================================
// POST /testing/parity/timers/:edgeId/fire - Fire a timer immediately
// =============================================================================

parityTesting.post(
  "/timers/:edgeId/fire",
  protect({
    resource: { type: "session", extractor: { body: "sessionId" }, action: "execute" },
    skipAudit: true,
  }),
  async (c) => {
    const edgeId = c.req.param("edgeId");

    const parseResult = await validateJson(c, SkipTimerRequestSchema);
    if (!parseResult.success) return parseResult.response;
    const sessionId = c.get("verifiedResourceId")!;

    const simulatorCtx = createSimulatorContext(c);
    const timer = await getTimerByStatus(simulatorCtx, sessionId, edgeId, ["active", "paused"]);
    if (!timer) {
      log.debug({ sessionId, edgeId }, "parity:timers:fire:notFound");
      return c.json({ error: "timer_not_found" }, 404);
    }

    if (!timer.channelId) {
      throw new BadRequestError("Timer missing channelId", { edgeId, sessionId });
    }

    if (timer.status === "paused") {
      await db
        .update(durableTimers)
        .set({ status: "active", pausedAt: null })
        .where(eq(durableTimers.id, timer.id));
    }

    if (timer.bullmqJobId) {
      const queue = getTimerQueue();
      const job = queue ? await queue.getJob(timer.bullmqJobId) : null;
      if (job) {
        try {
          await job.remove();
          log.debug({ jobId: timer.bullmqJobId }, "parity:timers:fire:jobRemoved");
        } catch (error) {
          if (!isJobLockedError(error)) {
            throw error;
          }
          log.debug({ jobId: timer.bullmqJobId }, "parity:timers:fire:jobLocked");
        }
      }
    }

    await handleTimerFired({
      sessionId,
      telegramUserId: "",
      channelId: timer.channelId,
      edgeId,
      scheduledAt: timer.createdAt?.toISOString() ?? new Date().toISOString(),
      adapterType: "telegram",
      timerId: timer.bullmqJobId ?? undefined,
    });

    log.info({ sessionId, edgeId }, "parity:timers:fired");

    return c.json({ success: true });
  }
);
