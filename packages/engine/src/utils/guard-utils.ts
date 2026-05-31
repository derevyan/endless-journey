/**
 * Guard Utilities for Smart Edges
 *
 * Provides functions for evaluating edge guards and filtering edges.
 * Guards are conditions that must pass for an edge to be traversable.
 *
 * Three guard types:
 * - expression: JavaScript-like expression (e.g., "user.score > 50")
 * - variable: Simple variable comparison (key/operator/value)
 * - tag: Check if user has/doesn't have a tag
 */

import {
  EventTypes,
  type AgentNodeData,
  type ConditionNodeData,
  type CrmNodeData,
  type EdgeGuard,
  type EndNodeData,
  type GuardVariableCondition,
  type JourneyEdgeData,
  type JourneyNodeData,
  type MessageNodeData,
  type QuestionnaireNodeData,
  type StartNodeData,
  type TeleportNodeData,
  type WaitNodeData,
  type WebhookNodeData,
} from "@journey/schemas";
import { createLogger } from "@journey/logger";
import { evaluateExpressionSync } from "../services/expression-service";
import { getNestedValue } from "./context";
import { compareValues, resolveTemplateValue, type ComparisonOperator } from "./comparison-utils";
import type { EventLogger } from "../types";

export interface GuardBlockedEdge {
  edge: JourneyEdgeData;
  guard: EdgeGuard;
}

/**
 * Options for guard evaluation
 */
export interface GuardEvaluationOptions {
  /** Optional logger for evaluation errors and warnings */
  logger?: ReturnType<typeof createLogger>;
}

const log = createLogger("guard-utils");

/**
 * Context required for guard evaluation
 * Contains all data needed to evaluate any guard type
 */
export interface GuardContext {
  /** Session variables (from session.context) */
  variables: Record<string, unknown>;
  /** User tags (from session.tags) */
  tags: string[];
  /** Full context for expression evaluation (includes user, session, vars, nodes namespaces) */
  fullContext?: Record<string, unknown>;
}

/**
 * Evaluate a variable guard condition
 *
 * Uses shared comparison utilities for:
 * - Type coercion (numeric strings "50" → 50)
 * - Template variable resolution ({{path}} syntax)
 * - Consistent operator semantics across guards and conditions
 *
 * @param condition - The variable condition to evaluate
 * @param variables - The context variables to check against
 * @returns true if condition passes, false otherwise
 */
function evaluateVariableCondition(condition: GuardVariableCondition, variables: Record<string, unknown>): boolean {
  const { key, operator, value } = condition;
  const actualValue = getNestedValue(variables, key);

  // Resolve template variables in compare value (e.g., {{user.score}})
  const resolvedValue = resolveTemplateValue(value, variables);

  // Use shared comparison logic with type coercion
  return compareValues(actualValue, operator as ComparisonOperator, resolvedValue);
}

/**
 * Evaluate a single guard condition
 *
 * @param guard - The guard to evaluate
 * @param context - The context to evaluate against
 * @param options - Optional evaluation options (logger)
 * @returns true if guard passes (edge can be traversed), false otherwise
 *
 * @example
 * ```ts
 * // Expression guard
 * evaluateGuard(
 *   { type: "expression", expression: "user.score > 50" },
 *   { variables: {}, tags: [], fullContext: { user: { score: 75 } } }
 * ); // true
 *
 * // Variable guard with custom logger
 * evaluateGuard(
 *   { type: "variable", variable: { key: "status", operator: "equals", value: "active" } },
 *   { variables: { status: "active" }, tags: [] },
 *   { logger: customLogger }
 * ); // true
 * ```
 */
export function evaluateGuard(guard: EdgeGuard, context: GuardContext, options: GuardEvaluationOptions = {}): boolean {
  const logger = options.logger ?? log;

  try {
    switch (guard.type) {
      case "expression": {
        if (!guard.expression) {
          logger.warn({}, "guard:missingExpression");
          return true; // No expression = pass
        }

        // Use full context if available, otherwise use variables
        const evalContext = context.fullContext ?? context.variables;
        const result = evaluateExpressionSync(guard.expression, evalContext);

        // Treat truthy values as pass, falsy as fail
        return Boolean(result);
      }

      case "variable": {
        if (!guard.variable) {
          logger.warn({}, "guard:missingVariableCondition");
          return true; // No condition = pass
        }

        return evaluateVariableCondition(guard.variable, context.variables);
      }

      case "tag": {
        if (!guard.tag) {
          logger.warn({}, "guard:missingTagCondition");
          return true; // No condition = pass
        }

        const { tag, operator } = guard.tag;
        const hasTag = context.tags?.includes(tag) ?? false;

        return operator === "has" ? hasTag : !hasTag;
      }

      default: {
        // Exhaustiveness check - this should never happen with proper typing
        const _exhaustiveCheck: never = guard;
        logger.warn({ type: (_exhaustiveCheck as EdgeGuard).type }, "guard:unknownType");
        return true; // Unknown type = pass (fail-safe)
      }
    }
  } catch (error) {
    logger.error({ error, guard }, "guard:evaluationError");
    return true; // On error, allow traversal (fail-safe)
  }
}

/**
 * Filter edges by their guards, keeping edges that pass or have no guard
 *
 * @param edges - The edges to filter
 * @param context - The context to evaluate guards against
 * @param onBlocked - Optional callback invoked when a guard blocks an edge (for event emission)
 * @returns Edges that pass their guards (or have no guard)
 *
 * @example
 * ```ts
 * const edges = [
 *   { id: "1", source: "a", target: "b", guard: { type: "tag", tag: { tag: "vip", operator: "has" } } },
 *   { id: "2", source: "a", target: "c" }, // No guard - always passes
 * ];
 *
 * filterByGuards(edges, { variables: {}, tags: ["standard"] });
 * // Returns: [{ id: "2", ... }] - only edge 2 passes (no guard)
 *
 * // With event emission:
 * filterByGuards(edges, context, (edge, guard) => {
 *   eventLogger.logEvent({ type: "llm.guard.blocked", nodeId, payload: { edgeId: edge.id, ... } });
 * });
 * ```
 */
export function filterByGuards(
  edges: JourneyEdgeData[],
  context: GuardContext,
  onBlocked?: (edge: JourneyEdgeData, guard: EdgeGuard) => void
): JourneyEdgeData[] {
  return edges.filter((edge) => {
    // No guard = always pass
    if (!edge.guard) return true;

    const passes = evaluateGuard(edge.guard, context);

    if (!passes) {
      log.debug({ edgeId: edge.id, guardType: edge.guard.type }, "guard:blocked");
      onBlocked?.(edge, edge.guard);
    }

    return passes;
  });
}

/**
 * Find the designated fallback edge
 * Fallback edges are used when all other guards fail
 *
 * @param edges - The edges to search
 * @returns The fallback edge if one exists, undefined otherwise
 *
 * @example
 * ```ts
 * const edges = [
 *   { id: "1", source: "a", target: "b", guard: {...} },
 *   { id: "2", source: "a", target: "c", fallback: true }, // Fallback edge
 * ];
 *
 * findFallbackEdge(edges); // Returns edge 2
 * ```
 */
export function findFallbackEdge(edges: JourneyEdgeData[]): JourneyEdgeData | undefined {
  return edges.find((edge) => edge.fallback === true);
}

/**
 * Filter edges by guards with fallback support
 *
 * First filters by guards, then if all guards fail, returns the fallback edge.
 * This provides a safety net to prevent users from getting stuck.
 *
 * @param edges - The edges to filter
 * @param context - The context to evaluate guards against
 * @param onBlocked - Optional callback invoked when a guard blocks an edge (for event emission)
 * @returns Edges that pass their guards, or the fallback edge if all fail
 */
export function filterByGuardsWithFallback(
  edges: JourneyEdgeData[],
  context: GuardContext,
  onBlocked?: (edge: JourneyEdgeData, guard: EdgeGuard) => void,
  onFallback?: (fallbackEdge: JourneyEdgeData, blockedEdges: GuardBlockedEdge[]) => void
): JourneyEdgeData[] {
  const passableEdges: JourneyEdgeData[] = [];
  const blockedEdges: GuardBlockedEdge[] = [];

  for (const edge of edges) {
    // No guard = always pass
    if (!edge.guard) {
      passableEdges.push(edge);
      continue;
    }

    const passes = evaluateGuard(edge.guard, context);
    if (passes) {
      passableEdges.push(edge);
      continue;
    }

    log.debug({ edgeId: edge.id, guardType: edge.guard.type }, "guard:blocked");
    onBlocked?.(edge, edge.guard);
    blockedEdges.push({ edge, guard: edge.guard });
  }

  // If any edges pass, return them
  if (passableEdges.length > 0) {
    return passableEdges;
  }

  // All guards failed - try fallback
  const fallbackEdge = findFallbackEdge(edges);
  if (fallbackEdge) {
    log.warn({ fallbackEdgeId: fallbackEdge.id }, "guard:usingFallback:allGuardsFailed");
    onFallback?.(fallbackEdge, blockedEdges);
    return [fallbackEdge];
  }

  // No fallback - return empty (existing behavior)
  // Only warn if there were actual edges with guards that failed
  // Zero edges is not a guard failure - it's a normal condition for end nodes
  if (edges.length > 0) {
    log.warn({ edgeCount: edges.length }, "guard:allGuardsFailed:noFallback");
  }
  return [];
}

/**
 * Build GuardContext from ExecutionContext
 *
 * Extracts the necessary context from the execution context for guard evaluation.
 * This provides a convenient way to integrate guard filtering into handlers.
 *
 * @param execContext - The execution context from node handlers
 * @returns GuardContext ready for guard evaluation
 *
 * @example
 * ```ts
 * // In a handler:
 * const guardContext = buildGuardContextFromExecution(context);
 * const passableEdges = filterByGuardsWithFallback(outgoingEdges, guardContext);
 * ```
 */
export function buildGuardContextFromExecution(execContext: {
  session: { context?: Record<string, unknown>; tags?: string[] };
  clientData?: { id?: string; firstName?: string; lastName?: string; username?: string; platform?: string };
}): GuardContext {
  const { session, clientData } = execContext;

  // Build full context for expression evaluation
  // Spread session.context at top level for flat access ({{score}})
  // Also provide namespaced access ({{user.id}}, {{session.tags}})
  const fullContext: Record<string, unknown> = {
    ...session.context,

    // User namespace
    user: {
      id: clientData?.id ?? "",
      platform: clientData?.platform ?? "unknown",
      firstName: clientData?.firstName ?? "",
      lastName: clientData?.lastName ?? "",
      username: clientData?.username ?? "",
      vars: {},
    },

    // Session namespace
    session: {
      tags: session.tags ?? [],
    },
  };

  return {
    variables: session.context ?? {},
    tags: session.tags ?? [],
    fullContext,
  };
}

/**
 * Derive GuardContext from a pre-built evaluation context
 *
 * Use this when you already have a full evaluation context (from buildEvaluationContext)
 * and need to create a GuardContext for edge filtering. This ensures guards have access
 * to the same namespaces as templates and conditions (vars.*, nodes.*, session.*).
 *
 * @param evalContext - Full evaluation context from buildEvaluationContext()
 * @param session - Session object for variables and tags
 * @returns GuardContext with full namespace access
 *
 * @example
 * ```ts
 * const evalContext = await buildEvaluationContext(session, services, clientData);
 * const guardContext = deriveGuardContextFromEvalContext(evalContext, session);
 * const passableEdges = filterByGuardsWithFallback(outgoingEdges, guardContext);
 * ```
 */
export function deriveGuardContextFromEvalContext(
  evalContext: Record<string, unknown>,
  session: { context?: Record<string, unknown>; tags?: string[] }
): GuardContext {
  return {
    variables: session.context ?? {},
    tags: session.tags ?? [],
    fullContext: evalContext, // Full context includes vars.*, nodes.*, session.*, user.*
  };
}

// =============================================================================
// GUARD REQUIREMENTS ANALYSIS
// =============================================================================

/**
 * Requirements for guard evaluation context
 *
 * Used to determine whether basic or full context is needed for a set of guards.
 * Basic context is sync and fast; full context requires async variable/node fetching.
 */
export interface GuardRequirements {
  /** Guards need vars.journey.*, vars.global.*, or vars.user.* namespaces */
  needsVars: boolean;
  /** Guards need nodes.* namespace (node outputs) */
  needsNodes: boolean;
  /** Guards need mindstate.* namespace */
  needsMindstate: boolean;
  /** True if any requirement needs full context */
  needsFullContext: boolean;
}

/**
 * Patterns that indicate a guard needs full context
 *
 * These patterns require async variable/node fetching:
 * - vars.journey.*, vars.global.*, vars.user.* - variable scopes
 * - nodes.* - node outputs
 * - mindstate.* - mindstate values
 */
const FULL_CONTEXT_PATTERNS = {
  vars: /\bvars\.(journey|global|user)\b/,
  nodes: /\bnodes\./,
  mindstate: /\bmindstate\./,
};

/**
 * Analyze guard expressions to determine context requirements
 *
 * Examines all guard expressions to determine if they need:
 * - Basic context (session, tags, user) - sync, fast
 * - Full context (vars.*, nodes.*, mindstate.*) - async, requires DB/service calls
 *
 * This enables auto-selection of context loading strategy to avoid
 * unnecessary async operations when guards only reference basic data.
 *
 * @param edges - Edges with guards to analyze
 * @returns Requirements indicating what context namespaces are needed
 *
 * @example
 * ```ts
 * const reqs = analyzeGuardRequirements(outgoingEdges);
 * if (reqs.needsFullContext) {
 *   await selector.withFullContext();
 * } else {
 *   selector.withBasicContext();
 * }
 * ```
 */
export function analyzeGuardRequirements(edges: JourneyEdgeData[]): GuardRequirements {
  const result: GuardRequirements = {
    needsVars: false,
    needsNodes: false,
    needsMindstate: false,
    needsFullContext: false,
  };

  for (const edge of edges) {
    if (!edge.guard) continue;

    // Only expression guards can reference complex namespaces
    // Variable and tag guards only use session.context and session.tags
    if (edge.guard.type !== "expression" || !edge.guard.expression) {
      continue;
    }

    const expr = edge.guard.expression;

    // Check each pattern
    if (FULL_CONTEXT_PATTERNS.vars.test(expr)) {
      result.needsVars = true;
    }
    if (FULL_CONTEXT_PATTERNS.nodes.test(expr)) {
      result.needsNodes = true;
    }
    if (FULL_CONTEXT_PATTERNS.mindstate.test(expr)) {
      result.needsMindstate = true;
    }

    // Early exit if we already know we need full context
    if (result.needsVars && result.needsNodes && result.needsMindstate) {
      break;
    }
  }

  result.needsFullContext = result.needsVars || result.needsNodes || result.needsMindstate;
  return result;
}

/**
 * Check if a single guard expression requires full context
 *
 * @param guard - Guard to check
 * @returns True if guard needs vars.*, nodes.*, or mindstate.* namespaces
 */
export function guardRequiresFullContext(guard: EdgeGuard | undefined): boolean {
  if (!guard || guard.type !== "expression" || !guard.expression) {
    return false;
  }

  const expr = guard.expression;
  return (
    FULL_CONTEXT_PATTERNS.vars.test(expr) ||
    FULL_CONTEXT_PATTERNS.nodes.test(expr) ||
    FULL_CONTEXT_PATTERNS.mindstate.test(expr)
  );
}

// =============================================================================
// GUARD EVENT UTILITIES
// =============================================================================

/**
 * Extract guard details for event payloads
 *
 * Safely extracts the type-specific fields from a guard for logging/events.
 * Handles discriminated union by switching on type.
 */
function extractGuardDetails(guard: EdgeGuard): {
  expression?: string;
  variable?: GuardVariableCondition;
  tag?: { tag: string; operator: string };
} {
  switch (guard.type) {
    case "expression":
      return { expression: guard.expression };
    case "variable":
      return { variable: guard.variable };
    case "tag":
      return { tag: guard.tag };
    default: {
      const _exhaustiveCheck: never = guard;
      return {};
    }
  }
}

/**
 * Create a guard blocked callback for event emission
 *
 * Factory function that creates an onBlocked callback for filterByGuards/filterByGuardsWithFallback.
 * The callback emits a system.guard.blocked event when a guard blocks an edge.
 *
 * @param eventLogger - The event logger to emit events to
 * @param nodeId - The current node ID for the event
 * @returns A callback function suitable for passing to filterByGuards
 *
 * @example
 * ```ts
 * const guardContext = buildGuardContextFromExecution(context);
 * const onBlocked = createGuardBlockedCallback(services.eventLogger, node.id);
 * const passableEdges = filterByGuardsWithFallback(outgoingEdges, guardContext, onBlocked);
 * ```
 */
export function createGuardBlockedCallback(
  eventLogger: EventLogger | undefined,
  nodeId: string
): ((edge: JourneyEdgeData, guard: EdgeGuard) => void) | undefined {
  if (!eventLogger) return undefined;

  return (edge: JourneyEdgeData, guard: EdgeGuard) => {
    eventLogger.logEvent({
      type: EventTypes.LLM_GUARD_BLOCKED,
      nodeId,
      payload: {
        edgeId: edge.id,
        guardType: guard.type,
        guard: extractGuardDetails(guard),
      },
    });
  };
}

/**
 * Create a guard fallback callback for event emission
 *
 * Emits an event when all guards fail and a fallback edge is used.
 */
export function createGuardFallbackCallback(
  eventLogger: EventLogger | undefined,
  nodeId: string
): ((fallbackEdge: JourneyEdgeData, blockedEdges: GuardBlockedEdge[]) => void) | undefined {
  if (!eventLogger) return undefined;

  return (fallbackEdge: JourneyEdgeData, blockedEdges: GuardBlockedEdge[]) => {
    eventLogger.logEvent({
      type: EventTypes.LLM_GUARD_FALLBACK,
      nodeId,
      payload: {
        fallbackEdgeId: fallbackEdge.id,
        blockedEdges: blockedEdges.length > 0
          ? blockedEdges.map(({ edge, guard }) => ({
            edgeId: edge.id,
            guardType: guard.type,
            guard: extractGuardDetails(guard),
          }))
          : undefined,
      },
    });
  };
}

// =============================================================================
// NODE DATA TYPE GUARDS
// =============================================================================

/**
 * Type guard for MessageNodeData
 *
 * Checks if a node's data is a message node (type === "message").
 * Use this instead of unsafe `as MessageNodeData` casts.
 *
 * @example
 * ```ts
 * if (isMessageNodeData(node)) {
 *   const buttons = node.data.buttons; // Type-safe access
 * }
 * ```
 */
export function isMessageNodeData(node: JourneyNodeData): node is JourneyNodeData & { data: MessageNodeData } {
  return node.data?.type === "message";
}

/**
 * Type guard for CrmNodeData
 *
 * Checks if a node's data is a CRM node (type === "crm").
 * Use this instead of unsafe `as CrmNodeData` casts.
 *
 * @example
 * ```ts
 * if (isCrmNodeData(node)) {
 *   const { pipelineId, stageId } = node.data; // Type-safe access
 * }
 * ```
 */
export function isCrmNodeData(node: JourneyNodeData): node is JourneyNodeData & { data: CrmNodeData } {
  return node.data?.type === "crm";
}

/**
 * Type guard for AgentNodeData
 *
 * Checks if a node's data is an agent node (type === "agent").
 * Use this instead of unsafe `as AgentNodeData` casts.
 */
export function isAgentNodeData(node: JourneyNodeData): node is JourneyNodeData & { data: AgentNodeData } {
  return node.data?.type === "agent";
}

/**
 * Type guard for WebhookNodeData
 *
 * Checks if a node's data is a webhook node (type === "webhook").
 * Use this instead of unsafe `as WebhookNodeData` casts.
 */
export function isWebhookNodeData(node: JourneyNodeData): node is JourneyNodeData & { data: WebhookNodeData } {
  return node.data?.type === "webhook";
}

/**
 * Type guard for QuestionnaireNodeData
 *
 * Checks if a node's data is a questionnaire node (type === "questionnaire").
 * Use this instead of unsafe `as QuestionnaireNodeData` casts.
 */
export function isQuestionnaireNodeData(node: JourneyNodeData): node is JourneyNodeData & { data: QuestionnaireNodeData } {
  return node.data?.type === "questionnaire";
}

/**
 * Type guard for ConditionNodeData
 *
 * Checks if a node's data is a condition node (type === "condition").
 * Use this instead of unsafe `as ConditionNodeData` casts.
 */
export function isConditionNodeData(node: JourneyNodeData): node is JourneyNodeData & { data: ConditionNodeData } {
  return node.data?.type === "condition";
}

/**
 * Type guard for WaitNodeData
 *
 * Checks if a node's data is a wait node (type === "wait").
 * Use this instead of unsafe `as WaitNodeData` casts.
 */
export function isWaitNodeData(node: JourneyNodeData): node is JourneyNodeData & { data: WaitNodeData } {
  return node.data?.type === "wait";
}

/**
 * Type guard for StartNodeData
 *
 * Checks if a node's data is a start node (type === "start").
 * Use this instead of unsafe `as StartNodeData` casts.
 */
export function isStartNodeData(node: JourneyNodeData): node is JourneyNodeData & { data: StartNodeData } {
  return node.data?.type === "start";
}

/**
 * Type guard for TeleportNodeData
 *
 * Checks if a node's data is a teleport node (type === "teleport").
 * Use this instead of unsafe `as TeleportNodeData` casts.
 */
export function isTeleportNodeData(node: JourneyNodeData): node is JourneyNodeData & { data: TeleportNodeData } {
  return node.data?.type === "teleport";
}

/**
 * Type guard for EndNodeData
 *
 * Checks if a node's data is an end node (type === "end").
 * Use this instead of unsafe `as EndNodeData` casts.
 */
export function isEndNodeData(node: JourneyNodeData): node is JourneyNodeData & { data: EndNodeData } {
  return node.data?.type === "end";
}

// =============================================================================
// ASSERTION HELPER
// =============================================================================

/**
 * Assert node data is of expected type with runtime validation
 *
 * Use this when you need the narrowed type and want a clear error message
 * if the type doesn't match. Useful in handlers where the node type is
 * expected but not guaranteed by the type system.
 *
 * @param node - The node to check
 * @param expectedType - The expected node data type
 * @returns The narrowed node data
 * @throws Error if node data type doesn't match
 *
 * @example
 * ```ts
 * // In a message handler:
 * const messageData = assertNodeData<MessageNodeData>(node, "message");
 * // messageData is now typed as MessageNodeData
 * ```
 */
export function assertNodeData<T extends JourneyNodeData["data"]>(
  node: JourneyNodeData,
  expectedType: string
): T {
  if (node.data?.type !== expectedType) {
    throw new Error(
      `Expected node type '${expectedType}' but got '${node.data?.type}' for node ${node.id}`
    );
  }
  return node.data as T;
}
