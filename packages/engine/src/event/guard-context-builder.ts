/**
 * Guard Context Builder
 *
 * Builds guard evaluation contexts for edge selection.
 * Extracted from EventRouter to follow Single Responsibility Principle.
 *
 * Two modes of context building:
 * - Basic: Sync, limited context (session only) - fallback when services unavailable
 * - Full: Async, complete context (vars.*, nodes.*, session.*, user.*) - preferred
 */

import type { createLogger } from "@journey/logger";
import type { EnhancedUserJourney, JourneyEdgeData, JourneyNodeData } from "@journey/schemas";
import type { SessionStateManager } from "../state/session-state-manager";
import type { ExecutionContext } from "../types";
import { buildGuardContextFromExecution, createStateMethods, type GuardContext } from "../utils";
import { EdgeSelector } from "../services/edge-selector";

// =============================================================================
// TYPES
// =============================================================================

/** Client data for guard context (user namespace) */
export interface GuardContextClientData {
  id?: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  platform?: string;
}

export interface GuardContextBuilderConfig {
  session: EnhancedUserJourney;
  stateManager: SessionStateManager;
  log: ReturnType<typeof createLogger>;
}

export interface GuardContextBuilderCallbacks {
  getClientData?: () => GuardContextClientData | undefined;
  getOutgoingEdges: (nodeId: string) => JourneyEdgeData[];
  getServices?: () => ExecutionContext["services"];
}

// =============================================================================
// FUNCTIONS
// =============================================================================

/**
 * Build limited GuardContext from session for edge guard evaluation.
 *
 * Uses shared utility from guard-utils.ts for consistent context building.
 * Includes user namespace for expression guards like `user.platform === "telegram"`
 *
 * @internal This is a fallback when services are unavailable.
 * Prefer buildFullGuardContext() for full namespace support (vars.*, nodes.*)
 */
export function buildBasicGuardContext(
  config: GuardContextBuilderConfig,
  callbacks: GuardContextBuilderCallbacks
): GuardContext {
  const { session } = config;
  const { getClientData } = callbacks;

  // Get client data for user namespace (may be undefined)
  const clientData = getClientData?.();

  // Use shared utility, passing session.userId as fallback for client ID
  return buildGuardContextFromExecution({
    session,
    clientData: clientData
      ? { ...clientData, id: clientData.id ?? session.userId }
      : session.userId
        ? { id: session.userId }
        : undefined,
  });
}

/**
 * Build full GuardContext with all namespaces (vars.*, nodes.*, session.*, user.*)
 *
 * Uses EdgeSelector to build the guard context with full evaluation context.
 * This includes:
 * - vars.journey.* - Journey-scoped variables
 * - vars.global.* - Global variables
 * - vars.user.* - User-scoped variables
 * - nodes.* - Cross-node output references
 *
 * Required for guards that use expressions like "vars.journey.score > 50"
 */
export async function buildFullGuardContext(
  config: GuardContextBuilderConfig,
  callbacks: GuardContextBuilderCallbacks,
  currentNode: JourneyNodeData
): Promise<GuardContext> {
  const { session, stateManager, log } = config;
  const { getServices, getClientData, getOutgoingEdges } = callbacks;

  // If services unavailable, fall back to limited context
  if (!getServices) {
    log.debug({ nodeId: currentNode.id }, "router:guardContext:servicesUnavailable:usingLimitedContext");
    return buildBasicGuardContext(config, callbacks);
  }

  // Build execution context for EdgeSelector
  const routerClientData = getClientData?.();
  const executionContext: ExecutionContext = {
    session,
    node: currentNode,
    journey: undefined, // Not needed for event handling contexts
    outgoingEdges: getOutgoingEdges(currentNode.id),
    services: getServices(),
    log,
    clientData: routerClientData?.id
      ? { ...routerClientData, id: routerClientData.id, platform: routerClientData.platform ?? "unknown" }
      : undefined,
    stateManager,
    ...createStateMethods(session, currentNode.id, currentNode.data.type, stateManager),
  };

  // Use EdgeSelector with auto context selection
  // Analyzes guards to determine if basic (sync) or full (async) context is needed
  const outgoingEdges = getOutgoingEdges(currentNode.id);
  const selector = await EdgeSelector.from(executionContext).withAutoContext(outgoingEdges);
  return selector.getGuardContext();
}
