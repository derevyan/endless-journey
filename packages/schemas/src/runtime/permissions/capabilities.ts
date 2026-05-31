/**
 * Permission Capabilities
 *
 * Defines capability declarations that subjects can use to specify
 * what resources they need access to. Includes pre-defined profiles
 * for common use cases.
 *
 * @module permissions/capabilities
 */

import { z } from "zod";
import type { VariableScopePermission, SystemAction, ExternalTarget } from "./resources";

// =============================================================================
// CAPABILITY DECLARATION
// =============================================================================

/**
 * A capability declaration specifies what a subject needs to access.
 * This is the "request" side of permissions.
 */
export interface CapabilityDeclaration {
  /** Variable access requirements */
  variables: {
    /** Scopes the subject can read from */
    read: VariableScopePermission[];
    /** Scopes the subject can write to */
    write: VariableScopePermission[];
  };

  /** System actions the subject can perform */
  actions: SystemAction[];

  /** External targets the subject can access */
  external: ExternalTarget[];

  /** Description of why these capabilities are needed */
  description?: string;
}

export const CapabilityDeclarationSchema = z.object({
  variables: z.object({
    read: z.array(z.enum(["journey", "global", "user"])),
    write: z.array(z.enum(["journey", "global", "user"])),
  }),
  actions: z.array(z.string()),
  external: z.array(
    z.object({
      type: z.enum(["webhook", "api", "email", "sms", "integration"]),
      allowedDomains: z.array(z.string()).optional(),
      rateLimit: z.number().optional(),
    })
  ),
  description: z.string().optional(),
});

// =============================================================================
// CAPABILITY PROFILES
// =============================================================================

/**
 * Pre-defined capability profiles for common use cases.
 * These can be used directly or combined.
 */
export const CapabilityProfiles = {
  /**
   * Journey Engine - Full access to all services.
   * Used by the core journey execution engine.
   */
  JOURNEY_ENGINE: {
    variables: {
      read: ["journey", "global", "user"] as VariableScopePermission[],
      write: ["journey", "global", "user"] as VariableScopePermission[],
    },
    actions: [
      "sendMessage",
      "sendButtons",
      "sendMedia",
      "saveMemory",
      "searchMemory",
      "deleteMemory",
      "addTag",
      "removeTag",
      "getTags",
      "crmMoveToStage",
      "crmAddToPipeline",
      "crmRemoveFromPipeline",
      "crmUpdatePosition",
      "crmSetDealValue",
      "crmUpdateContact",
      "crmCreateNote",
      "crmAssignOwner",
      "getMindstate",
      "updateMindstate",
      "renderTemplate",
      "variableRead",
      "variableWrite",
      "variableDelete",
      "variableIncrement",
      "sessionRead",
      "sessionUpdate",
      "sessionEnd",
      "journeyTransition",
      "journeyComplete",
    ] as SystemAction[],
    external: [
      { type: "webhook" as const },
      { type: "api" as const },
      { type: "email" as const },
      { type: "sms" as const },
      { type: "integration" as const },
    ],
    description: "Full access for journey engine execution",
  } satisfies CapabilityDeclaration,

  /**
   * LLM Tool Standard - Sandboxed access for AI tools.
   * Can read variables and perform safe actions.
   */
  LLM_TOOL_STANDARD: {
    variables: {
      read: ["journey", "global", "user"] as VariableScopePermission[],
      write: ["journey"] as VariableScopePermission[],
    },
    actions: [
      "sendMessage",
      "sendButtons",
      "saveMemory",
      "searchMemory",
      "addTag",
      "getTags",
      "getMindstate",
      "renderTemplate",
      "variableRead",
      "variableWrite",
    ] as SystemAction[],
    external: [],
    description: "Sandboxed access for LLM tools",
  } satisfies CapabilityDeclaration,

  /**
   * LLM Tool CRM - Extended access for sales/support AI agents.
   * Includes CRM operations.
   */
  LLM_TOOL_CRM: {
    variables: {
      read: ["journey", "global", "user"] as VariableScopePermission[],
      write: ["journey"] as VariableScopePermission[],
    },
    actions: [
      "sendMessage",
      "sendButtons",
      "saveMemory",
      "searchMemory",
      "addTag",
      "getTags",
      "getMindstate",
      "renderTemplate",
      "variableRead",
      "variableWrite",
      "crmMoveToStage",
      "crmCreateNote",
      "crmUpdateContact",
    ] as SystemAction[],
    external: [],
    description: "Extended access for CRM-capable AI tools",
  } satisfies CapabilityDeclaration,

  /**
   * Read Only - For analytics and reporting.
   * No write access to any resource.
   */
  READ_ONLY: {
    variables: {
      read: ["journey", "global", "user"] as VariableScopePermission[],
      write: [],
    },
    actions: [
      "searchMemory",
      "getTags",
      "getMindstate",
      "variableRead",
      "sessionRead",
    ] as SystemAction[],
    external: [],
    description: "Read-only access for analytics",
  } satisfies CapabilityDeclaration,

  /**
   * External Integration - Minimal access for webhooks and APIs.
   * Can only perform specific actions.
   */
  EXTERNAL_INTEGRATION: {
    variables: {
      read: ["journey"] as VariableScopePermission[],
      write: ["journey"] as VariableScopePermission[],
    },
    actions: [
      "variableRead",
      "variableWrite",
      "addTag",
      "removeTag",
    ] as SystemAction[],
    external: [],
    description: "Minimal access for external integrations",
  } satisfies CapabilityDeclaration,

  /**
   * Pipeline Automation - For automated pipeline management.
   * Can move stages but not manage deals.
   */
  PIPELINE_AUTOMATION: {
    variables: {
      read: ["journey", "global"] as VariableScopePermission[],
      write: ["journey"] as VariableScopePermission[],
    },
    actions: [
      "crmMoveToStage",
      "crmAddToPipeline",
      "crmRemoveFromPipeline",
      "crmUpdatePosition",
      "variableRead",
      "variableWrite",
    ] as SystemAction[],
    external: [],
    description: "Pipeline management for automation workflows",
  } satisfies CapabilityDeclaration,

  /**
   * CRM Manager - Full CRM access.
   * For administrative CRM operations.
   */
  CRM_MANAGER: {
    variables: {
      read: ["journey", "global", "user"] as VariableScopePermission[],
      write: ["journey"] as VariableScopePermission[],
    },
    actions: [
      "crmMoveToStage",
      "crmAddToPipeline",
      "crmRemoveFromPipeline",
      "crmUpdatePosition",
      "crmSetDealValue",
      "crmUpdateContact",
      "crmCreateNote",
      "crmAssignOwner",
      "variableRead",
      "variableWrite",
    ] as SystemAction[],
    external: [],
    description: "Full CRM access for management operations",
  } satisfies CapabilityDeclaration,

  /**
   * Workflow Node - Standard access for workflow nodes.
   * Similar to LLM tools with extended write capabilities.
   */
  WORKFLOW_NODE: {
    variables: {
      read: ["journey", "global", "user"] as VariableScopePermission[],
      write: ["journey"] as VariableScopePermission[],
    },
    actions: [
      "sendMessage",
      "sendButtons",
      "sendMedia",
      "saveMemory",
      "searchMemory",
      "addTag",
      "removeTag",
      "getTags",
      "getMindstate",
      "updateMindstate",
      "renderTemplate",
      "variableRead",
      "variableWrite",
      "sessionRead",
      "sessionUpdate",
    ] as SystemAction[],
    external: [{ type: "webhook" as const, rateLimit: 10 }],
    description: "Standard access for workflow execution nodes",
  } satisfies CapabilityDeclaration,
} as const;

export type CapabilityProfileName = keyof typeof CapabilityProfiles;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get a capability profile by name.
 */
export function getCapabilityProfile(name: CapabilityProfileName): CapabilityDeclaration {
  return CapabilityProfiles[name];
}

/**
 * Merge multiple capability declarations.
 * Unions all permissions (additive, not restrictive).
 */
export function mergeCapabilities(
  ...declarations: CapabilityDeclaration[]
): CapabilityDeclaration {
  const readScopes = new Set<VariableScopePermission>();
  const writeScopes = new Set<VariableScopePermission>();
  const actions = new Set<SystemAction>();
  const external: ExternalTarget[] = [];
  const descriptions: string[] = [];

  for (const decl of declarations) {
    decl.variables.read.forEach((s) => readScopes.add(s));
    decl.variables.write.forEach((s) => writeScopes.add(s));
    decl.actions.forEach((a) => actions.add(a));
    external.push(...decl.external);
    if (decl.description) {
      descriptions.push(decl.description);
    }
  }

  return {
    variables: {
      read: [...readScopes],
      write: [...writeScopes],
    },
    actions: [...actions],
    external,
    description: descriptions.join("; "),
  };
}

/**
 * Check if a capability declaration allows a specific action.
 */
export function hasActionCapability(
  declaration: CapabilityDeclaration,
  action: SystemAction
): boolean {
  return declaration.actions.includes(action);
}

/**
 * Check if a capability declaration allows reading from a scope.
 */
export function hasVariableReadCapability(
  declaration: CapabilityDeclaration,
  scope: VariableScopePermission
): boolean {
  return declaration.variables.read.includes(scope);
}

/**
 * Check if a capability declaration allows writing to a scope.
 */
export function hasVariableWriteCapability(
  declaration: CapabilityDeclaration,
  scope: VariableScopePermission
): boolean {
  return declaration.variables.write.includes(scope);
}
