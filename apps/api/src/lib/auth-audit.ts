/**
 * Security Audit Logging
 *
 * Comprehensive logging for all auth-related security events.
 * Logs both successful access and access denials for full audit trail.
 *
 * Event categories:
 * - auth:* - Authentication events (unauthorized, no org, etc.)
 * - route:* - Route access events (granted, denied, role checks)
 * - resource:* - Resource ownership events (verified, denied)
 *
 * @module lib/auth-audit
 */

import { createLogger } from "@journey/logger";
import type { Permission } from "./permissions";

const log = createLogger("security:audit");

// =============================================================================
// TYPES
// =============================================================================

/**
 * Base security event properties
 */
interface BaseSecurityEvent {
  /** Event type (e.g., "auth:unauthorized", "route:accessGranted") */
  type: string;
  /** User ID if available */
  userId?: string;
  /** Organization ID if available */
  organizationId?: string;
  /** Request path */
  path?: string;
  /** HTTP method */
  method?: string;
}

/**
 * Authentication failure event
 */
export interface AuthFailureEvent extends BaseSecurityEvent {
  type:
    | "auth:unauthorized"
    | "auth:noOrganization"
    | "auth:sessionExpired"
    | "auth:invalidSession";
}

/**
 * Role check event
 */
export interface RoleCheckEvent extends BaseSecurityEvent {
  type: "auth:insufficientRole" | "route:insufficientRole";
  /** Roles required for access */
  requiredRoles: string[];
  /** User's actual role */
  actualRole: string;
}

/**
 * Permission check event
 */
export interface PermissionCheckEvent extends BaseSecurityEvent {
  type: "auth:permissionDenied" | "route:permissionDenied";
  /** Permission that was required */
  permission: Permission;
}

/**
 * Resource access event
 */
export interface ResourceAccessEvent extends BaseSecurityEvent {
  type:
    | "resource:verified"
    | "resource:ownershipDenied"
    | "route:accessGranted"
    | "route:customGuardDenied";
  /** Type of resource (journey, client, session, etc.) */
  resource?: string;
  /** ID of the resource */
  resourceId?: string;
  /** Action being performed */
  action?: string;
}

/**
 * Cross-organization access attempt (high severity)
 */
export interface CrossOrgAccessEvent extends BaseSecurityEvent {
  type: "security:crossOrgAccessAttempt";
  /** User's organization ID */
  userOrgId: string;
  /** Target organization ID that was attempted */
  targetOrgId: string;
  /** Type of resource that was targeted */
  resourceType: string;
  /** ID of the resource that was targeted */
  resourceId: string;
  /** Severity level */
  severity: "HIGH";
}

/**
 * Union of all security event types
 */
export type SecurityEvent =
  | AuthFailureEvent
  | RoleCheckEvent
  | PermissionCheckEvent
  | ResourceAccessEvent
  | CrossOrgAccessEvent;

// =============================================================================
// LOGGING FUNCTIONS
// =============================================================================

/**
 * Log a security event.
 *
 * Events are logged at different levels based on type:
 * - warn: Access denials, permission failures, role failures
 * - info: Successful access grants
 * - debug: Routine checks
 * - error: Cross-org access attempts (high severity)
 *
 * @param event - The security event to log
 */
export function logSecurityEvent(event: SecurityEvent): void {
  const { type, ...payload } = event;
  const eventTag = `security:${type}`;

  // Determine log level based on event type
  if (type === "security:crossOrgAccessAttempt") {
    // Cross-org access is a high-severity security event
    log.error(payload, eventTag);
  } else if (
    type.includes("Denied") ||
    type.includes("unauthorized") ||
    type.includes("insufficient") ||
    type.includes("Expired") ||
    type.includes("invalid")
  ) {
    // Access denials and failures are warnings
    log.warn(payload, eventTag);
  } else if (type.includes("Granted") || type.includes("verified")) {
    // Successful access is info level
    log.info(payload, eventTag);
  } else {
    // Everything else is debug
    log.debug(payload, eventTag);
  }
}

/**
 * Log an authentication failure.
 *
 * @param params - Event parameters
 */
export function logAuthFailure(params: {
  type: AuthFailureEvent["type"];
  path: string;
  method?: string;
  userId?: string;
}): void {
  logSecurityEvent({
    ...params,
    method: params.method ?? "GET",
  });
}

/**
 * Log an insufficient role check.
 *
 * @param params - Event parameters
 */
export function logInsufficientRole(params: {
  userId: string;
  organizationId: string;
  requiredRoles: string[];
  actualRole: string;
  path: string;
  method?: string;
}): void {
  logSecurityEvent({
    type: "route:insufficientRole",
    ...params,
  });
}

/**
 * Log a permission denied event.
 *
 * @param params - Event parameters
 */
export function logPermissionDenied(params: {
  userId: string;
  organizationId: string;
  permission: Permission;
  path: string;
  method?: string;
}): void {
  logSecurityEvent({
    type: "route:permissionDenied",
    ...params,
  });
}

/**
 * Log successful route access.
 *
 * @param params - Event parameters
 */
export function logAccessGranted(params: {
  userId: string;
  organizationId: string;
  path: string;
  method?: string;
  resource?: string;
  resourceId?: string;
  action?: string;
}): void {
  logSecurityEvent({
    type: "route:accessGranted",
    ...params,
  });
}

/**
 * Log successful resource ownership verification.
 *
 * @param params - Event parameters
 */
export function logResourceVerified(params: {
  userId: string;
  organizationId: string;
  resource: string;
  resourceId: string;
  action?: string;
  path?: string;
}): void {
  logSecurityEvent({
    type: "resource:verified",
    ...params,
  });
}

/**
 * Log resource ownership denial.
 *
 * @param params - Event parameters
 */
export function logResourceOwnershipDenied(params: {
  userId: string;
  organizationId: string;
  resource: string;
  resourceId: string;
  path?: string;
  reason?: string;
}): void {
  logSecurityEvent({
    type: "resource:ownershipDenied",
    ...params,
  } as ResourceAccessEvent);
}

/**
 * Log a cross-organization access attempt.
 *
 * This is a HIGH SEVERITY event indicating potential security breach attempt.
 * Should be monitored and alerted on.
 *
 * @param params - Event parameters
 */
export function logCrossOrgAccess(params: {
  userId: string;
  userOrgId: string;
  targetOrgId: string;
  resourceType: string;
  resourceId: string;
  path: string;
}): void {
  logSecurityEvent({
    type: "security:crossOrgAccessAttempt",
    organizationId: params.userOrgId,
    severity: "HIGH",
    ...params,
  });
}

/**
 * Log custom guard denial.
 *
 * @param params - Event parameters
 */
export function logCustomGuardDenied(params: {
  userId: string;
  organizationId: string;
  path: string;
  method?: string;
  reason?: string;
}): void {
  logSecurityEvent({
    type: "route:customGuardDenied",
    ...params,
  } as ResourceAccessEvent);
}
