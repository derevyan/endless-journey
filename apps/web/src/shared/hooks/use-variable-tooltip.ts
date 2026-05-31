/**
 * useVariableTooltip Hook
 *
 * Manages hover state and timing for variable tooltips in template components.
 * Handles the delayed hide behavior that allows users to move their cursor
 * from the variable to the tooltip without it disappearing.
 *
 * @module shared/hooks/use-variable-tooltip
 */

import { useCallback, useRef, useState } from "react";

export interface HoveredVariable {
  path: string;
  x: number;
  y: number;
}

export interface UseVariableTooltipResult {
  /** Currently hovered variable info, or null if none */
  hoveredVariable: HoveredVariable | null;
  /** Call when variable hover state changes (path=null means hover ended) */
  handleVariableHover: (path: string | null, x: number, y: number) => void;
  /** Call when mouse enters the tooltip */
  handleTooltipMouseEnter: () => void;
  /** Call when mouse leaves the tooltip */
  handleTooltipMouseLeave: () => void;
}

/**
 * Hook for managing variable tooltip hover state.
 *
 * Implements a 100ms delay before hiding the tooltip when the cursor leaves
 * a variable, allowing users to move to the tooltip itself. The tooltip
 * stays visible while the cursor is over it.
 *
 * @example
 * ```tsx
 * const { hoveredVariable, handleVariableHover, handleTooltipMouseEnter, handleTooltipMouseLeave } =
 *   useVariableTooltip();
 *
 * return (
 *   <>
 *     <HighlightedInput onVariableHover={handleVariableHover} />
 *     {hoveredVariable && (
 *       <VariableTooltip
 *         variablePath={hoveredVariable.path}
 *         x={hoveredVariable.x}
 *         y={hoveredVariable.y}
 *         onMouseEnter={handleTooltipMouseEnter}
 *         onMouseLeave={handleTooltipMouseLeave}
 *       />
 *     )}
 *   </>
 * );
 * ```
 */
export function useVariableTooltip(): UseVariableTooltipResult {
  const [hoveredVariable, setHoveredVariable] = useState<HoveredVariable | null>(null);
  const isOnTooltipRef = useRef(false);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleVariableHover = useCallback((path: string | null, x: number, y: number) => {
    // Clear any pending hide timeout
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }

    if (path) {
      // Show tooltip immediately
      setHoveredVariable({ path, x, y });
    } else {
      // Delay hide to allow moving to tooltip
      hideTimeoutRef.current = setTimeout(() => {
        if (!isOnTooltipRef.current) {
          setHoveredVariable(null);
        }
      }, 100);
    }
  }, []);

  const handleTooltipMouseEnter = useCallback(() => {
    isOnTooltipRef.current = true;
    // Cancel any pending hide
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }, []);

  const handleTooltipMouseLeave = useCallback(() => {
    isOnTooltipRef.current = false;
    setHoveredVariable(null);
  }, []);

  return {
    hoveredVariable,
    handleVariableHover,
    handleTooltipMouseEnter,
    handleTooltipMouseLeave,
  };
}
