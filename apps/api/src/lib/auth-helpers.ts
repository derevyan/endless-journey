/**
 * Authentication Type Definitions
 *
 * Type definitions for user and organization context in route handlers.
 * These types are used by the authenticated router and protected router.
 *
 * @module lib/auth-helpers
 */

/**
 * Authenticated user from Better Auth session.
 */
export type AuthenticatedUser = {
  id: string;
  email: string;
  name: string;
};

/**
 * Active organization context from Better Auth session.
 */
export type ActiveOrganization = {
  id: string;
  name: string;
  slug: string | null;
  role: string; // "owner" | "admin" | "member"
};

/**
 * Hono context variables for auth middleware.
 * Set by authMiddleware and used by all routes.
 */
export type Variables = {
  user: AuthenticatedUser | null;
  organization: ActiveOrganization | null;
};

/**
 * Extended context variables for authenticated routes.
 * Includes guaranteed non-null user and organization.
 */
export type AuthenticatedVariables = Variables & {
  /** Authenticated user (guaranteed non-null in authenticated routes) */
  authUser: AuthenticatedUser;
  /** Active organization (guaranteed non-null in authenticated routes) */
  authOrg: ActiveOrganization;
};
