/**
 * Permission System
 *
 * Capability-based permission model for controlling access to resources.
 * Each subject declares what capabilities it needs, and the permission
 * layer enforces these at runtime.
 *
 * @module permissions
 *
 * @example
 * ```typescript
 * import {
 *   createLlmToolSubject,
 *   CapabilityProfiles,
 *   createGuardedContext,
 *   PermissionDeniedError,
 * } from "@journey/schemas";
 *
 * // Create a subject for an LLM tool
 * const subject = createLlmToolSubject({
 *   toolId: "save_memory",
 *   sessionId: "session_123",
 *   organizationId: "org_456",
 * });
 *
 * // Create a guarded context with sandboxed capabilities
 * const guardedContext = createGuardedContext(
 *   originalContext,
 *   subject,
 *   CapabilityProfiles.LLM_TOOL_STANDARD
 * );
 *
 * // Now all service calls are permission-checked
 * try {
 *   await guardedContext.variable.setValue("journey", "key", "value"); // OK
 *   await guardedContext.variable.setValue("global", "key", "value"); // Throws!
 * } catch (error) {
 *   if (error instanceof PermissionDeniedError) {
 *     log.warn({ message: error.toSafeMessage() }, "permission:denied");
 *   }
 * }
 * ```
 */

// =============================================================================
// SUBJECTS - Who is requesting access
// =============================================================================

export {
  // Types
  type PermissionSubject,
  type PermissionSubjectType,

  // Schemas
  PermissionSubjectSchema,
  PermissionSubjectTypeSchema,

  // Factory functions
  createJourneyEngineSubject,
  createWorkflowSubject,
  createLlmToolSubject,
  createExternalIntegrationSubject,
  createReadOnlySubject,
} from "./subjects";

// =============================================================================
// RESOURCES - What can be accessed
// =============================================================================

export {
  // Types
  type VariableScopePermission,
  type SystemAction,
  type ExternalTargetType,
  type ExternalTarget,
  type PermissionResource,

  // Schemas
  VariableScopePermissionSchema,
  SystemActionSchema,
  ExternalTargetTypeSchema,
  ExternalTargetSchema,
  PermissionResourceSchema,

  // Constants
  CrmActionGroups,
} from "./resources";

// =============================================================================
// CAPABILITIES - What subjects can do
// =============================================================================

export {
  // Types
  type CapabilityDeclaration,
  type CapabilityProfileName,

  // Schemas
  CapabilityDeclarationSchema,

  // Pre-defined profiles
  CapabilityProfiles,

  // Helper functions
  getCapabilityProfile,
  mergeCapabilities,
  hasActionCapability,
  hasVariableReadCapability,
  hasVariableWriteCapability,
} from "./capabilities";

// =============================================================================
// CHECKER - Permission enforcement
// =============================================================================

export {
  // Classes
  PermissionChecker,
  PermissionDeniedError,

  // Types
  type PermissionCheckResult,
  type PermissionCheckerOptions,

  // Factory functions
  createPermissionChecker,
  createBypassChecker,
} from "./checker";

// =============================================================================
// GUARDED CONTEXT - Transparent enforcement
// =============================================================================

export {
  // Types
  type GuardedContextOptions,

  // Factory functions
  createGuardedContext,

  // Utilities
  isGuardedContext,
  getPermissionChecker,
} from "./guarded-context";

// =============================================================================
// AUDIT - Logging and monitoring
// =============================================================================

export {
  // Types
  type PermissionAuditEntry,
  type AuditLogConsumer,
  type PermissionUsageSummary,

  // Classes
  InMemoryAuditLogger,
  CallbackAuditLogger,

  // Factory functions
  createAuditingChecker,

  // Utilities
  generatePermissionSummary,
} from "./audit";
