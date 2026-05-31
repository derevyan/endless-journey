/**
 * Permission Subjects
 *
 * Defines the types of entities that request access to resources.
 * Each subject type has a different trust level and default capabilities.
 *
 * @module permissions/subjects
 */

import { z } from "zod";

// =============================================================================
// SUBJECT TYPES
// =============================================================================

/**
 * Types of subjects that can request access to resources.
 */
export const PermissionSubjectTypeSchema = z.enum([
  /** Journey engine - highest trust, full access */
  "journey_engine",

  /** Workflow runner - high trust, scoped to workflow context */
  "workflow",

  /** LLM tool execution - medium trust, sandboxed */
  "llm_tool",

  /** External integration (webhook handler, API client) - low trust */
  "external_integration",

  /** System process (background jobs, migrations) - high trust */
  "system",

  /** Read-only context (analytics, reporting) - minimal access */
  "read_only",
]);

export type PermissionSubjectType = z.infer<typeof PermissionSubjectTypeSchema>;

/**
 * A permission subject with identity and context.
 */
export interface PermissionSubject {
  /** Type of subject */
  type: PermissionSubjectType;

  /** Unique identifier for this subject instance */
  id: string;

  /** Organization ID for multi-tenancy */
  organizationId?: string;

  /** Session ID for session-scoped operations */
  sessionId?: string;

  /** Journey ID for journey-scoped operations */
  journeyId?: string;

  /** Additional context for permission decisions */
  metadata?: Record<string, unknown>;
}

/**
 * Zod schema for PermissionSubject.
 */
export const PermissionSubjectSchema = z.object({
  type: PermissionSubjectTypeSchema,
  id: z.string(),
  organizationId: z.string().optional(),
  sessionId: z.string().optional(),
  journeyId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

/**
 * Create a journey engine subject.
 * Has full access to all services.
 */
export function createJourneyEngineSubject(context: {
  organizationId?: string;
  sessionId?: string;
  journeyId?: string;
}): PermissionSubject {
  return {
    type: "journey_engine",
    id: `engine:${context.sessionId ?? "system"}`,
    ...context,
  };
}

/**
 * Create a workflow subject.
 * Has high trust within its workflow context.
 */
export function createWorkflowSubject(context: {
  workflowId: string;
  organizationId?: string;
  sessionId?: string;
}): PermissionSubject {
  return {
    type: "workflow",
    id: `workflow:${context.workflowId}`,
    organizationId: context.organizationId,
    sessionId: context.sessionId,
    metadata: { workflowId: context.workflowId },
  };
}

/**
 * Create an LLM tool subject.
 * Has sandboxed access based on tool capabilities.
 */
export function createLlmToolSubject(context: {
  toolId: string;
  organizationId?: string;
  sessionId?: string;
}): PermissionSubject {
  return {
    type: "llm_tool",
    id: `tool:${context.toolId}`,
    organizationId: context.organizationId,
    sessionId: context.sessionId,
    metadata: { toolId: context.toolId },
  };
}

/**
 * Create an external integration subject.
 * Has minimal access, typically read-only or write to specific resources.
 */
export function createExternalIntegrationSubject(context: {
  integrationId: string;
  organizationId?: string;
}): PermissionSubject {
  return {
    type: "external_integration",
    id: `integration:${context.integrationId}`,
    organizationId: context.organizationId,
    metadata: { integrationId: context.integrationId },
  };
}

/**
 * Create a read-only subject.
 * For analytics, reporting, and monitoring.
 */
export function createReadOnlySubject(context: {
  purpose: string;
  organizationId?: string;
}): PermissionSubject {
  return {
    type: "read_only",
    id: `readonly:${context.purpose}`,
    organizationId: context.organizationId,
    metadata: { purpose: context.purpose },
  };
}
