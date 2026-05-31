/**
 * Permission Definitions
 *
 * Defines the RBAC permission matrix for the Journey platform using
 * Better Auth's createAccessControl API.
 *
 * Resources represent entities in the system (journey, client, session).
 * Actions represent operations on those resources (read, create, update, delete).
 * Roles (owner, admin, member) have different permission sets.
 *
 * @module lib/permissions
 */

import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements, memberAc, ownerAc } from "better-auth/plugins/organization/access";

// =============================================================================
// PERMISSION STATEMENTS
// =============================================================================

/**
 * Resource-action matrix for the Journey platform.
 *
 * Each key is a resource type, and the value is an array of allowed actions.
 * Use `as const` for proper TypeScript inference.
 */
export const journeyStatements = {
  // Inherit default Better Auth org management statements
  ...defaultStatements,

  // -------------------------------------------------------------------------
  // Core Resources
  // -------------------------------------------------------------------------

  /** Journey builder resources */
  journey: ["read", "create", "update", "delete", "publish"],

  /** Journey version management */
  journeyVersion: ["read", "create", "restore", "delete"],

  /** Client session management */
  session: ["read", "delete", "reset"],

  /** Client profile management */
  client: ["read", "update", "delete"],

  // -------------------------------------------------------------------------
  // Simulator Resources
  // -------------------------------------------------------------------------

  /** Simulator execution control */
  simulator: ["execute", "manage"],

  /** Simulator persona management */
  persona: ["read", "create", "update", "delete"],

  // -------------------------------------------------------------------------
  // Content Resources
  // -------------------------------------------------------------------------

  /** Media upload management */
  upload: ["read", "create", "delete"],

  /** Variable management */
  variable: ["read", "create", "update", "delete"],

  /** Tag management */
  tag: ["read", "create", "delete"],

  /** Tag definition management */
  tagDefinition: ["read", "create", "update", "delete"],

  // -------------------------------------------------------------------------
  // Mindstate Resources
  // -------------------------------------------------------------------------

  /** Mindstate definition and client state */
  mindstate: ["read", "create", "update", "delete", "analyze"],

  /** Mindstate version management */
  mindstateVersion: ["read", "create", "restore", "delete"],

  // -------------------------------------------------------------------------
  // Workflow Resources
  // -------------------------------------------------------------------------

  /** Workflow management */
  workflow: ["read", "create", "update", "delete", "execute"],

  /** Workflow version management */
  workflowVersion: ["read", "create", "restore", "delete"],

  /** Workflow approval management */
  workflowApproval: ["read", "create", "update"],

  // -------------------------------------------------------------------------
  // CRM Resources
  // -------------------------------------------------------------------------

  /** CRM pipeline management */
  crmPipeline: ["read", "create", "update", "delete"],

  /** CRM stage management */
  crmStage: ["read", "create", "update", "delete"],

  /** CRM field management */
  crmField: ["read", "create", "update", "delete"],

  /** CRM client management */
  crmClient: ["read", "create", "update", "delete"],

  /** CRM messaging */
  crmMessage: ["read", "create"],

  // -------------------------------------------------------------------------
  // Admin Resources
  // -------------------------------------------------------------------------

  /** Channel configuration */
  channel: ["read", "create", "update", "delete"],

  /** Organization settings */
  settings: ["read", "update"],

  /** LLM model configuration */
  model: ["read", "update"],

  /** User management */
  user: ["read", "update"],

  /** Agent tool configuration */
  agentTool: ["read", "create", "update", "delete"],

  /** Event management */
  event: ["read", "replay"],

  /** Audio processing */
  audio: ["read", "create"],

  // -------------------------------------------------------------------------
  // Prompt Repository Resources
  // -------------------------------------------------------------------------

  /** Prompt management */
  prompt: ["read", "create", "update", "delete"],
} as const;

// =============================================================================
// ACCESS CONTROLLER
// =============================================================================

/**
 * Access controller instance for the Journey platform.
 * Used to define roles and check permissions.
 */
export const ac = createAccessControl(journeyStatements);

// =============================================================================
// ROLE DEFINITIONS
// =============================================================================

/**
 * Owner role - Full access to everything.
 *
 * Owners can:
 * - Manage organization settings
 * - Delete the organization
 * - All admin and member permissions
 */
export const owner = ac.newRole({
  // Inherit Better Auth owner permissions (org delete, member management, etc.)
  ...ownerAc.statements,

  // Core resources - full access
  journey: ["read", "create", "update", "delete", "publish"],
  journeyVersion: ["read", "create", "restore", "delete"],
  session: ["read", "delete", "reset"],
  client: ["read", "update", "delete"],

  // Simulator - full access
  simulator: ["execute", "manage"],
  persona: ["read", "create", "update", "delete"],

  // Content - full access
  upload: ["read", "create", "delete"],
  variable: ["read", "create", "update", "delete"],
  tag: ["read", "create", "delete"],
  tagDefinition: ["read", "create", "update", "delete"],

  // Mindstate - full access
  mindstate: ["read", "create", "update", "delete", "analyze"],
  mindstateVersion: ["read", "create", "restore", "delete"],

  // Workflow - full access
  workflow: ["read", "create", "update", "delete", "execute"],
  workflowVersion: ["read", "create", "restore", "delete"],
  workflowApproval: ["read", "create", "update"],

  // CRM - full access
  crmPipeline: ["read", "create", "update", "delete"],
  crmStage: ["read", "create", "update", "delete"],
  crmField: ["read", "create", "update", "delete"],
  crmClient: ["read", "create", "update", "delete"],
  crmMessage: ["read", "create"],

  // Admin - full access
  channel: ["read", "create", "update", "delete"],
  settings: ["read", "update"],
  model: ["read", "update"],
  user: ["read", "update"],
  agentTool: ["read", "create", "update", "delete"],
  event: ["read", "replay"],
  audio: ["read", "create"],

  // Prompts - full access
  prompt: ["read", "create", "update", "delete"],
});

/**
 * Admin role - Full access except organization deletion.
 *
 * Admins can:
 * - Manage all resources
 * - Invite/remove members
 * - Cannot delete the organization
 */
export const admin = ac.newRole({
  // Inherit Better Auth admin permissions
  ...adminAc.statements,

  // Core resources - full access
  journey: ["read", "create", "update", "delete", "publish"],
  journeyVersion: ["read", "create", "restore", "delete"],
  session: ["read", "delete", "reset"],
  client: ["read", "update", "delete"],

  // Simulator - full access
  simulator: ["execute", "manage"],
  persona: ["read", "create", "update", "delete"],

  // Content - full access
  upload: ["read", "create", "delete"],
  variable: ["read", "create", "update", "delete"],
  tag: ["read", "create", "delete"],
  tagDefinition: ["read", "create", "update", "delete"],

  // Mindstate - full access
  mindstate: ["read", "create", "update", "delete", "analyze"],
  mindstateVersion: ["read", "create", "restore", "delete"],

  // Workflow - full access
  workflow: ["read", "create", "update", "delete", "execute"],
  workflowVersion: ["read", "create", "restore", "delete"],
  workflowApproval: ["read", "create", "update"],

  // CRM - full access
  crmPipeline: ["read", "create", "update", "delete"],
  crmStage: ["read", "create", "update", "delete"],
  crmField: ["read", "create", "update", "delete"],
  crmClient: ["read", "create", "update", "delete"],
  crmMessage: ["read", "create"],

  // Admin - full access
  channel: ["read", "create", "update", "delete"],
  settings: ["read", "update"],
  model: ["read", "update"],
  user: ["read", "update"],
  agentTool: ["read", "create", "update", "delete"],
  event: ["read", "replay"],
  audio: ["read", "create"],

  // Prompts - full access
  prompt: ["read", "create", "update", "delete"],
});

/**
 * Member role - Limited access for regular team members.
 *
 * Members can:
 * - Read and create journeys (no delete, no publish)
 * - Execute simulators (no manage)
 * - Upload content
 * - Analyze mindstates
 * - Execute workflows (no delete)
 */
export const member = ac.newRole({
  // Inherit Better Auth member permissions
  ...memberAc.statements,

  // Core resources - read + limited write
  journey: ["read", "create", "update"], // No delete, no publish
  journeyVersion: ["read", "create"], // No restore
  session: ["read"], // No delete, no reset
  client: ["read"], // No update, no delete

  // Simulator - execute only
  simulator: ["execute"], // No manage
  persona: ["read", "create", "update"], // No delete

  // Content - read + create
  upload: ["read", "create"], // No delete
  variable: ["read"], // No create, no update, no delete
  tag: ["read", "create"], // No delete
  tagDefinition: ["read"], // No create, no update, no delete

  // Mindstate - read + analyze
  mindstate: ["read", "analyze"], // No create, no update, no delete
  mindstateVersion: ["read", "create"], // No restore, no delete

  // Workflow - read + execute
  workflow: ["read", "execute"], // No create, no update, no delete
  workflowVersion: ["read"], // No create, no restore
  workflowApproval: ["read"], // No create, no update

  // CRM - read + limited write
  crmPipeline: ["read"], // No create, no update, no delete
  crmStage: ["read"], // No create, no update, no delete
  crmField: ["read"], // No create, no update, no delete
  crmClient: ["read", "create", "update"], // Can manage clients, no delete
  crmMessage: ["read", "create"], // Can send messages

  // Admin - read only
  channel: ["read"], // No create, no update, no delete
  settings: ["read"], // No update
  model: ["read"], // No update
  user: ["read"], // No update
  agentTool: ["read"], // No create, no update, no delete
  event: ["read"], // No replay
  audio: ["read"], // No create

  // Prompts - read + create
  prompt: ["read", "create", "update"], // No delete
});

// =============================================================================
// TYPE EXPORTS
// =============================================================================

/**
 * All resource types in the system
 */
export type JourneyResource = keyof typeof journeyStatements;

/**
 * Actions available for a specific resource
 */
export type JourneyAction<R extends JourneyResource> = (typeof journeyStatements)[R][number];

/**
 * Permission check definition
 */
export interface Permission<R extends JourneyResource = JourneyResource> {
  /** Resource type */
  resource: R;
  /** Action on the resource */
  action: JourneyAction<R>;
}

/**
 * Roles object for Better Auth organization plugin configuration
 */
export const roles = {
  owner,
  admin,
  member,
};
