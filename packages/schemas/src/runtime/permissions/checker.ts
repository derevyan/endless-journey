/**
 * Permission Checker
 *
 * Validates whether a subject has permission to access a resource.
 * This is the core enforcement mechanism for the permission system.
 *
 * @module permissions/checker
 */

import type { PermissionSubject } from "./subjects";
import type { PermissionResource, SystemAction, VariableScopePermission, ExternalTarget } from "./resources";
import type { CapabilityDeclaration } from "./capabilities";

// =============================================================================
// ERRORS
// =============================================================================

/**
 * Error thrown when a permission check fails.
 */
export class PermissionDeniedError extends Error {
  readonly code = "PERMISSION_DENIED";
  readonly subject: PermissionSubject;
  readonly resource: PermissionResource;
  readonly reason: string;

  constructor(
    subject: PermissionSubject,
    resource: PermissionResource,
    reason: string
  ) {
    super(`Permission denied: ${reason}`);
    this.name = "PermissionDeniedError";
    this.subject = subject;
    this.resource = resource;
    this.reason = reason;
  }

  /**
   * Convert to a safe error message for logging/display.
   */
  toSafeMessage(): string {
    return `Permission denied for ${this.subject.type}:${this.subject.id}: ${this.reason}`;
  }
}

// =============================================================================
// PERMISSION CHECK RESULT
// =============================================================================

export interface PermissionCheckResult {
  /** Whether access is allowed */
  allowed: boolean;
  /** Reason for denial (if not allowed) */
  reason?: string;
  /** Warnings (for allowed but concerning access patterns) */
  warnings?: string[];
  /** Duration of the check in milliseconds */
  durationMs?: number;
}

// =============================================================================
// PERMISSION CHECKER
// =============================================================================

/**
 * Permission checker options.
 */
export interface PermissionCheckerOptions {
  /** Whether to throw on permission denial (default: true) */
  throwOnDenied?: boolean;
  /** Callback for auditing permission checks */
  onCheck?: (
    subject: PermissionSubject,
    resource: PermissionResource,
    result: PermissionCheckResult
  ) => void;
}

/**
 * Permission checker that validates subject access to resources.
 */
export class PermissionChecker {
  private readonly capabilities: CapabilityDeclaration;
  private readonly subject: PermissionSubject;
  private readonly options: PermissionCheckerOptions;

  constructor(
    subject: PermissionSubject,
    capabilities: CapabilityDeclaration,
    options: PermissionCheckerOptions = {}
  ) {
    this.subject = subject;
    this.capabilities = capabilities;
    this.options = { throwOnDenied: true, ...options };
  }

  /**
   * Check if the subject can read from a variable scope.
   */
  checkVariableRead(scope: VariableScopePermission, key?: string): PermissionCheckResult {
    const startTime = performance.now();
    const resource: PermissionResource = { variableScope: scope, variableKey: key };

    if (!this.capabilities.variables.read.includes(scope)) {
      return this.deny(resource, `Cannot read from ${scope} scope`, startTime);
    }

    return this.allow(resource, startTime);
  }

  /**
   * Check if the subject can write to a variable scope.
   */
  checkVariableWrite(scope: VariableScopePermission, key?: string): PermissionCheckResult {
    const startTime = performance.now();
    const resource: PermissionResource = { variableScope: scope, variableKey: key };

    if (!this.capabilities.variables.write.includes(scope)) {
      return this.deny(resource, `Cannot write to ${scope} scope`, startTime);
    }

    return this.allow(resource, startTime);
  }

  /**
   * Check if the subject can perform a system action.
   */
  checkAction(action: SystemAction): PermissionCheckResult {
    const startTime = performance.now();
    const resource: PermissionResource = { action };

    if (!this.capabilities.actions.includes(action)) {
      return this.deny(resource, `Action ${action} not permitted`, startTime);
    }

    return this.allow(resource, startTime);
  }

  /**
   * Check if the subject can access an external target.
   */
  checkExternal(target: ExternalTarget): PermissionCheckResult {
    const startTime = performance.now();
    const resource: PermissionResource = { externalTarget: target };

    // Check if any external target of this type is allowed
    const allowedTarget = this.capabilities.external.find(
      (t) => t.type === target.type
    );

    if (!allowedTarget) {
      return this.deny(resource, `External ${target.type} access not permitted`, startTime);
    }

    // Check domain restrictions if specified
    if (allowedTarget.allowedDomains && target.allowedDomains) {
      const hasAllowedDomain = target.allowedDomains.some((domain) =>
        allowedTarget.allowedDomains?.some(
          (allowed) => domain === allowed || domain.endsWith(`.${allowed}`)
        )
      );

      if (!hasAllowedDomain) {
        return this.deny(
          resource,
          `Domain not in allowed list for ${target.type}`,
          startTime
        );
      }
    }

    return this.allow(resource, startTime);
  }

  /**
   * Check if the subject can access a specific organization.
   * Multi-tenancy enforcement.
   */
  checkOrganization(organizationId: string): PermissionCheckResult {
    const startTime = performance.now();
    const resource: PermissionResource = { organizationId };

    // If subject has no org, it's a system context (allow)
    if (!this.subject.organizationId) {
      return this.allow(resource, startTime);
    }

    // Subject must match the organization
    if (this.subject.organizationId !== organizationId) {
      return this.deny(resource, "Cross-organization access not permitted", startTime);
    }

    return this.allow(resource, startTime);
  }

  /**
   * Check if the subject can access a specific session.
   */
  checkSession(sessionId: string): PermissionCheckResult {
    const startTime = performance.now();
    const resource: PermissionResource = { sessionId };

    // If subject has no session restriction, allow
    if (!this.subject.sessionId) {
      return this.allow(resource, startTime);
    }

    // Subject must match the session
    if (this.subject.sessionId !== sessionId) {
      return this.deny(resource, "Cross-session access not permitted", startTime);
    }

    return this.allow(resource, startTime);
  }

  /**
   * Check if the subject can access a specific journey.
   */
  checkJourney(journeyId: string): PermissionCheckResult {
    const startTime = performance.now();
    const resource: PermissionResource = { journeyId };

    // If subject has no journey restriction, allow
    if (!this.subject.journeyId) {
      return this.allow(resource, startTime);
    }

    // Subject must match the journey
    if (this.subject.journeyId !== journeyId) {
      return this.deny(resource, "Cross-journey access not permitted", startTime);
    }

    return this.allow(resource, startTime);
  }

  /**
   * Get the subject this checker is validating.
   */
  getSubject(): PermissionSubject {
    return this.subject;
  }

  /**
   * Get the capabilities being used for validation.
   */
  getCapabilities(): CapabilityDeclaration {
    return this.capabilities;
  }

  // =============================================================================
  // INTERNAL HELPERS
  // =============================================================================

  private allow(resource: PermissionResource, startTime?: number): PermissionCheckResult {
    const durationMs = startTime !== undefined ? performance.now() - startTime : undefined;
    const result: PermissionCheckResult = { allowed: true, durationMs };
    this.options.onCheck?.(this.subject, resource, result);
    return result;
  }

  private deny(resource: PermissionResource, reason: string, startTime?: number): PermissionCheckResult {
    const durationMs = startTime !== undefined ? performance.now() - startTime : undefined;
    const result: PermissionCheckResult = { allowed: false, reason, durationMs };
    this.options.onCheck?.(this.subject, resource, result);

    if (this.options.throwOnDenied) {
      throw new PermissionDeniedError(this.subject, resource, reason);
    }

    return result;
  }
}

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

/**
 * Create a permission checker for a subject with capabilities.
 */
export function createPermissionChecker(
  subject: PermissionSubject,
  capabilities: CapabilityDeclaration,
  options?: PermissionCheckerOptions
): PermissionChecker {
  return new PermissionChecker(subject, capabilities, options);
}

/**
 * Create a checker that always allows (for testing or bypass).
 */
export function createBypassChecker(subject: PermissionSubject): PermissionChecker {
  // Create with full capabilities
  return new PermissionChecker(
    subject,
    {
      variables: {
        read: ["journey", "global", "user"],
        write: ["journey", "global", "user"],
      },
      actions: [],
      external: [
        { type: "webhook" },
        { type: "api" },
        { type: "email" },
        { type: "sms" },
        { type: "integration" },
      ],
    },
    { throwOnDenied: false }
  );
}
