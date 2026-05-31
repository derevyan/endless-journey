/**
 * Edge Selector Service
 *
 * Provides unified edge selection with guard filtering through the EdgeSelector class.
 *
 * @example
 * ```ts
 * // Sync - basic context (session only):
 * const { passableEdges } = EdgeSelector.from(context).withBasicContext().select(edges);
 *
 * // Async - full context (vars.*, nodes.*, session.*, user.*):
 * const { passableEdges } = await EdgeSelector.from(context).withFullContext().then(s => s.select(edges));
 *
 * // Two-phase selection (guards first, then fallback):
 * const { passableEdges, guardPassableEdges } = EdgeSelector.from(context).withBasicContext().selectTwoPhase(edges);
 *
 * // Validate specific edge:
 * const validatedEdge = EdgeSelector.from(context).withBasicContext().validateEdge(targetEdge, allEdges);
 * ```
 */

import type { JourneyEdgeData } from "@journey/schemas";
import type { ExecutionContext } from "../types";
import {
  analyzeGuardRequirements,
  buildGuardContextFromExecution,
  createGuardBlockedCallback,
  createGuardFallbackCallback,
  deriveGuardContextFromEvalContext,
  evaluateGuard,
  filterByGuards,
  filterByGuardsWithFallback,
  findFallbackEdge,
  type GuardContext,
  type GuardRequirements,
} from "../utils/guard-utils";
import { getOrBuildEvaluationContext } from "../utils/context";

/**
 * Result of edge selection with guard filtering
 */
export interface EdgeSelectionResult {
  /** Edges that pass guards (or fallback if all fail) */
  passableEdges: JourneyEdgeData[];
  /** Set of edge IDs that passed guards (for quick lookup) */
  passableEdgeIds: Set<string>;
  /** The guard context used for evaluation */
  guardContext: GuardContext;
}

/**
 * Result of two-phase edge selection
 * Includes additional field for edges that passed guards (before fallback)
 */
export interface TwoPhaseEdgeSelectionResult extends EdgeSelectionResult {
  /** Edges that passed guards without fallback */
  guardPassableEdges: JourneyEdgeData[];
}

// =============================================================================
// EDGE SELECTOR CLASS - Unified API for edge selection
// =============================================================================

/**
 * EdgeSelector - Unified edge selection with fluent API
 *
 * Consolidates 6 edge selection functions into a single class with method chaining.
 * Reduces code duplication and provides a cleaner, more readable API.
 *
 * @example
 * ```ts
 * // Basic (sync) - for guards using session/tags only:
 * const { passableEdges } = EdgeSelector.from(context).withBasicContext().select(edges);
 *
 * // Full (async) - for guards using vars.*, nodes.*:
 * const selector = await EdgeSelector.from(context).withFullContext();
 * const { passableEdges } = selector.select(edges);
 *
 * // Two-phase selection:
 * const { passableEdges, guardPassableEdges } = EdgeSelector.from(context)
 *   .withBasicContext()
 *   .selectTwoPhase(edges);
 *
 * // Validate specific edge:
 * const validatedEdge = EdgeSelector.from(context)
 *   .withBasicContext()
 *   .validateEdge(targetEdge, allEdges);
 * ```
 */
export class EdgeSelector {
  private context: ExecutionContext;
  private guardContext?: GuardContext;
  private contextLoaded = false;

  private constructor(context: ExecutionContext) {
    this.context = context;
  }

  /**
   * Create selector from execution context
   */
  static from(context: ExecutionContext): EdgeSelector {
    return new EdgeSelector(context);
  }

  /**
   * Load full evaluation context (async operation)
   * Enables guards to use vars.*, nodes.*, session.*, user.*
   *
   * @returns Promise resolving to this selector (for chaining)
   */
  async withFullContext(): Promise<this> {
    const { session } = this.context;
    const evalContext = await getOrBuildEvaluationContext(this.context);
    this.guardContext = deriveGuardContextFromEvalContext(evalContext, session);
    this.contextLoaded = true;
    return this;
  }

  /**
   * Use basic context (sync, no variable fetching)
   * Only supports guards using session.context, tags, or user namespace
   *
   * @returns this selector (for chaining)
   */
  withBasicContext(): this {
    this.guardContext = buildGuardContextFromExecution(this.context);
    this.contextLoaded = true;
    return this;
  }

  /**
   * Use pre-built guard context (avoids async overhead when context already loaded)
   * Useful when guard context has already been computed elsewhere
   *
   * @param guardContext - Pre-built guard context with full namespaces (vars.*, nodes.*, etc.)
   * @returns this selector (for chaining)
   */
  withPrebuiltContext(guardContext: GuardContext): this {
    this.guardContext = guardContext;
    this.contextLoaded = true;
    return this;
  }

  /**
   * Auto-select context based on guard requirements
   *
   * Analyzes guards in the provided edges to determine if they need full context
   * (vars.*, nodes.*, mindstate.*) or if basic context (session, tags) is sufficient.
   *
   * This optimization avoids unnecessary async DB/service calls when guards
   * only reference session data, tags, or user info.
   *
   * @param edges - Edges with guards to analyze
   * @returns Promise resolving to this selector (for chaining)
   *
   * @example
   * ```ts
   * // Auto-selects basic or full context based on guard patterns
   * const selector = await EdgeSelector.from(context).withAutoContext(outgoingEdges);
   * const { passableEdges } = selector.selectTwoPhase(outgoingEdges);
   * ```
   */
  async withAutoContext(edges: JourneyEdgeData[]): Promise<this> {
    const requirements = analyzeGuardRequirements(edges);

    if (requirements.needsFullContext) {
      // Guards reference vars.*, nodes.*, or mindstate.* - need full async context
      return this.withFullContext();
    }

    // Basic context is sufficient - sync and fast
    return this.withBasicContext();
  }

  /**
   * Analyze guard requirements for edges
   *
   * Determines what context namespaces are needed for guard evaluation.
   * Useful for logging or conditional logic before context loading.
   *
   * @param edges - Edges with guards to analyze
   * @returns Requirements indicating what context namespaces are needed
   */
  static analyzeRequirements(edges: JourneyEdgeData[]): GuardRequirements {
    return analyzeGuardRequirements(edges);
  }

  /**
   * Select edges that pass guards
   *
   * @param edges - Outgoing edges to filter
   * @returns Passable edges, their IDs as a Set, and the guard context
   */
  select(edges: JourneyEdgeData[]): EdgeSelectionResult {
    const gc = this.ensureGuardContext();
    const passableEdges = filterByGuardsWithFallback(
      edges,
      gc,
      this.createBlockedCallback(),
      this.createFallbackCallback()
    );
    const passableEdgeIds = new Set(passableEdges.map((e) => e.id));
    return { passableEdges, passableEdgeIds, guardContext: gc };
  }

  /**
   * Two-phase selection (guards first, then fallback)
   *
   * Phase 1: Filter by guards normally (without fallback)
   * Phase 2: If no edges pass, use fallback logic
   *
   * @param edges - Outgoing edges to filter
   * @returns Passable edges with guard-only edges separated
   */
  selectTwoPhase(edges: JourneyEdgeData[]): TwoPhaseEdgeSelectionResult {
    const gc = this.ensureGuardContext();
    const onBlocked = this.createBlockedCallback();
    const onFallback = this.createFallbackCallback();

    // Phase 1: Normal guard filtering (no fallback yet)
    const guardPassableEdges = filterByGuards(edges, gc, onBlocked);

    // Phase 2: If all failed, apply fallback logic
    const passableEdges =
      guardPassableEdges.length > 0
        ? guardPassableEdges
        : filterByGuardsWithFallback(edges, gc, undefined, onFallback);

    // passableEdgeIds tracks guards-only (before fallback) for quick lookups
    const passableEdgeIds = new Set(guardPassableEdges.map((e) => e.id));

    return { passableEdges, passableEdgeIds, guardContext: gc, guardPassableEdges };
  }

  /**
   * Validate specific edge against its guard, return fallback if blocked
   *
   * @param targetEdge - The edge to validate
   * @param allEdges - All outgoing edges (for fallback lookup)
   * @returns The target edge if it passes, or fallback edge if blocked
   */
  validateEdge(targetEdge: JourneyEdgeData, allEdges: JourneyEdgeData[]): JourneyEdgeData {
    const gc = this.ensureGuardContext();
    const { node, log } = this.context;
    const onBlocked = this.createBlockedCallback();
    const onFallback = this.createFallbackCallback();

    // Check if target edge passes its guard
    if (targetEdge.guard && !evaluateGuard(targetEdge.guard, gc)) {
      log.debug(
        { nodeId: node.id, edgeId: targetEdge.id, guardType: targetEdge.guard.type },
        "edgeSelector:guardBlocked"
      );
      onBlocked?.(targetEdge, targetEdge.guard);

      // Try fallback edge
      const fallbackEdge = findFallbackEdge(allEdges);
      if (fallbackEdge) {
        log.warn({ nodeId: node.id, fallbackEdgeId: fallbackEdge.id }, "edgeSelector:usingFallback");
        onFallback?.(fallbackEdge, [{ edge: targetEdge, guard: targetEdge.guard }]);
        return fallbackEdge;
      }
      // No fallback - return original edge (fail-safe behavior)
    }

    return targetEdge;
  }

  /**
   * Get the guard context (useful for advanced use cases)
   */
  getGuardContext(): GuardContext {
    return this.ensureGuardContext();
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private ensureGuardContext(): GuardContext {
    if (!this.contextLoaded || !this.guardContext) {
      throw new Error(
        "EdgeSelector: Guard context not loaded. Call withBasicContext() or await withFullContext() first."
      );
    }
    return this.guardContext;
  }

  private createBlockedCallback() {
    const { node, services } = this.context;
    return createGuardBlockedCallback(services.eventLogger, node.id);
  }

  private createFallbackCallback() {
    const { node, services } = this.context;
    return createGuardFallbackCallback(services.eventLogger, node.id);
  }
}

