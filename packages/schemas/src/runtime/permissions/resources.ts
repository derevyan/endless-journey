/**
 * Permission Resources
 *
 * Defines the resources and actions that can be controlled by permissions.
 * Resources are categorized by type (variables, services, external).
 *
 * @module permissions/resources
 */

import { z } from "zod";
import type { VariableScope } from "../../variables";

// =============================================================================
// VARIABLE SCOPES
// =============================================================================

/**
 * Variable scopes that can be controlled.
 */
export const VariableScopePermissionSchema = z.enum([
  "journey",
  "global",
  "user",
]);

export type VariableScopePermission = z.infer<typeof VariableScopePermissionSchema>;

// =============================================================================
// SYSTEM ACTIONS
// =============================================================================

/**
 * System actions that can be performed.
 * These map to service methods and capabilities.
 */
export const SystemActionSchema = z.enum([
  // Messenger actions
  "sendMessage",
  "sendButtons",
  "sendMedia",
  "editMessage",
  "deleteMessage",

  // Memory actions
  "saveMemory",
  "searchMemory",
  "deleteMemory",

  // Tag actions
  "addTag",
  "removeTag",
  "getTags",

  // CRM actions (granular)
  "crmMoveToStage",
  "crmAddToPipeline",
  "crmRemoveFromPipeline",
  "crmUpdatePosition",
  "crmSetDealValue",
  "crmUpdateContact",
  "crmCreateNote",
  "crmAssignOwner",

  // Mindstate actions
  "getMindstate",
  "updateMindstate",

  // Template actions
  "renderTemplate",

  // Variable actions
  "variableRead",
  "variableWrite",
  "variableDelete",
  "variableIncrement",

  // Session actions
  "sessionRead",
  "sessionUpdate",
  "sessionEnd",

  // Journey actions
  "journeyTransition",
  "journeyComplete",
]);

export type SystemAction = z.infer<typeof SystemActionSchema>;

/**
 * Groupings of related CRM actions for easier capability definition.
 */
export const CrmActionGroups = {
  /** Pipeline movement operations */
  PIPELINE_MANAGEMENT: [
    "crmMoveToStage",
    "crmAddToPipeline",
    "crmRemoveFromPipeline",
    "crmUpdatePosition",
  ] as const,

  /** Deal-related operations */
  DEAL_MANAGEMENT: [
    "crmSetDealValue",
    "crmUpdateContact",
    "crmCreateNote",
    "crmAssignOwner",
  ] as const,

  /** Basic CRM operations (stage movement only) */
  CRM_BASIC: ["crmMoveToStage"] as const,

  /** All CRM operations */
  CRM_ALL: [
    "crmMoveToStage",
    "crmAddToPipeline",
    "crmRemoveFromPipeline",
    "crmUpdatePosition",
    "crmSetDealValue",
    "crmUpdateContact",
    "crmCreateNote",
    "crmAssignOwner",
  ] as const,
} as const;

// =============================================================================
// EXTERNAL TARGETS
// =============================================================================

/**
 * Types of external communication that can be controlled.
 */
export const ExternalTargetTypeSchema = z.enum([
  /** HTTP webhooks */
  "webhook",

  /** External API calls */
  "api",

  /** Email sending */
  "email",

  /** SMS sending */
  "sms",

  /** Third-party integrations */
  "integration",
]);

export type ExternalTargetType = z.infer<typeof ExternalTargetTypeSchema>;

/**
 * An external target with optional restrictions.
 */
export interface ExternalTarget {
  type: ExternalTargetType;

  /** Allowed domains (if undefined, all domains allowed for this type) */
  allowedDomains?: string[];

  /** Maximum requests per minute */
  rateLimit?: number;
}

export const ExternalTargetSchema = z.object({
  type: ExternalTargetTypeSchema,
  allowedDomains: z.array(z.string()).optional(),
  rateLimit: z.number().optional(),
});

// =============================================================================
// PERMISSION RESOURCES (COMBINED)
// =============================================================================

/**
 * Resources that can be accessed.
 */
export interface PermissionResource {
  /** Variable scope being accessed */
  variableScope?: VariableScopePermission;

  /** Variable key being accessed (for fine-grained control) */
  variableKey?: string;

  /** System action being performed */
  action?: SystemAction;

  /** External target being accessed */
  externalTarget?: ExternalTarget;

  /** Organization being accessed */
  organizationId?: string;

  /** Session being accessed */
  sessionId?: string;

  /** Journey being accessed */
  journeyId?: string;
}

export const PermissionResourceSchema = z.object({
  variableScope: VariableScopePermissionSchema.optional(),
  variableKey: z.string().optional(),
  action: SystemActionSchema.optional(),
  externalTarget: ExternalTargetSchema.optional(),
  organizationId: z.string().optional(),
  sessionId: z.string().optional(),
  journeyId: z.string().optional(),
});
