/**
 * Variable Namespaces
 *
 * Types and utilities for template resolution context.
 */

// =============================================================================
// VARIABLE NAMESPACES (for template resolution context)
// =============================================================================

/**
 * User profile information available in templates.
 *
 * Template syntax: {{user.firstName}}, {{user.platform}}, etc.
 */
export interface UserProfile {
  /** User/client ID */
  id?: string;
  /** Platform identifier (telegram, whatsapp, etc.) */
  platform?: string;
  /** User's first name */
  firstName?: string;
  /** User's last name */
  lastName?: string;
  /** Username on the platform */
  username?: string;
  /** Email address (if available) */
  email?: string;
  /** User-scoped variables */
  vars?: Record<string, unknown>;
}

/**
 * Session state information available in templates.
 *
 * Template syntax: {{session.id}}, {{session.status}}, etc.
 */
export interface SessionInfo {
  /** Session ID */
  id?: string;
  /** Journey ID this session belongs to */
  journeyId?: string;
  /** Current session status */
  status?: string;
  /** Current node being executed */
  currentNodeId?: string;
  /** Tags attached to this user/session */
  tags?: string[];
}

/**
 * Scoped variables for template resolution.
 *
 * Template syntax:
 * - {{vars.journey.myVar}} - Journey-scoped variable
 * - {{vars.global.orgSetting}} - Organization-wide variable
 * - {{vars.user.preference}} - User-specific variable
 */
export interface ScopedVariables {
  /** Journey-scoped variables */
  journey: Record<string, unknown>;
  /** Organization-wide (global) variables */
  global: Record<string, unknown>;
  /** User-specific variables */
  user: Record<string, unknown>;
}

/**
 * Complete variable namespace for template resolution.
 *
 * This is the unified structure used by both the engine and workflow
 * for template variable resolution, ensuring consistent access patterns.
 *
 * @example
 * ```typescript
 * // Template syntax
 * {{vars.journey.welcomeMessage}}  // Journey variable
 * {{vars.global.supportEmail}}     // Global variable
 * {{vars.user.language}}           // User variable
 * {{user.firstName}}               // User profile field
 * {{session.status}}               // Session state
 * {{nodes.GetCustomer.email}}      // Output from a previous node
 *
 * // Code API
 * const namespaces = await buildVariableNamespaces(services, sessionInfo, userProfile);
 * const welcomeMsg = namespaces.vars.journey.welcomeMessage;
 * ```
 */
export interface VariableNamespaces {
  /** Scoped variables by namespace */
  vars: ScopedVariables;
  /** User profile information */
  user: UserProfile;
  /** Session state information */
  session: SessionInfo;
  /** Outputs from executed nodes (keyed by node label) */
  nodes: Record<string, Record<string, unknown>>;
}

/**
 * Node output entry for variable namespace building.
 * Compatible with the full NodeOutput type from session.ts.
 */
export interface NodeOutputEntry {
  /** Node data (can be any type) */
  data: unknown;
  /** Additional fields are allowed */
  [key: string]: unknown;
}

/**
 * Options for building variable namespaces.
 */
export interface BuildVariableNamespacesOptions {
  /** Session information */
  session: SessionInfo;
  /** User profile information */
  user: UserProfile;
  /** Pre-fetched journey variables (optional - will be empty if not provided) */
  journeyVars?: Record<string, unknown>;
  /** Pre-fetched global variables (optional - will be empty if not provided) */
  globalVars?: Record<string, unknown>;
  /** Pre-fetched user variables (optional - will be empty if not provided) */
  userVars?: Record<string, unknown>;
  /** Node outputs from previous execution (keyed by node label) */
  nodeOutputs?: Record<string, NodeOutputEntry>;
}

/**
 * Build the complete variable namespace for template resolution.
 *
 * Used by both engine and workflow for consistent variable access.
 * This is a pure function that builds the namespace from pre-fetched data.
 *
 * For async version that fetches variables from services, see
 * `buildEvaluationContext` in the engine package.
 *
 * @param options - Build options with pre-fetched data
 * @returns Complete variable namespaces for template resolution
 *
 * @example
 * ```typescript
 * const namespaces = buildVariableNamespaces({
 *   session: { id: sessionId, status: "active" },
 *   user: { id: userId, firstName: "John" },
 *   journeyVars: { welcomeMessage: "Hello!" },
 *   globalVars: { supportEmail: "support@example.com" },
 *   nodeOutputs: { GetCustomer: { data: { email: "john@example.com" } } },
 * });
 *
 * // Use in template resolution
 * template.substitute("Hello {{user.firstName}}!", namespaces);
 * ```
 */
export function buildVariableNamespaces(options: BuildVariableNamespacesOptions): VariableNamespaces {
  const { session, user, journeyVars, globalVars, userVars, nodeOutputs } = options;

  // Build nodes namespace from node outputs
  // Each node's data is exposed for template resolution
  const nodesNamespace: Record<string, Record<string, unknown>> = {};
  if (nodeOutputs) {
    for (const [key, output] of Object.entries(nodeOutputs)) {
      // Handle different data types - wrap primitives, pass objects through
      const data = output.data;
      if (data && typeof data === "object" && !Array.isArray(data)) {
        nodesNamespace[key] = data as Record<string, unknown>;
      } else if (data !== undefined && data !== null) {
        // Wrap primitive values so they can be accessed as {{nodes.Label.value}}
        nodesNamespace[key] = { value: data };
      } else {
        nodesNamespace[key] = {};
      }
    }
  }

  return {
    vars: {
      journey: journeyVars ?? {},
      global: globalVars ?? {},
      user: userVars ?? user.vars ?? {},
    },
    user,
    session,
    nodes: nodesNamespace,
  };
}
