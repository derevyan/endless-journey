/**
 * Simulator API Routes
 *
 * Provides endpoints for controlling simulator sessions:
 * - POST /simulator/sessions - Start a new simulation
 * - POST /simulator/execute - Send input to the engine
 * - POST /simulator/timers/:edgeId/skip - Skip a timer (time travel!)
 * - DELETE /simulator/sessions/:id - Cleanup session
 *
 * These routes allow the frontend to act as a "remote control" for
 * the backend SessionEngine, achieving 100% production parity.
 *
 * @module modules/simulator/routes
 */

import { z } from "zod";

import { createLogger } from "@journey/logger";

import {
  SimulatorExecuteRequestSchema,
  BadRequestError,
  CreateSimulatorSessionSchema,
  SkipTimerRequestSchema,
  CreatePersonaRequestSchema,
  UpdatePersonaRequestSchema,
  NotFoundError,
  ConflictError,
  type SimulatorInput,
} from "@journey/schemas";
import { createProtectedRouter, protect } from "../../../lib/protected-router";
import { isUniqueViolation } from "../../../lib/db-errors";
import { validateJson } from "../../../lib/zod-validator";
import { createServicesFromContext } from "../../../services";
import { deleteSessionTimers, getTimerQueue } from "../../../services/timers";
import { handleTimerFired } from "../../../services/timers/timer-handler";

const log = createLogger("api:simulator");

// UUID validation schema for URL parameters
const UuidParam = z.string().uuid();

/**
 * Parse and validate a UUID URL parameter.
 * Throws BadRequestError if invalid.
 */
function parseUuidParam(value: string, paramName: string): string {
  const result = UuidParam.safeParse(value);
  if (!result.success) {
    throw new BadRequestError(`Invalid ${paramName}: must be a valid UUID`, { [paramName]: value });
  }
  return result.data;
}

export const simulator = createProtectedRouter({
  defaultPermission: { resource: "simulator", action: "execute" },
});

// =============================================================================
// POST /simulator/sessions - Start a new simulation
// =============================================================================

simulator.post("/sessions", async (c) => {
  const services = createServicesFromContext(c);

  const parseResult = await validateJson(c, CreateSimulatorSessionSchema);
  if (!parseResult.success) return parseResult.response;
  const { journeyId, startNodeId, personaId, clientProfile } = parseResult.data;

  // Service handles organization ownership verification
  const result = await services.simulator.createSession({
    journeyId,
    startNodeId,
    personaId,
    clientProfile,
  });

  log.info({ sessionId: result.sessionId, journeyId }, "simulator:sessions:created");

  return c.json(result, 201);
});

// =============================================================================
// POST /simulator/execute - Send input to the engine
// =============================================================================

simulator.post(
  "/execute",
  protect({
    resource: { type: "session", extractor: { body: "sessionId" }, action: "execute" },
  }),
  async (c) => {
    const parseResult = await validateJson(c, SimulatorExecuteRequestSchema);
    if (!parseResult.success) return parseResult.response;

    const services = createServicesFromContext(c);
    const { event, sessionId: requestedSessionId } = parseResult.data;
    const sessionId = c.get("verifiedResourceId") ?? null;
    if (!sessionId) {
      throw new NotFoundError("Session", requestedSessionId);
    }

    // Convert validated event to SimulatorInput
    let input: SimulatorInput;
    switch (event.type) {
      case "text":
        input = { type: "text", text: event.text };
        break;
      case "button_click":
        input = { type: "button_click", buttonId: event.buttonId };
        break;
      case "timeout":
        input = { type: "timeout", edgeId: event.edgeId };
        break;
    }

    // Inject input into engine and persist state
    await services.simulator.executeInput(sessionId, input);

    log.debug({ sessionId, eventType: event.type }, "simulator:execute:success");

    return c.json({ success: true });
  }
);

// =============================================================================
// GET /simulator/sessions/:id/timers - Get all active timers for a session
// =============================================================================

simulator.get(
  "/sessions/:id/timers",
  protect({
    resource: { type: "session", extractor: { param: "id" }, action: "read" },
  }),
  async (c) => {
    const services = createServicesFromContext(c);
    const requestedSessionId = c.req.param("id");
    const sessionId = c.get("verifiedResourceId") ?? null;
    if (!sessionId) {
      throw new NotFoundError("Session", requestedSessionId);
    }

    const sessionData = await services.simulator.getSessionRecord(sessionId);
    if (!sessionData) {
      throw new NotFoundError("Session", sessionId);
    }

    // Query active timers from database
    const timers = await services.simulator.listActiveTimers(sessionId);

    log.debug({ sessionId, timerCount: timers.length }, "simulator:timers:list");

    return c.json({ timers });
  }
);

// =============================================================================
// POST /simulator/timers/:edgeId/skip - Skip a timer (time travel!)
// =============================================================================

simulator.post(
  "/timers/:edgeId/skip",
  protect({
    resource: { type: "session", extractor: { body: "sessionId" }, action: "execute" },
  }),
  async (c) => {
    const edgeId = c.req.param("edgeId");

    const parseResult = await validateJson(c, SkipTimerRequestSchema);
    if (!parseResult.success) return parseResult.response;
    const services = createServicesFromContext(c);
    const requestedSessionId = parseResult.data.sessionId;
    const sessionId = c.get("verifiedResourceId") ?? null;
    if (!sessionId) {
      throw new NotFoundError("Session", requestedSessionId);
    }

    const sessionData = await services.simulator.getSessionRecord(sessionId);
    if (!sessionData) {
      throw new NotFoundError("Session", sessionId);
    }

    // Find the pending timer in DB
    const timer = await services.simulator.getActiveTimer(sessionId, edgeId);

    if (!timer) {
      throw new NotFoundError("Timer", edgeId);
    }

    // Remove the BullMQ job directly (prevent double-fire)
    // IMPORTANT: Don't use cancelTimer() because it updates DB status to "cancelled",
    // which would cause handleTimerFired() to exit early (it checks for status="active")
    if (timer.bullmqJobId) {
      const queue = getTimerQueue();
      if (queue) {
        const job = await queue.getJob(timer.bullmqJobId);
        if (job) {
          await job.remove();
          log.debug({ jobId: timer.bullmqJobId }, "simulator:timers:skip:jobRemoved");
        }
      }
    }

    // handleTimerFired() will atomically mark the timer as "fired" in the DB
    // and process the follow-up logic

    // Fire the timer using handleTimerFired (which marks timer as fired atomically)
    // Pass timerId (bullmqJobId) for proper follow-up timer lookup in engine
    await handleTimerFired({
      sessionId,
      telegramUserId: sessionData.clientId,
      channelId: null,
      edgeId,
      scheduledAt: timer.createdAt?.toISOString() ?? new Date().toISOString(),
      adapterType: "simulator",
      timerId: timer.bullmqJobId ?? undefined,
    });

    log.info({ sessionId, edgeId }, "simulator:timers:skipped");

    return c.json({ success: true });
  }
);

// =============================================================================
// DELETE /simulator/sessions/:id - Cleanup session
// =============================================================================

simulator.delete(
  "/sessions/:id",
  protect({
    permission: { resource: "session", action: "delete" },
    resource: { type: "session", extractor: { param: "id" }, action: "delete" },
  }),
  async (c) => {
    const services = createServicesFromContext(c);
    const requestedSessionId = c.req.param("id");
    const sessionId = c.get("verifiedResourceId") ?? null;
    if (!sessionId) {
      throw new NotFoundError("Session", requestedSessionId);
    }

    // Cancel all active timers first (prevents orphaned BullMQ jobs)
    const cancelledCount = await deleteSessionTimers(sessionId);
    if (cancelledCount > 0) {
      log.debug({ sessionId, cancelledCount }, "simulator:sessions:timersCancelled");
    }

    // Then cleanup the session from cache
    await services.simulator.cleanupSession(sessionId);

    log.info({ sessionId }, "simulator:sessions:deleted");

    return c.json({ success: true });
  }
);

// =============================================================================
// PERSONA ENDPOINTS
// =============================================================================

// GET /simulator/personas - List all personas for organization
simulator.get("/personas", async (c) => {
  const services = createServicesFromContext(c);
  const personas = await services.simulator.listPersonas();
  return c.json({ personas });
});

// POST /simulator/personas - Create a new persona
simulator.post("/personas", async (c) => {
  const services = createServicesFromContext(c);

  const parseResult = await validateJson(c, CreatePersonaRequestSchema);
  if (!parseResult.success) return parseResult.response;
  const { name, profile, userVars } = parseResult.data;

  try {
    const persona = await services.simulator.createPersona({
      name: name.trim(),
      profile,
      userVars,
    });

    log.info({ personaId: persona.id, name: persona.name }, "simulator:personas:created");

    return c.json({ persona }, 201);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError("A persona with this name already exists");
    }
    throw error;
  }
});

// GET /simulator/personas/:id - Get a single persona
simulator.get("/personas/:id", async (c) => {
  const services = createServicesFromContext(c);

  const personaId = parseUuidParam(c.req.param("id"), "personaId");

  const persona = await services.simulator.getPersona(personaId);
  if (!persona) {
    throw new NotFoundError("Persona", personaId);
  }
  return c.json({ persona });
});

// PUT /simulator/personas/:id - Update a persona
simulator.put("/personas/:id", async (c) => {
  const services = createServicesFromContext(c);

  const personaId = parseUuidParam(c.req.param("id"), "personaId");

  const parseResult = await validateJson(c, UpdatePersonaRequestSchema);
  if (!parseResult.success) return parseResult.response;
  const { name, profile, userVars } = parseResult.data;

  try {
    const persona = await services.simulator.updatePersona(personaId, {
      name: name?.trim(),
      profile,
      userVars,
    });

    if (!persona) {
      throw new NotFoundError("Persona", personaId);
    }

    log.info({ personaId }, "simulator:personas:updated");

    return c.json({ persona });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError("A persona with this name already exists");
    }
    throw error;
  }
});

// DELETE /simulator/personas/:id - Delete a persona
simulator.delete("/personas/:id", async (c) => {
  const services = createServicesFromContext(c);

  const personaId = parseUuidParam(c.req.param("id"), "personaId");

  const deleted = await services.simulator.deletePersona(personaId);
  if (!deleted) {
    throw new NotFoundError("Persona", personaId);
  }

  log.info({ personaId }, "simulator:personas:deleted");

  return c.json({ success: true });
});

// POST /simulator/personas/:id/reset - Reset persona data
simulator.post("/personas/:id/reset", async (c) => {
  const services = createServicesFromContext(c);

  const personaId = parseUuidParam(c.req.param("id"), "personaId");

  const result = await services.simulator.resetPersonaData(personaId);
  if (!result) {
    throw new NotFoundError("Persona", personaId);
  }

  log.info({ personaId, result }, "simulator:personas:reset");

  return c.json({ success: true, ...result });
});

// =============================================================================
// CLEANUP ENDPOINTS
// =============================================================================

// POST /simulator/cleanup - Bulk cleanup all test data
simulator.post("/cleanup", async (c) => {
  const organization = c.get("authOrg");
  const services = createServicesFromContext(c);

  const result = await services.simulator.cleanupAllTestData();

  log.info({ organizationId: organization.id, result }, "simulator:cleanup:complete");

  return c.json({ success: true, ...result });
});

// =============================================================================
// GET /simulator/health - Health check
// =============================================================================

simulator.get("/health", async (c) => {
  const services = createServicesFromContext(c);
  return c.json({
    status: "ok",
    activeSessions: services.simulator.getActiveSessionCount(),
    timestamp: new Date().toISOString(),
  });
});
