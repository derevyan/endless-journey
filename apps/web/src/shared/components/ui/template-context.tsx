/**
 * Template Context
 *
 * Provides shared data for template components (TemplateTextarea, TemplateInput)
 * to eliminate prop drilling of nodes, edges, journeyId through multiple levels.
 *
 * Before: MessageNodeEditor → TemplateTextarea → useTemplateField → useTemplateAutocomplete
 * After: TemplateProvider wraps editors, children read from context
 *
 * @module shared/components/ui/template-context
 */

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { JourneyEdge, JourneyNode } from "@/features/nodes/journey/react-flow-types";
import type { WorkflowNode } from "@journey/schemas";

// ============================================================================
// Types
// ============================================================================

export interface TemplateContextValue {
  /** All nodes in the journey (for variable resolution) */
  nodes: JourneyNode[];
  /** All edges in the journey (for upstream node detection) */
  edges: JourneyEdge[];
  /** Current journey ID (for journey-specific variables) */
  journeyId: string | null;
  /** Current node ID (for filtering self from variable sources) */
  nodeId: string;
  /** Workflow key (for workflow-declared variables in autocomplete) */
  workflowKey?: string;
  /** Workflow nodes (for agent workflow variable discovery) */
  workflowNodes?: WorkflowNode[];
}

// ============================================================================
// Context
// ============================================================================

const TemplateContext = createContext<TemplateContextValue | null>(null);

// ============================================================================
// Provider
// ============================================================================

interface TemplateProviderProps extends TemplateContextValue {
  children: ReactNode;
}

/**
 * Provider component that supplies template-related data to template components.
 *
 * Wrap node editors with this provider to eliminate prop drilling for
 * TemplateTextarea, TemplateInput, and related components.
 *
 * @example
 * ```tsx
 * <TemplateProvider
 *   nodes={context.nodes}
 *   edges={context.edges}
 *   journeyId={context.journeyUuid}
 *   nodeId={node.id}
 * >
 *   <TemplateTextarea value={content} onChange={handleChange} />
 * </TemplateProvider>
 * ```
 */
export function TemplateProvider({
  children,
  nodes,
  edges,
  journeyId,
  nodeId,
  workflowKey,
  workflowNodes,
}: TemplateProviderProps) {
  const value = useMemo<TemplateContextValue>(
    () => ({ nodes, edges, journeyId, nodeId, workflowKey, workflowNodes }),
    [nodes, edges, journeyId, nodeId, workflowKey, workflowNodes]
  );

  return (
    <TemplateContext.Provider value={value}>{children}</TemplateContext.Provider>
  );
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook to access template context.
 *
 * Must be used within a TemplateProvider.
 *
 * @throws Error if used outside TemplateProvider
 */
export function useTemplateContext(): TemplateContextValue {
  const context = useContext(TemplateContext);

  if (!context) {
    throw new Error("useTemplateContext must be used within a TemplateProvider");
  }

  return context;
}
