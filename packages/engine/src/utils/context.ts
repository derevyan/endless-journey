/**
 * Context utilities for working with evaluation contexts
 * Pure functions for object traversal and type conversion
 */

import {
  buildVariableNamespaces,
  resolveVariablePath,
  toExprEvalContext,
  type BuildVariableNamespacesOptions,
  type VariableNamespaces,
  type UserProfile,
  type SessionInfo,
  type StateParameterValue,
} from "@journey/schemas";
import type { EnhancedUserJourney } from "@journey/schemas";
import type { ClientData, EngineServices, ExecutionContext, MindstateService } from "../types";

// Re-export shared types and utilities for convenience
export type { VariableNamespaces, UserProfile, SessionInfo, BuildVariableNamespacesOptions };
export { buildVariableNamespaces, toExprEvalContext };

/**
 * Get nested value from object using dot notation
 *
 * @param obj - The object to traverse
 * @param path - Dot-notation path (e.g., "user.profile.name")
 * @returns The value at the path, or undefined if not found
 *
 * @example
 * ```ts
 * const obj = { user: { score: 100 } };
 * getNestedValue(obj, "user.score"); // 100
 * getNestedValue(obj, "user.name");  // undefined
 * ```
 */
export function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return resolveVariablePath(path, obj);
}


/**
 * Mindstate namespace structure
 * Maps mindstate keys to parameter name -> value pairs
 * Example: { mood: { stress: 7, happiness: 8 }, energy: { level: 5 } }
 */
export type MindstateNamespace = Record<string, Record<string, StateParameterValue>>;

/**
 * Options for building full execution context
 */
export interface ContextOptions {
  session: EnhancedUserJourney;
  client?: ClientData;
  journeyVars?: Record<string, unknown>;
  globalVars?: Record<string, unknown>;
  /** User-scoped variables fetched from variable service */
  userVars?: Record<string, unknown>;
  /** Mindstate namespace for template access: {{mindstate.key.param}} */
  mindstate?: MindstateNamespace;
}

/**
 * Build full execution context with namespaced bindings
 *
 * Creates a context object with:
 * - Session.context fields at root level (for direct access like {{score}})
 * - User namespace (user.id, user.firstName, etc.)
 * - Session namespace (session.id, session.status, etc.)
 * - Variables namespace (vars.journey, vars.global, vars.user)
 * - Nodes namespace (nodes.NodeLabel.field) for cross-node references
 *
 * Uses the shared `buildVariableNamespaces` from @journey/schemas for
 * consistent namespace structure across engine and workflow.
 *
 * @param options - Context building options
 * @returns Full context object for template substitution
 *
 * @example
 * ```ts
 * const context = buildFullContext({
 *   session,
 *   client: { id: "telegram_123", firstName: "John" },
 *   journeyVars: { welcomeMessage: "Hello" },
 *   globalVars: { supportEmail: "support@example.com" },
 * });
 * // Direct access: {{score}}, {{userResponse}} (from session.context)
 * // Namespaced: {{user.firstName}}, {{session.id}}, {{vars.journey.welcomeMessage}}
 * // Node outputs: {{nodes.Get_Customer.email}}
 * ```
 */
export function buildFullContext(options: ContextOptions): Record<string, unknown> {
  const { session, client, journeyVars, globalVars, userVars, mindstate } = options;

  const resolvedUserVars = userVars ?? {};

  // Build using shared namespace builder
  const namespaces = buildVariableNamespaces({
    session: {
      id: session.sessionId,
      journeyId: session.journeyId,
      status: session.status,
      currentNodeId: session.currentNodeId,
      tags: session.tags ?? [],
    },
    user: {
      id: client?.id ?? session.userId,
      platform: client?.platform ?? "unknown",
      firstName: client?.firstName ?? "",
      lastName: client?.lastName ?? "",
      username: client?.username ?? "",
      vars: resolvedUserVars,
    },
    journeyVars,
    globalVars,
    userVars: resolvedUserVars,
    nodeOutputs: session.nodeOutputs,
  });

  // Merge session.context at top level for template/expression access
  // This allows both flat access ({{score}}) and namespaced access ({{vars.journey.score}})
  const context: Record<string, unknown> = {
    ...session.context,
    ...namespaces,
  };

  // Add mindstate namespace for template access: {{mindstate.key.param}}
  if (mindstate && Object.keys(mindstate).length > 0) {
    context.mindstate = mindstate;
  }

  return context;
}

/**
 * Build mindstate namespace from mindstate service
 *
 * Fetches all parameter values for the given mindstate keys and returns them
 * in a namespace format suitable for template access: {{mindstate.key.param}}
 *
 * @param mindstateService - The mindstate service to fetch from
 * @param userId - User ID to fetch mindstate for
 * @param mindstateKeys - Array of mindstate definition keys to fetch
 * @returns Mindstate namespace: { key: { param: value, ... }, ... }
 *
 * @example
 * ```ts
 * const mindstate = await buildMindstateNamespace(
 *   services.mindstate,
 *   session.userId,
 *   ["mood", "energy"]
 * );
 * // Result: { mood: { stress: 7, happiness: 8 }, energy: { level: 5 } }
 * // Usage in template: {{mindstate.mood.stress}} → 7
 * ```
 */
export async function buildMindstateNamespace(
  mindstateService: MindstateService,
  userId: string,
  mindstateKeys: string[]
): Promise<MindstateNamespace> {
  const mindstate: MindstateNamespace = {};

  // Fetch mindstates in parallel
  const results = await Promise.allSettled(
    mindstateKeys.map((key) => mindstateService.getOrCreateMindstate(userId, key))
  );

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const key = mindstateKeys[i];

    if (result.status === "fulfilled" && result.value) {
      const clientMindstate = result.value;
      // Build parameter map: { paramId: currentValue }
      const params: Record<string, StateParameterValue> = {};
      for (const param of clientMindstate.stateParameters) {
        params[param.id] = param.currentValue;
      }
      mindstate[key] = params;
    } else {
      // Failed to fetch - initialize empty object so templates don't throw
      mindstate[key] = {};
    }
  }

  return mindstate;
}

/**
 * Options for building evaluation context
 */
export interface BuildEvaluationContextOptions {
  /** Mindstate definition keys to fetch (from journey.mindstateConfig.keys) */
  mindstateKeys?: string[];
}

/**
 * Build full evaluation context with variables fetched from services
 *
 * Consolidates the common pattern of fetching journey/global variables
 * and building the full context object. Reduces boilerplate in handlers.
 *
 * If mindstateKeys are provided and mindstate service is available, mindstate values
 * are automatically fetched and made available as {{mindstate.key.param}} in templates.
 *
 * @param session - Current session state
 * @param services - Engine services (requires variable service, optionally mindstate)
 * @param clientData - Optional client data for user bindings
 * @param options - Additional options (mindstateKeys, etc.)
 * @returns Full context object for template substitution and expression evaluation
 *
 * @example
 * ```ts
 * // Before (5 lines of boilerplate in every handler):
 * const evalContext = buildFullContext({
 *   session,
 *   client: clientData,
 *   journeyVars: await services.variable.getAll("journey"),
 *   globalVars: await services.variable.getAll("global"),
 * });
 *
 * // After (1 line):
 * const evalContext = await buildEvaluationContext(session, services, clientData);
 *
 * // With mindstate (from journey config):
 * const evalContext = await buildEvaluationContext(
 *   session, services, clientData,
 *   { mindstateKeys: journey.mindstateConfig?.keys }
 * );
 *
 * // Template access:
 * // {{mindstate.mood.stress}} → 7
 * // {{mindstate.energy.level}} → 5
 * ```
 */
export async function buildEvaluationContext(
  session: EnhancedUserJourney,
  services: Pick<EngineServices, "variable"> & { mindstate?: MindstateService },
  clientData?: ClientData,
  options?: BuildEvaluationContextOptions
): Promise<Record<string, unknown>> {
  // Fetch all variable scopes in parallel
  const [journeyVars, globalVars, userVars] = await Promise.all([
    services.variable.getAll("journey"),
    services.variable.getAll("global"),
    services.variable.getAll("user"),
  ]);

  // Fetch mindstate if keys provided and service is available
  let mindstate: MindstateNamespace | undefined;
  const mindstateKeys = options?.mindstateKeys;
  if (mindstateKeys && mindstateKeys.length > 0 && services.mindstate) {
    mindstate = await buildMindstateNamespace(services.mindstate, session.userId, mindstateKeys);
  }

  return buildFullContext({
    session,
    client: clientData,
    journeyVars,
    globalVars,
    userVars,
    mindstate,
  });
}

/**
 * Get or build the evaluation context with caching
 *
 * Uses ExecutionContext's _cachedEvaluationContext to avoid rebuilding
 * the evaluation context multiple times within the same node execution.
 * This is a performance optimization - building context requires 3 async
 * variable fetches (journey, global, user scopes) plus mindstate fetches.
 *
 * Automatically includes mindstate namespace if journey has mindstateConfig.keys.
 *
 * @param context - The execution context (will cache result in _cachedEvaluationContext)
 * @returns The evaluation context (cached after first call)
 *
 * @example
 * ```ts
 * // In a handler - first call builds, subsequent calls return cached
 * const evalContext = await getOrBuildEvaluationContext(context);
 * const guardContext = deriveGuardContextFromEvalContext(evalContext, session);
 *
 * // Later in same handler - returns cached value
 * const evalContext2 = await getOrBuildEvaluationContext(context);
 * // evalContext2 === evalContext (same reference)
 *
 * // Mindstate access (if journey has mindstateConfig):
 * // evalContext.mindstate?.mood?.stress → 7
 * ```
 */
export async function getOrBuildEvaluationContext(
  context: ExecutionContext
): Promise<Record<string, unknown>> {
  // Return cached if available
  if (context._cachedEvaluationContext) {
    return context._cachedEvaluationContext;
  }

  // Get mindstate keys from context (set by session engine from journey's mindstateConfig)
  const mindstateKeys = context.mindstateConfig?.keys;

  // Build and cache
  const evalContext = await buildEvaluationContext(
    context.session,
    context.services,
    context.clientData,
    { mindstateKeys }
  );
  context._cachedEvaluationContext = evalContext;

  return evalContext;
}
