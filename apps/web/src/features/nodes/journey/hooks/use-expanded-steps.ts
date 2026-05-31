/**
 * useExpandedSteps Hook
 *
 * Manages UI-only expansion state for step editors (follow-up, etc.).
 * Handles index shifting when steps are added or removed.
 *
 * This hook extracts step expansion state management from individual
 * editor components to reduce complexity and improve reusability.
 *
 * @module features/nodes/journey/hooks/use-expanded-steps
 */

import { useCallback, useState } from "react";

// =============================================================================
// TYPES
// =============================================================================

export interface UseExpandedStepsReturn {
  /** Current set of expanded step indices */
  expandedSteps: Set<number>;
  /** Toggle expansion state for a step */
  toggleStep: (index: number) => void;
  /** Check if a step is expanded */
  isExpanded: (index: number) => boolean;
  /** Expand a newly added step (call after adding) */
  onStepAdded: (newIndex: number) => void;
  /** Shift indices when a step is removed (call after removing) */
  onStepRemoved: (removedIndex: number) => void;
}

// =============================================================================
// HOOK IMPLEMENTATION
// =============================================================================

/**
 * Hook for managing step expansion state in step-based editors.
 *
 * Features:
 * - Tracks which steps are expanded (by index)
 * - Auto-expands first step if available
 * - Auto-expands newly added steps
 * - Shifts indices when steps are removed to maintain correct expansion state
 *
 * @param initialStepCount - Number of steps on initial render (expands first if > 0)
 * @returns Expansion state and handlers
 *
 * @example
 * ```tsx
 * const steps = useExpandedSteps(pluginData.steps?.length ?? 0);
 *
 * // In render:
 * {formValues.steps.map((step, index) => (
 *   <StepEditor
 *     isExpanded={steps.isExpanded(index)}
 *     onToggleExpand={() => steps.toggleStep(index)}
 *   />
 * ))}
 *
 * // When adding:
 * handleAddStep = () => {
 *   const newIndex = addStep();
 *   steps.onStepAdded(newIndex);
 * };
 *
 * // When removing:
 * handleRemoveStep = (index) => {
 *   removeStep(index);
 *   steps.onStepRemoved(index);
 * };
 * ```
 */
export function useExpandedSteps(initialStepCount: number): UseExpandedStepsReturn {
  // Initialize with first step expanded if any steps exist
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(
    new Set(initialStepCount > 0 ? [0] : [])
  );

  /**
   * Toggle expansion state for a step.
   */
  const toggleStep = useCallback((index: number) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  /**
   * Check if a step is currently expanded.
   */
  const isExpanded = useCallback(
    (index: number) => expandedSteps.has(index),
    [expandedSteps]
  );

  /**
   * Expand a newly added step.
   * Call this after adding a step to the array.
   */
  const onStepAdded = useCallback((newIndex: number) => {
    setExpandedSteps((prev) => new Set([...prev, newIndex]));
  }, []);

  /**
   * Shift indices when a step is removed.
   * Call this after removing a step from the array.
   *
   * Indices above the removed index are decremented by 1.
   * The removed index is discarded.
   */
  const onStepRemoved = useCallback((removedIndex: number) => {
    setExpandedSteps((prev) => {
      const next = new Set<number>();
      prev.forEach((i) => {
        if (i < removedIndex) {
          // Keep lower indices as-is
          next.add(i);
        } else if (i > removedIndex) {
          // Shift higher indices down by 1
          next.add(i - 1);
        }
        // Skip the removed index
      });
      return next;
    });
  }, []);

  return {
    expandedSteps,
    toggleStep,
    isExpanded,
    onStepAdded,
    onStepRemoved,
  };
}
