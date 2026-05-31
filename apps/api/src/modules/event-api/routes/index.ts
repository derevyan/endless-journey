/**
 * Events API Routes
 *
 * Provides endpoints for querying and streaming events/interactions.
 * Used by the Events/Logs page in the Developers section.
 *
 * @module modules/events/routes
 */

import { createLogger, serializeError } from "@journey/logger";
import { getEventRegistration, ServiceUnavailableError } from "@journey/schemas";
import { streamSSE } from "hono/streaming";
import { z } from "zod";

import { appConfig } from "../../../config/app-config";
import { isRecord } from "../../../lib/type-guards";
import { createProtectedRouter } from "../../../lib/protected-router";
import { buildPaginationMeta, DEFAULT_LIMIT, MAX_LIMIT, MAX_OFFSET } from "../../../lib/query-helpers";
import { validateQuery } from "../../../lib/zod-validator";
import { getRedisConnection } from "../../../lib/redis";
import { checkRateLimit, RATE_LIMITS } from "../../../lib/rate-limiter";
import { createServicesFromContext } from "../../../services";
import { getEventSystemHealth } from "../../../services/health-check";
import { eventsReplayRouter } from "./replay";
import {
  getCrmEventTypes,
  mapActivityTypesToEventTypes,
  mapEventTypeToActivityType,
  buildActivityDescription,
} from "../../crm";

const log = createLogger("api:events");

export const events = createProtectedRouter({
  defaultPermission: { resource: "session", action: "read" },
});

// =============================================================================
// QUERY SCHEMAS
// =============================================================================

const EventsListQuerySchema = z.object({
  types: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  sessionId: z.string().optional(),
  journeyId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).optional().default(DEFAULT_LIMIT),
  offset: z.coerce.number().int().min(0).max(MAX_OFFSET).optional().default(0),
});

const EventsLlmQuerySchema = z.object({
  services: z.string().optional(),
  models: z.string().optional(),
  providers: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).optional().default(DEFAULT_LIMIT),
  offset: z.coerce.number().int().min(0).max(MAX_OFFSET).optional().default(0),
});

function parseCsvParam(value?: string): string[] | undefined {
  if (!value) return undefined;
  const entries = value.split(",").map((entry) => entry.trim()).filter(Boolean);
  return entries.length > 0 ? entries : undefined;
}

// =============================================================================
// GET /events - List events with filters
// =============================================================================

events.get("/", async (c) => {
  const currentUser = c.get("authUser");
  const currentOrg = c.get("authOrg");
  const services = createServicesFromContext(c);

  const queryResult = validateQuery(c, EventsListQuerySchema);
  if (!queryResult.success) {
    return queryResult.response;
  }

  const filters = {
    ...queryResult.data,
    types: parseCsvParam(queryResult.data.types),
  };

  const requestLog = log.child({ userId: currentUser.id, orgId: currentOrg.id, filters });
  requestLog.debug({}, "events:list:start");

  const { events: results, total } = await services.event.listInteractionEvents({
    organizationId: currentOrg.id,
    types: filters.types,
    startDate: filters.startDate,
    endDate: filters.endDate,
    sessionId: filters.sessionId,
    journeyId: filters.journeyId,
    limit: filters.limit,
    offset: filters.offset,
  });

  requestLog.debug({ resultCount: results.length, total }, "events:list:success");

  return c.json({
    events: results,
    pagination: buildPaginationMeta(total, filters.limit, filters.offset, results.length),
  });
});

// =============================================================================
// GET /events/stats - Event statistics
// =============================================================================

events.get("/stats", async (c) => {
  const currentUser = c.get("authUser");
  const currentOrg = c.get("authOrg");
  const services = createServicesFromContext(c);

  const requestLog = log.child({ userId: currentUser.id, orgId: currentOrg.id });
  requestLog.debug({}, "events:stats:start");

  const stats = await services.event.getEventStats(currentOrg.id);

  requestLog.debug({ byType: stats.byType }, "events:stats:success");

  return c.json(stats);
});

// =============================================================================
// GET /events/types - Get available event types
// =============================================================================

events.get("/types", async (c) => {
  const currentOrg = c.get("authOrg");
  const services = createServicesFromContext(c);

  const types = await services.event.listEventTypes(currentOrg.id);

  const result = types.map((type) => {
    const registration = getEventRegistration(type);
    return {
      type,
      label: type, // Use dot notation format directly
      level: registration?.level || "info",
    };
  });

  return c.json({ types: result });
});

// =============================================================================
// GET /events/crm - CRM activity log
// =============================================================================

events.get("/crm", async (c) => {
  const currentUser = c.get("authUser");
  const currentOrg = c.get("authOrg");
  const services = createServicesFromContext(c);

  const queryResult = validateQuery(c, EventsListQuerySchema);
  if (!queryResult.success) {
    return queryResult.response;
  }

  const filters = {
    ...queryResult.data,
    types: parseCsvParam(queryResult.data.types),
  };

  const requestLog = log.child({ userId: currentUser.id, orgId: currentOrg.id, filters });
  requestLog.debug({}, "events:crm:list:start");

  // Map activity types to event types for filtering
  // If filters.types contains activity types like "stage_change", convert them to event types
  let eventTypesToQuery: string[];
  if (filters.types && filters.types.length > 0) {
    // Try to map activity types to event types
    const mappedTypes = mapActivityTypesToEventTypes(filters.types);
    // If mapping returned nothing, the filters.types might already be event types
    eventTypesToQuery = mappedTypes.length > 0 ? mappedTypes : filters.types;
  } else {
    eventTypesToQuery = getCrmEventTypes();
  }

  const { events: results, total } = await services.event.listCrmEvents({
    organizationId: currentOrg.id,
    eventTypes: eventTypesToQuery,
    startDate: filters.startDate,
    endDate: filters.endDate,
    limit: filters.limit,
    offset: filters.offset,
  });

  // Transform events to CRM activity format
  const activities = results.map((event) => ({
    id: event.id,
    clientId: event.clientId,
    organizationId: event.organizationId,
    activityType: mapEventTypeToActivityType(event.type),
    description: buildActivityDescription({
      type: event.type,
      payload: isRecord(event.payload) ? event.payload : {},
    }),
    metadata: event.payload,
    performedBy: event.performedBy,
    createdAt: event.timestamp,
    // Client info
    clientFirstName: event.clientFirstName,
    clientLastName: event.clientLastName,
    clientUsername: event.clientUsername,
  }));

  requestLog.debug({ resultCount: activities.length, total }, "events:crm:list:success");

  return c.json({
    activities,
    pagination: buildPaginationMeta(total, filters.limit, filters.offset, activities.length),
  });
});

// =============================================================================
// GET /events/llm - LLM usage events
// =============================================================================

events.get("/llm", async (c) => {
  const currentUser = c.get("authUser");
  const currentOrg = c.get("authOrg");
  const services = createServicesFromContext(c);

  const queryResult = validateQuery(c, EventsLlmQuerySchema);
  if (!queryResult.success) {
    return queryResult.response;
  }

  const filters = queryResult.data;
  const serviceFilters = parseCsvParam(filters.services);
  const models = parseCsvParam(filters.models);
  const providers = parseCsvParam(filters.providers);

  const requestLog = log.child({ userId: currentUser.id, orgId: currentOrg.id, filters });
  requestLog.debug({}, "events:llm:list:start");

  const { events: results, total } = await services.event.listLlmEvents({
    organizationId: currentOrg.id,
    services: serviceFilters,
    models,
    providers,
    startDate: filters.startDate,
    endDate: filters.endDate,
    limit: filters.limit,
    offset: filters.offset,
  });

  requestLog.debug({ resultCount: results.length, total }, "events:llm:list:success");

  return c.json({
    events: results,
    pagination: buildPaginationMeta(total, filters.limit, filters.offset, results.length),
  });
});

// =============================================================================
// GET /events/llm/stats - LLM usage statistics
// =============================================================================

events.get("/llm/stats", async (c) => {
  const currentUser = c.get("authUser");
  const currentOrg = c.get("authOrg");
  const services = createServicesFromContext(c);

  const requestLog = log.child({ userId: currentUser.id, orgId: currentOrg.id });
  requestLog.debug({}, "events:llm:stats:start");

  const stats = await services.event.getLlmStats(currentOrg.id);

  requestLog.debug({}, "events:llm:stats:success");

  return c.json(stats);
});

// =============================================================================
// GET /events/stream - SSE endpoint for real-time events
// =============================================================================

events.get("/stream", async (c) => {
  const currentUser = c.get("authUser");
  const currentOrg = c.get("authOrg");

  const requestLog = log.child({ userId: currentUser.id, orgId: currentOrg.id });

  // Check SSE connection rate limit per user (skip in test/dev mode)
  // This prevents a single user from opening too many concurrent SSE connections
  // In dev mode (ALLOW_MOCK_AUTH=true), skip rate limiting to support E2E tests with multiple workers
  if (!appConfig.auth.allowMockAuth) {
    const rateLimitResult = await checkRateLimit(`sse:${currentUser.id}`, RATE_LIMITS.sseConnections);

    if (!rateLimitResult.allowed) {
      requestLog.warn({ remaining: rateLimitResult.remaining }, "events:stream:rateLimited");
      return c.json(
        {
          error: "Too many SSE connections",
          code: "RATE_LIMIT_EXCEEDED",
          resetAt: new Date(rateLimitResult.resetAt).toISOString(),
        },
        429
      );
    }

    requestLog.info({ remaining: rateLimitResult.remaining }, "events:stream:connected");
  } else {
    requestLog.debug({}, "events:stream:connected:devMode");
  }

  return streamSSE(c, async (stream) => {
    let isConnected = true;
    let subscriber: ReturnType<typeof getRedisConnection> | null = null;
    let messageHandler: ((ch: string, message: string) => void) | null = null;
    const channel = `events:${currentOrg.id}`;

    // Cleanup function - handles all listener removal and connection closure
    const cleanup = async () => {
      if (!isConnected) return; // Prevent double cleanup
      isConnected = false;

      if (subscriber) {
        // Remove message listener first
        if (messageHandler) {
          subscriber.off("message", messageHandler);
          messageHandler = null;
        }

        // Remove all other listeners to prevent leaks
        subscriber.removeAllListeners();

        try {
          // Only unsubscribe if connected
          if (subscriber.status === "ready") {
            await subscriber.unsubscribe(channel);
          }
        } catch {
          // Ignore unsubscribe errors
        }

        try {
          // Disconnect the duplicate connection (cleaner than quit)
          await subscriber.disconnect();
        } catch {
          // Ignore disconnect errors
        }

        subscriber = null;
      }
      requestLog.info({}, "events:stream:disconnected");
    };

    // Handle client disconnect
    stream.onAbort(cleanup);

    try {
      // Create a separate Redis connection for subscribing
      // (pub/sub requires dedicated connection)
      const redis = getRedisConnection();
      const redisSubscriber = redis.duplicate();

      if (!redisSubscriber) {
        throw new ServiceUnavailableError("Failed to create Redis duplicate connection");
      }

      subscriber = redisSubscriber;

      // Ensure connection is established with proper listener cleanup
      if (redisSubscriber.status !== "ready") {
        await new Promise<void>((resolve, reject) => {
          let readyHandler: (() => void) | null = null;
          let errorHandler: ((err: Error) => void) | null = null;

          const timeoutId = setTimeout(() => {
            // Clean up listeners before rejecting
            if (readyHandler) redisSubscriber.off("ready", readyHandler);
            if (errorHandler) redisSubscriber.off("error", errorHandler);
            reject(new Error("Redis subscriber connection timeout"));
          }, 10000);

          readyHandler = () => {
            clearTimeout(timeoutId);
            if (errorHandler) redisSubscriber.off("error", errorHandler);
            resolve();
          };

          errorHandler = (err: Error) => {
            clearTimeout(timeoutId);
            if (readyHandler) redisSubscriber.off("ready", readyHandler);
            reject(err);
          };

          redisSubscriber.once("ready", readyHandler);
          redisSubscriber.once("error", errorHandler);

          // Explicitly trigger connection if in wait state
          if (redisSubscriber.status === "wait") {
            redisSubscriber.connect().catch((err) => {
              clearTimeout(timeoutId);
              if (readyHandler) redisSubscriber.off("ready", readyHandler);
              if (errorHandler) redisSubscriber.off("error", errorHandler);
              reject(err);
            });
          }
        });
      }

      // Verify connection with ping before subscribing
      await redisSubscriber.ping();

      // Subscribe to organization's event channel
      await redisSubscriber.subscribe(channel);

      // Send initial connected event
      await stream.writeSSE({
        event: "connected",
        data: JSON.stringify({ timestamp: new Date().toISOString() }),
      });

      // Create and register message handler
      messageHandler = (ch: string, message: string) => {
        if (!isConnected || ch !== channel) return;

        try {
          const event = JSON.parse(message);

          requestLog.debug(
            {
              eventType: event.type,
              sessionId: event.sessionId,
            },
            "events:stream:broadcasting"
          );

          stream.writeSSE({
            event: "event",
            data: JSON.stringify(event),
          });
        } catch (error) {
          requestLog.error({ err: serializeError(error) }, "events:stream:parseError");
        }
      };
      redisSubscriber.on("message", messageHandler);

      // Keep connection alive with heartbeats
      while (isConnected) {
        await stream.writeSSE({
          event: "heartbeat",
          data: JSON.stringify({ timestamp: new Date().toISOString() }),
        });
        await stream.sleep(30000); // 30 second heartbeat
      }
    } catch (error) {
      requestLog.error({ err: serializeError(error) }, "events:stream:error");
      await cleanup();
    }
  });
});

// =============================================================================
// HEALTH CHECK - Event system health
// =============================================================================

events.get("/health", async (c) => {
  try {
    const health = await getEventSystemHealth();

    // Return 200 for healthy, 503 for unhealthy
    const statusCode = health.status === "unhealthy" ? 503 : 200;

    return c.json(health, statusCode);
  } catch (error) {
    log.error({ err: serializeError(error) }, "events:health:error");
    return c.json(
      {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        error: "Health check failed",
      },
      503
    );
  }
});

// =============================================================================
// REPLAY API - Mount replay routes
// =============================================================================

events.route("/", eventsReplayRouter);
