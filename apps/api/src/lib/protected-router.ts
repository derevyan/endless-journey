/**
 * Protected Router Factory
 *
 * Creates Hono routers with declarative, centralized auth configuration.
 * Provides centralized auth with:
 * - RBAC permission checks via Better Auth
 * - Resource ownership verification
 * - Role-based access control
 * - Comprehensive audit logging
 *
 * @module lib/protected-router
 *
 * @example
 * ```typescript
 * // Create router with default permission
 * const router = createProtectedRouter({
 *   defaultPermission: { resource: "journey", action: "read" },
 * });
 *
 * // Add per-route protection
 * router.delete(
 *   "/:id",
 *   protect({
 *     permission: { resource: "journey", action: "delete" },
 *     resource: { type: "journey", extractor: { param: "id" } },
 *     roles: ["owner", "admin"],
 *   }),
 *   async (c) => {
 *     const journeyId = c.get("verifiedResourceId")!;
 *     // ... handler logic
 *   }
 * );
 * ```
 */

import { Hono } from "hono";
import type { Context, MiddlewareHandler } from "hono";
import { createLogger, serializeError } from "@journey/logger";
import { ForbiddenError, UnauthorizedError } from "@journey/schemas";

import type { AuthenticatedVariables } from "./auth-helpers";
import type { Permission, JourneyResource, JourneyAction } from "./permissions";
import {
  logSecurityEvent,
  logAuthFailure,
  logInsufficientRole,
  logPermissionDenied,
  logAccessGranted,
  logResourceVerified,
  logResourceOwnershipDenied,
  logCustomGuardDenied,
} from "./auth-audit";

const log = createLogger("protected-router");

// =============================================================================
// TYPES
// =============================================================================

/**
 * Resource types that can have ownership verified.
 * Maps to functions in org-guards.ts
 */
export type OwnedResource =
  | "journey"
  | "client"
  | "session"
  | "workflow"
  | "persona";

/**
 * Configuration for extracting resource ID from request.
 * Only ONE of param, query, or body should be specified.
 */
export interface ResourceExtractor {
  /** Route parameter name (e.g., "id", "journeyId") */
  param?: string;
  /** Query parameter name (e.g., "journeyId") */
  query?: string;
  /** Body field path using dot notation (e.g., "sessionId", "data.journeyId") */
  body?: string;
}

/**
 * Resource guard configuration for ownership verification.
 */
export interface ResourceGuardConfig {
  /** Type of resource to verify ownership for */
  type: OwnedResource;
  /** How to extract the resource ID from the request */
  extractor: ResourceExtractor;
  /** Action being performed (for audit logging) */
  action?: string;
}

/**
 * Route protection configuration.
 * All properties are optional - use only what you need.
 */
export interface RouteProtection<R extends JourneyResource = JourneyResource> {
  /**
   * Required RBAC permission.
   * Checked via Better Auth hasPermission API.
   */
  permission?: Permission<R>;

  /**
   * Resource ownership to verify.
   * Ensures the resource belongs to the user's organization.
   */
  resource?: ResourceGuardConfig;

  /**
   * Required organization roles.
   * User must have one of these roles to access.
   * @example ["owner", "admin"]
   */
  roles?: string[];

  /**
   * Custom guard function.
   * Return true to allow access, false to deny.
   */
  guard?: (c: ProtectedContext) => Promise<boolean>;

  /**
   * Skip audit logging for this route.
   * Use for high-frequency endpoints where logging would be too noisy.
   */
  skipAudit?: boolean;
}

/**
 * Router-level default configuration.
 * Applied to all routes on the router unless overridden.
 */
export interface ProtectedRouterConfig {
  /**
   * Default permission for all routes.
   * Can be overridden per-route with protect() middleware.
   */
  defaultPermission?: Permission;

  /**
   * Required roles for all routes on this router.
   * @example ["owner", "admin"] for admin-only routers
   */
  requiredRoles?: string[];

  /**
   * Enable audit logging (default: true).
   * Set to false for test/development environments.
   */
  auditLogging?: boolean;
}

/**
 * Extended context variables for protected routes.
 */
export interface ProtectedVariables extends AuthenticatedVariables {
  /** Verified resource ID after ownership check passes */
  verifiedResourceId?: string;
  /** Verified resource type */
  verifiedResourceType?: OwnedResource;
}

/**
 * Context type for protected route handlers.
 */
export type ProtectedContext = Context<{ Variables: ProtectedVariables }>;

// =============================================================================
// PROTECTED ROUTER FACTORY
// =============================================================================

/**
 * Create a protected router with declarative auth configuration.
 *
 * All routes on this router automatically:
 * 1. Require authenticated user (401 if missing)
 * 2. Require active organization (400 if missing)
 * 3. Check required roles if configured
 * 4. Check default permission if configured
 *
 * @param config - Router-level configuration
 * @returns Hono router with auth middleware applied
 *
 * @example
 * ```typescript
 * // Basic protected router
 * const router = createProtectedRouter();
 *
 * // With RBAC
 * const router = createProtectedRouter({
 *   defaultPermission: { resource: "journey", action: "read" },
 * });
 *
 * // Admin-only router
 * const router = createProtectedRouter({
 *   requiredRoles: ["owner", "admin"],
 * });
 * ```
 */
export function createProtectedRouter(config: ProtectedRouterConfig = {}) {
  const router = new Hono<{ Variables: ProtectedVariables }>();
  const { auditLogging = true } = config;

  // -------------------------------------------------------------------------
  // Base Auth Middleware
  // -------------------------------------------------------------------------
  router.use("*", async (c, next) => {
    const user = c.get("user");
    const organization = c.get("organization");

    // Check authentication
    if (!user) {
      if (auditLogging) {
        logAuthFailure({
          type: "auth:unauthorized",
          path: c.req.path,
          method: c.req.method,
        });
      }
      throw new UnauthorizedError("Authentication required");
    }

    // Check organization
    if (!organization) {
      if (auditLogging) {
        logAuthFailure({
          type: "auth:noOrganization",
          path: c.req.path,
          method: c.req.method,
          userId: user.id,
        });
      }
      return c.json(
        {
          error: "No active organization. Please select an organization.",
          code: "NO_ORGANIZATION",
        },
        400
      );
    }

    // Set guaranteed non-null values for handler access
    c.set("authUser", user);
    c.set("authOrg", organization);

    // -----------------------------------------------------------------------
    // Router-Level Checks
    // -----------------------------------------------------------------------

    // Check required roles
    if (config.requiredRoles && config.requiredRoles.length > 0) {
      const hasRole = config.requiredRoles.includes(organization.role);
      if (!hasRole) {
        if (auditLogging) {
          logInsufficientRole({
            userId: user.id,
            organizationId: organization.id,
            requiredRoles: config.requiredRoles,
            actualRole: organization.role,
            path: c.req.path,
            method: c.req.method,
          });
        }
        throw new ForbiddenError("Insufficient permissions");
      }
    }

    // Check default permission
    if (config.defaultPermission) {
      const hasPermission = await checkPermission(c, config.defaultPermission);
      if (!hasPermission) {
        if (auditLogging) {
          logPermissionDenied({
            userId: user.id,
            organizationId: organization.id,
            permission: config.defaultPermission,
            path: c.req.path,
            method: c.req.method,
          });
        }
        throw new ForbiddenError("Permission denied");
      }
    }

    await next();
  });

  return router;
}

// =============================================================================
// ROUTE-LEVEL PROTECTION MIDDLEWARE
// =============================================================================

/**
 * Create middleware for route-specific protection.
 *
 * Use this to add per-route auth requirements beyond the router defaults.
 * Can check permissions, roles, resource ownership, or custom guards.
 *
 * @param config - Route protection configuration
 * @returns Hono middleware handler
 *
 * @example
 * ```typescript
 * // Permission check
 * router.delete("/:id", protect({
 *   permission: { resource: "journey", action: "delete" },
 * }), handler);
 *
 * // Resource ownership
 * router.get("/sessions/:id", protect({
 *   resource: { type: "session", extractor: { param: "id" } },
 * }), handler);
 *
 * // Combined
 * router.post("/execute", protect({
 *   permission: { resource: "simulator", action: "execute" },
 *   resource: { type: "session", extractor: { body: "sessionId" } },
 *   roles: ["owner", "admin", "member"],
 * }), handler);
 * ```
 */
export function protect<R extends JourneyResource = JourneyResource>(
  config: RouteProtection<R>
): MiddlewareHandler<{ Variables: ProtectedVariables }> {
  return async (c, next) => {
    const user = c.get("authUser");
    const organization = c.get("authOrg");

    // -----------------------------------------------------------------------
    // Role Check
    // -----------------------------------------------------------------------
    if (config.roles && config.roles.length > 0) {
      const hasRole = config.roles.includes(organization.role);
      if (!hasRole) {
        logInsufficientRole({
          userId: user.id,
          organizationId: organization.id,
          requiredRoles: config.roles,
          actualRole: organization.role,
          path: c.req.path,
          method: c.req.method,
        });
        throw new ForbiddenError("Insufficient permissions");
      }
    }

    // -----------------------------------------------------------------------
    // Permission Check
    // -----------------------------------------------------------------------
    if (config.permission) {
      const hasPermission = await checkPermission(c, config.permission);
      if (!hasPermission) {
        logPermissionDenied({
          userId: user.id,
          organizationId: organization.id,
          permission: config.permission,
          path: c.req.path,
          method: c.req.method,
        });
        throw new ForbiddenError("Permission denied");
      }
    }

    // -----------------------------------------------------------------------
    // Resource Ownership Check
    // -----------------------------------------------------------------------
    if (config.resource) {
      await verifyResourceOwnership(c, config.resource);
    }

    // -----------------------------------------------------------------------
    // Custom Guard
    // -----------------------------------------------------------------------
    if (config.guard) {
      const allowed = await config.guard(c);
      if (!allowed) {
        logCustomGuardDenied({
          userId: user.id,
          organizationId: organization.id,
          path: c.req.path,
          method: c.req.method,
        });
        throw new ForbiddenError("Access denied");
      }
    }

    // -----------------------------------------------------------------------
    // Log Successful Access
    // -----------------------------------------------------------------------
    if (!config.skipAudit) {
      logAccessGranted({
        userId: user.id,
        organizationId: organization.id,
        path: c.req.path,
        method: c.req.method,
        resource: config.resource?.type,
        resourceId: c.get("verifiedResourceId"),
        action: config.resource?.action ?? config.permission?.action,
      });
    }

    await next();
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Check RBAC permission using the user's role.
 *
 * Uses the role from context to check if the user has the specified
 * permission. This works with both mock users (test) and real users.
 *
 * @param c - Hono context
 * @param permission - Permission to check
 * @returns true if user has permission, false otherwise
 */
async function checkPermission(
  c: ProtectedContext,
  permission: Permission
): Promise<boolean> {
  // Dynamic import to avoid circular dependencies
  const { owner, admin, member } = await import("./permissions");

  const organization = c.get("authOrg");
  const role = organization.role;

  // Get the role definition based on the user's role
  let roleStatements: Record<string, readonly string[]> | undefined;
  switch (role) {
    case "owner":
      roleStatements = owner.statements as Record<string, readonly string[]>;
      break;
    case "admin":
      roleStatements = admin.statements as Record<string, readonly string[]>;
      break;
    case "member":
      roleStatements = member.statements as Record<string, readonly string[]>;
      break;
    default:
      log.warn({ role }, "protectedRouter:checkPermission:unknownRole");
      return false;
  }

  // Check if the role has the required permission
  const resourceActions = roleStatements[permission.resource];
  if (!resourceActions) {
    log.debug(
      { role, resource: permission.resource },
      "protectedRouter:checkPermission:noResourceInRole"
    );
    return false;
  }

  const hasPermission = resourceActions.includes(permission.action);
  log.debug(
    { role, permission, hasPermission },
    "protectedRouter:checkPermission:result"
  );

  return hasPermission;
}

/**
 * Verify resource ownership.
 *
 * Extracts the resource ID from the request and verifies it belongs
 * to the user's organization. Throws NotFoundError if not.
 *
 * @param c - Hono context
 * @param config - Resource guard configuration
 */
async function verifyResourceOwnership(
  c: ProtectedContext,
  config: ResourceGuardConfig
): Promise<void> {
  // Dynamic import to avoid circular dependencies
  const {
    requireJourneyOwnership,
    requireClientOwnership,
    requireSessionOwnership,
  } = await import("./org-guards");

  const user = c.get("authUser");
  const organization = c.get("authOrg");

  // Extract resource ID from request
  const resourceId = await extractResourceId(c, config.extractor);
  if (!resourceId) {
    logResourceOwnershipDenied({
      userId: user.id,
      organizationId: organization.id,
      resource: config.type,
      resourceId: "MISSING",
      path: c.req.path,
      reason: "missing_resource_id",
    });
    throw new ForbiddenError(`Missing ${config.type} identifier`);
  }

  // Verify ownership based on resource type
  // These functions throw NotFoundError if ownership check fails
  try {
    switch (config.type) {
      case "journey":
        await requireJourneyOwnership(resourceId, organization.id, user.id);
        break;
      case "client":
        await requireClientOwnership(resourceId, organization.id, user.id);
        break;
      case "session":
        await requireSessionOwnership(resourceId, organization.id, user.id);
        break;
      case "workflow":
        // Workflows are org-scoped via service layer, no separate guard needed
        break;
      case "persona":
        // Personas are org-scoped via service layer, no separate guard needed
        break;
      default:
        log.warn(
          { resourceType: config.type },
          "protectedRouter:unknownResourceType"
        );
    }

    // Log successful verification
    logResourceVerified({
      userId: user.id,
      organizationId: organization.id,
      resource: config.type,
      resourceId,
      action: config.action,
      path: c.req.path,
    });

    // Store verified resource for handler use
    c.set("verifiedResourceId", resourceId);
    c.set("verifiedResourceType", config.type);
  } catch (error) {
    // Re-throw - the org-guards already log the denial
    throw error;
  }
}

/**
 * Extract resource ID from request.
 *
 * Checks param, query, and body in order based on extractor config.
 *
 * @param c - Hono context
 * @param extractor - Extraction configuration
 * @returns Resource ID or undefined if not found
 */
async function extractResourceId(
  c: ProtectedContext,
  extractor: ResourceExtractor
): Promise<string | undefined> {
  // Try route parameter first
  if (extractor.param) {
    const value = c.req.param(extractor.param);
    if (value) return value;
  }

  // Try query parameter
  if (extractor.query) {
    const value = c.req.query(extractor.query);
    if (value) return value;
  }

  // Try body field (supports dot notation)
  if (extractor.body) {
    try {
      // Clone request to avoid consuming body
      const clonedRequest = c.req.raw.clone();
      const body = await clonedRequest.json();
      const value = getNestedValue(body, extractor.body);
      if (typeof value === "string") return value;
    } catch {
      // Body parse failed, continue
    }
  }

  return undefined;
}

/**
 * Get nested value from object using dot notation.
 *
 * @param obj - Object to traverse
 * @param path - Dot-separated path (e.g., "data.journeyId")
 * @returns Value at path or undefined
 */
function getNestedValue(obj: unknown, path: string): unknown {
  const parts = path.split(".");
  let current = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

