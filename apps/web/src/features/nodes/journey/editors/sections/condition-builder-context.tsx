/**
 * Condition Builder Context
 *
 * Provides shared data and callbacks to SortableRule components,
 * eliminating prop drilling for graph data and shared state.
 *
 * Pattern: Context Provider for Callback Consolidation
 *
 * Before: SortableRule received 11 props
 * After: SortableRule receives 5 props (rule-specific only)
 *
 * @module features/nodes/journey/editors/sections/condition-builder-context
 */

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { ConditionRule } from "@journey/schemas";
import type { JourneyEdge, JourneyNode } from "@/features/nodes/journey/react-flow-types";
import type { SelectableVariable } from "@/shared/components/ui/variable-selector-popover";

// ============================================================================
// Types
// ============================================================================

export interface ConditionBuilderContextValue {
  // Graph data for variable resolution and template inputs
  nodes: JourneyNode[];
  edges: JourneyEdge[];
  nodeId: string;
  journeyId: string | null | undefined;

  // Pre-computed variables for dropdowns
  groupedVariables: Record<string, SelectableVariable[]>;

  // Shared state
  readOnly: boolean;

  // Callbacks (with index for identifying which rule)
  onRuleChange: (index: number, updates: Partial<ConditionRule>) => void;
  onRemove: (index: number) => void;
}

// ============================================================================
// Context
// ============================================================================

const ConditionBuilderContext = createContext<ConditionBuilderContextValue | null>(null);

// ============================================================================
// Provider
// ============================================================================

interface ConditionBuilderProviderProps extends ConditionBuilderContextValue {
  children: ReactNode;
}

/**
 * Provider component that supplies shared data and callbacks to SortableRule components.
 *
 * @example
 * ```tsx
 * <ConditionBuilderProvider
 *   nodes={nodes}
 *   edges={edges}
 *   nodeId={nodeId}
 *   journeyId={journeyId}
 *   groupedVariables={groupedVariables}
 *   readOnly={readOnly}
 *   onRuleChange={handleRuleChange}
 *   onRemove={handleRemoveRule}
 * >
 *   {rules.map((rule, index) => (
 *     <SortableRule key={rule._id} rule={rule} index={index} totalRules={rules.length} />
 *   ))}
 * </ConditionBuilderProvider>
 * ```
 */
export function ConditionBuilderProvider({
  children,
  nodes,
  edges,
  nodeId,
  journeyId,
  groupedVariables,
  readOnly,
  onRuleChange,
  onRemove,
}: ConditionBuilderProviderProps) {
  const value = useMemo<ConditionBuilderContextValue>(
    () => ({
      nodes,
      edges,
      nodeId,
      journeyId,
      groupedVariables,
      readOnly,
      onRuleChange,
      onRemove,
    }),
    [nodes, edges, nodeId, journeyId, groupedVariables, readOnly, onRuleChange, onRemove]
  );

  return <ConditionBuilderContext.Provider value={value}>{children}</ConditionBuilderContext.Provider>;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook to access ConditionBuilder context.
 *
 * Must be used within a ConditionBuilderProvider.
 *
 * @example
 * ```tsx
 * function SortableRule({ rule, index, totalRules }) {
 *   const { nodes, edges, nodeId, journeyId, groupedVariables, readOnly, onRuleChange, onRemove } =
 *     useConditionBuilderContext();
 *
 *   const handleChange = (updates) => onRuleChange(index, updates);
 *   // ...
 * }
 * ```
 *
 * @throws Error if used outside ConditionBuilderProvider
 */
export function useConditionBuilderContext(): ConditionBuilderContextValue {
  const context = useContext(ConditionBuilderContext);

  if (!context) {
    throw new Error("useConditionBuilderContext must be used within a ConditionBuilderProvider");
  }

  return context;
}
