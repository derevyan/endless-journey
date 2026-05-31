/**
 * Journey API Application
 *
 * Exports the Hono app for testing and server usage.
 *
 * @module api/app
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { bodyLimit } from "hono/body-limit";
import type { Context, Next } from "hono";
import { createLogger, serializeError } from "@journey/logger";
import { checkDatabaseHealth, db, member, organization } from "@journey/db";
import { user } from "@journey/db/schema";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { auth } from "./lib/auth";
import { type Variables } from "./lib/auth-helpers";
import { createTracingContext, runWithTracingAsync } from "./lib/event-tracing";
import { errorHandler } from "./lib/errors";
import { globalRateLimiter, authRateLimiter, webhookRateLimiter } from "./lib/rate-limiter";
import { getRequestId, requestLogger } from "./lib/request-logger";
import { appConfig } from "./config";
import { getSystemHealth } from "./services/health-check";
import { createApiRouter, createWebhookRouter } from "./modules/router";
import { parityTesting } from "./testing/parity-routes";

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Mock user definitions for testing.
 * The email is used to look up the actual user ID from the database.
 */
export const MOCK_USERS: Record<string, { email: string; name: string }> = {
  "user-demo": { name: "Demo User", email: "demo@journey.app" },
  "user-arina": { name: "Arina", email: "arina@journey.app" },
};

// =============================================================================
// APP SETUP
// =============================================================================

const log = createLogger("api");

export function createApp() {
  const app = new Hono<{ Variables: Variables }>();

  // Global error handler - catches all unhandled errors and formats them consistently
  app.onError(errorHandler);

  // CORS configuration
  const allowMockAuth = appConfig.auth.allowMockAuth;
  app.use(
    "*",
    cors({
      origin: [
        appConfig.frontend.url,
        "http://localhost:3000",
        "http://localhost:5173",
      ],
      credentials: true,
      allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      // Only allow mock user header when explicitly enabled
      allowHeaders: allowMockAuth
        ? ["Content-Type", "Authorization", "X-Mock-User-Id"]
        : ["Content-Type", "Authorization"],
    })
  );

  // ===========================================================================
  // REQUEST LOGGING
  // ===========================================================================

  // Log requests with timing and request IDs
  // Adds X-Request-Id header for request tracing
  app.use("*", requestLogger);

  // ===========================================================================
  // BODY SIZE LIMITING (Route-Specific)
  // ===========================================================================

  // Helper to create body limit middleware with consistent error format
  const createBodyLimit = (maxSizeMB: number, routeType: string) =>
    bodyLimit({
      maxSize: maxSizeMB * 1024 * 1024,
      onError: (c) => {
        log.warn({ path: c.req.path, method: c.req.method, routeType }, "api:bodyLimit:exceeded");
        return c.json(
          {
            success: false,
            error: {
              code: "PAYLOAD_TOO_LARGE",
              message: `Request body too large. Maximum size is ${maxSizeMB}MB.`,
            },
          },
          413
        );
      },
    });

  // Upload routes: 300MB limit for file uploads
  app.use("/api/uploads/*", createBodyLimit(300, "uploads"));

  // Webhook routes: 1MB limit (Telegram sends JSON payloads)
  app.use("/webhook/*", createBodyLimit(1, "webhook"));

  // General API routes: 1MB limit for JSON payloads (exclude uploads)
  const apiBodyLimit = createBodyLimit(1, "api");
  app.use("/api/*", async (c, next) => {
    if (c.req.path.startsWith("/api/uploads")) {
      return next();
    }
    return apiBodyLimit(c, next);
  });

  // ===========================================================================
  // RATE LIMITING
  // ===========================================================================

  // Disable rate limiting when mock auth is enabled (testing/development scenarios)
  // In production, ALLOW_MOCK_AUTH should never be true, so rate limiting is always active
  if (!allowMockAuth) {
    // Global rate limiter: 100 req/min per user/IP (configurable via RATE_LIMIT_GLOBAL)
    // Skip for health checks and static assets
    app.use("*", async (c, next) => {
      const path = c.req.path;
      // Skip rate limiting for health checks
      if (path === "/health" || path === "/health/detailed") {
        return next();
      }
      return globalRateLimiter(c, next);
    });

    // Auth endpoint rate limiter: 10 req/15min per IP (stricter for brute force protection)
    app.use("/api/auth/*", authRateLimiter);

    // Webhook rate limiter: 200 req/min per channel (higher for automated traffic)
    app.use("/webhook/*", webhookRateLimiter);
  }

  // ===========================================================================
  // MIDDLEWARE
  // ===========================================================================

  /**
   * Tracing middleware - initializes event tracing context for each request
   *
   * This middleware wraps the entire request in an AsyncLocalStorage context,
   * allowing events created during the request to be automatically correlated.
   */
  app.use("*", async (c, next) => {
    const requestId = getRequestId(c) ?? randomUUID();
    const userAgent = c.req.header("user-agent");
    const ipAddress =
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
      c.req.header("x-real-ip") ||
      "unknown";

    // Check for correlation ID from incoming request (for cross-service tracing)
    const incomingCorrelationId = c.req.header("x-correlation-id");

    const tracingContext = createTracingContext({
      correlationId: incomingCorrelationId,
      requestId,
      userAgent,
      ipAddress,
    });

    // Wrap the entire request in the tracing context
    return runWithTracingAsync(tracingContext, () => next());
  });

  /**
   * Auth middleware - extracts user and organization from session or mock header
   *
   * Security: Mock user header is only allowed when ALLOW_MOCK_AUTH=true.
   * This requires explicit opt-in, preventing accidental exposure in staging/preview.
   */
  async function authMiddleware(c: Context, next: Next) {
    try {
      // Check for mock user header (only when explicitly enabled)
      if (allowMockAuth) {
        const mockUserId = c.req.header("X-Mock-User-Id");
        if (mockUserId) {
          const mockUser = MOCK_USERS[mockUserId];
          if (mockUser) {
            // Look up actual user by email to get the real database ID
            const dbUsers = await db.select().from(user).where(eq(user.email, mockUser.email));
            if (dbUsers.length > 0) {
              const userId = dbUsers[0].id;
              c.set("user", {
                id: userId,
                email: dbUsers[0].email,
                name: dbUsers[0].name,
              });

              // Get user's default organization for mock user
              const userMember = await db
                .select({
                  orgId: organization.id,
                  orgName: organization.name,
                  orgSlug: organization.slug,
                  role: member.role,
                })
                .from(member)
                .innerJoin(organization, eq(member.organizationId, organization.id))
                .where(eq(member.userId, userId))
                .limit(1);

              if (userMember.length > 0) {
                c.set("organization", {
                  id: userMember[0].orgId,
                  name: userMember[0].orgName,
                  slug: userMember[0].orgSlug,
                  role: userMember[0].role,
                });
              } else {
                c.set("organization", null);
              }

              await next();
              return;
            }
            // Fallback: user not in DB yet, use mock data (for tests that don't need DB)
            c.set("user", { id: mockUserId, email: mockUser.email, name: mockUser.name });
            c.set("organization", null);
            await next();
            return;
          }
        }
      }

      // Check for Better Auth session (production and non-production)
      const session = await auth.api.getSession({
        headers: c.req.raw.headers,
      });

      if (session?.user) {
        c.set("user", {
          id: session.user.id,
          email: session.user.email,
          name: session.user.name,
        });

        // Get active organization from session
        // The session includes activeOrganizationId if organization plugin is enabled
        const sessionData = session.session as { activeOrganizationId?: string };
        if (sessionData.activeOrganizationId) {
          // Fetch organization details and user's role
          const orgData = await db
            .select({
              orgId: organization.id,
              orgName: organization.name,
              orgSlug: organization.slug,
              role: member.role,
            })
            .from(organization)
            .innerJoin(member, and(eq(member.organizationId, organization.id), eq(member.userId, session.user.id)))
            .where(eq(organization.id, sessionData.activeOrganizationId))
            .limit(1);

          if (orgData.length > 0) {
            c.set("organization", {
              id: orgData[0].orgId,
              name: orgData[0].orgName,
              slug: orgData[0].orgSlug,
              role: orgData[0].role,
            });
          } else {
            c.set("organization", null);
          }
        } else {
          // No active organization set, try to get the user's first organization
          const userOrg = await db
            .select({
              orgId: organization.id,
              orgName: organization.name,
              orgSlug: organization.slug,
              role: member.role,
            })
            .from(member)
            .innerJoin(organization, eq(member.organizationId, organization.id))
            .where(eq(member.userId, session.user.id))
            .limit(1);

          if (userOrg.length > 0) {
            c.set("organization", {
              id: userOrg[0].orgId,
              name: userOrg[0].orgName,
              slug: userOrg[0].orgSlug,
              role: userOrg[0].role,
            });
          } else {
            c.set("organization", null);
          }
        }
      } else {
        c.set("user", null);
        c.set("organization", null);
      }
    } catch (error) {
      log.debug({ err: serializeError(error) }, "api:authMiddleware:error");
      c.set("user", null);
      c.set("organization", null);
    }

    await next();
  }

  // ===========================================================================
  // ROUTES
  // ===========================================================================

  // Health check (public) - basic health for load balancers
  app.get("/health", async (c: Context) => {
    const dbHealthy = await checkDatabaseHealth();
    log.debug({ path: "/health", dbHealthy }, "api:health");
    return c.json({
      status: dbHealthy ? "ok" : "degraded",
      database: dbHealthy ? "connected" : "disconnected",
      environment: appConfig.env.nodeEnv,
      timestamp: new Date().toISOString(),
    });
  });

  // Detailed health check (public) - comprehensive system health
  app.get("/health/detailed", async (c: Context) => {
    try {
      const health = await getSystemHealth();
      log.debug({ path: "/health/detailed", status: health.status }, "api:health:detailed");

      // Return 200 for healthy/degraded, 503 for unhealthy
      const statusCode = health.status === "unhealthy" ? 503 : 200;
      return c.json(health, statusCode);
    } catch (error) {
      log.error({ err: serializeError(error) }, "api:health:detailed:error");
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

  // Better Auth routes
  app.on(["GET", "POST"], "/api/auth/*", (c) => {
    return auth.handler(c.req.raw);
  });

  // Apply auth middleware to /api routes (except auth)
  app.use("/api/*", async (c, next) => {
    // Skip auth middleware for auth routes
    if (c.req.path.startsWith("/api/auth")) {
      return next();
    }
    return authMiddleware(c, next);
  });

  // ===========================================================================
  // CURRENT USER ENDPOINT (must be before authenticated sub-routers)
  // ===========================================================================

  /**
   * GET /api/me - Get current authenticated user and organization
   *
   * Returns the user and organization from context (set by authMiddleware).
   * The middleware handles all auth logic including mock users.
   * This route is NOT protected - it returns null values for unauthenticated users.
   */
  app.get("/api/me", async (c: Context) => {
    const currentUser = c.get("user");
    const currentOrg = c.get("organization");
    const isMockUser = allowMockAuth && !!c.req.header("X-Mock-User-Id");

    return c.json({
      user: currentUser,
      organization: currentOrg,
      ...(isMockUser && { isMockUser: true }),
    });
  });

  // ===========================================================================
  // MODULE ROUTES
  // ===========================================================================

  // Mount all API routes via central router
  // See modules/router.ts for the full route composition
  const apiRouter = createApiRouter();
  if (appConfig.env.isTest) {
    apiRouter.route("/testing/parity", parityTesting);
  }
  app.route("/api", apiRouter);

  // ===========================================================================
  // WEBHOOK ROUTES
  // ===========================================================================

  // Mount webhook routes (separate from API - no auth, different rate limits)
  app.route("/webhook", createWebhookRouter());

  return app;
}

// Create default app instance
export const app = createApp();
