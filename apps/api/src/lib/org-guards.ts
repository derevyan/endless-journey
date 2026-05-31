/**
 * Organization Ownership Guards
 *
 * Centralized security helpers for validating resource ownership.
 * All guards throw NotFoundError (not ForbiddenError) to avoid leaking
 * information about resource existence to unauthorized users.
 *
 * @module lib/org-guards
 */

import { createLogger, serializeError } from "@journey/logger";
import { NotFoundError, createJourneyIdOrSlug, type JourneyIdOrSlug } from "@journey/schemas";
import { createServicesForOrganization, createServicesForSystem } from "../services";

const log = createLogger("org-guards");

// =============================================================================
// SECURITY AUDIT LOGGING
// =============================================================================

interface AccessDeniedParams {
  userId: string;
  organizationId: string;
  resourceType: "client" | "session" | "journey";
  resourceId: string;
  reason: string;
}

/**
 * Log cross-organization access denial for security monitoring.
 * Uses warn level to ensure visibility in logs without cluttering error tracking.
 */
function logAccessDenied(params: AccessDeniedParams): void {
  log.warn(
    {
      userId: params.userId,
      organizationId: params.organizationId,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      reason: params.reason,
    },
    "security:crossOrgAccessDenied"
  );
}

// =============================================================================
// CLIENT OWNERSHIP
// =============================================================================

/**
 * Verify client belongs to organization before allowing access.
 * Returns 404 (not 403) to avoid leaking client existence information.
 *
 * Client ownership is determined by whether the client has any sessions
 * in journeys belonging to the organization.
 *
 * @throws NotFoundError if client doesn't belong to organization
 */
export async function requireClientOwnership(
  clientId: string,
  organizationId: string,
  userId: string
): Promise<void> {
  const services = createServicesForOrganization({ organizationId });
  const belongs = await services.tag.verifyClientBelongsToOrg(clientId);
  if (!belongs) {
    logAccessDenied({
      userId,
      organizationId,
      resourceType: "client",
      resourceId: clientId,
      reason: "client_not_in_org",
    });
    throw new NotFoundError("Client", clientId);
  }
}

// =============================================================================
// SESSION OWNERSHIP
// =============================================================================

/**
 * Get the organization ID for a session by looking up its journey.
 *
 * @returns organizationId or null if session/journey not found
 */
async function getSessionOrganizationId(sessionId: string): Promise<string | null> {
  try {
    const services = createServicesForSystem();
    const session = await services.channel.getSessionById(sessionId);
    if (!session) {
      return null;
    }

    // Get organization from the session's journey
    return await services.channel.getJourneyOrganizationId(session.journeyId);
  } catch (error) {
    log.error(
      { sessionId, err: serializeError(error) },
      "orgGuards:getSessionOrganizationId:error"
    );
    return null;
  }
}

/**
 * Verify session belongs to organization before allowing access.
 * Returns 404 (not 403) to avoid leaking session existence information.
 *
 * Session ownership is determined by the journey's organization.
 *
 * @throws NotFoundError if session doesn't exist or doesn't belong to organization
 */
export async function requireSessionOwnership(
  sessionId: string,
  organizationId: string,
  userId: string
): Promise<void> {
  const sessionOrgId = await getSessionOrganizationId(sessionId);

  if (!sessionOrgId) {
    // Session doesn't exist - throw NotFoundError without audit log
    throw new NotFoundError("Session", sessionId);
  }

  if (sessionOrgId !== organizationId) {
    logAccessDenied({
      userId,
      organizationId,
      resourceType: "session",
      resourceId: sessionId,
      reason: "session_belongs_to_different_org",
    });
    throw new NotFoundError("Session", sessionId);
  }
}

// =============================================================================
// JOURNEY OWNERSHIP
// =============================================================================

/**
 * Verify journey belongs to organization before allowing access.
 * Returns 404 (not 403) to avoid leaking journey existence information.
 *
 * Works with both UUID and slug identifiers.
 *
 * @throws NotFoundError if journey doesn't exist or doesn't belong to organization
 */
export async function requireJourneyOwnership(
  journeyIdOrSlug: string,
  organizationId: string,
  userId: string
): Promise<void> {
  let journeyId: JourneyIdOrSlug;
  try {
    journeyId = createJourneyIdOrSlug(journeyIdOrSlug);
  } catch (error) {
    logAccessDenied({
      userId,
      organizationId,
      resourceType: "journey",
      resourceId: journeyIdOrSlug,
      reason: "journey_invalid_id",
    });
    throw new NotFoundError("Journey", journeyIdOrSlug, error);
  }

  const services = createServicesForOrganization({ organizationId });
  const journey = await services.journey.getJourneyById(journeyId, organizationId);

  if (!journey) {
    logAccessDenied({
      userId,
      organizationId,
      resourceType: "journey",
      resourceId: journeyIdOrSlug,
      reason: "journey_not_in_org",
    });
    throw new NotFoundError("Journey", journeyIdOrSlug);
  }
}
