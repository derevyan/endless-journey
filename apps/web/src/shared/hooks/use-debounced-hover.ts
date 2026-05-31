/**
 * useDebouncedHover Hook
 *
 * Manages debounced hover state for tooltips and previews.
 * Delays updates by a configurable amount to prevent flicker
 * when rapidly moving between items.
 *
 * @module hooks/use-debounced-hover
 */

import { useCallback, useEffect, useRef, useState } from "react";

interface UseDebouncedHoverOptions {
  /** Delay in milliseconds before updating state (default: 100) */
  delay?: number;
  /** Whether to persist the last hovered item when leaving (default: false) */
  persistOnLeave?: boolean;
}

interface UseDebouncedHoverResult<T> {
  /** Current hovered item (debounced) */
  hoveredItem: T | null;
  /** Handler to call on mouse enter */
  handleHover: (item: T | null) => void;
  /** Handler to call on mouse leave */
  handleLeave: () => void;
  /** Clear the hovered item immediately */
  clearHover: () => void;
}

/**
 * Hook for managing debounced hover state
 *
 * @param options - Configuration options
 * @returns Object with hover state and handlers
 *
 * @example
 * const { hoveredItem, handleHover, handleLeave } = useDebouncedHover<SelectableVariable>();
 *
 * // In render:
 * <div
 *   onMouseEnter={() => handleHover(variable)}
 *   onMouseLeave={handleLeave}
 * >
 *   {variable.name}
 * </div>
 *
 * // For preview panel:
 * {hoveredItem && <Preview item={hoveredItem} />}
 */
export function useDebouncedHover<T>(options?: UseDebouncedHoverOptions): UseDebouncedHoverResult<T> {
  const { delay = 100, persistOnLeave = false } = options ?? {};

  const [hoveredItem, setHoveredItem] = useState<T | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Debounced hover handler
  const handleHover = useCallback(
    (item: T | null) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        setHoveredItem(item);
      }, delay);
    },
    [delay]
  );

  // Leave handler - optionally persist the last item
  const handleLeave = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (!persistOnLeave) {
      timeoutRef.current = setTimeout(() => {
        setHoveredItem(null);
      }, delay);
    }
  }, [delay, persistOnLeave]);

  // Immediately clear hover state (e.g., on selection)
  const clearHover = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setHoveredItem(null);
  }, []);

  return {
    hoveredItem,
    handleHover,
    handleLeave,
    clearHover,
  };
}
