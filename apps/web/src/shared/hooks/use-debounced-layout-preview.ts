/**
 * Shared Hook for Debounced Layout Preview
 *
 * Provides debounced preview and apply handlers for auto-layout panels.
 * Uses 150ms debounce to balance responsiveness with ELK layout calculation time.
 *
 * @module shared/hooks/use-debounced-layout-preview
 */

import { useCallback, useEffect, useRef } from "react";
import type { LayoutOptions } from "@/shared/lib/ui/layout";
import type { NodeDimensions } from "@/shared/lib/ui/node-dimensions";

/**
 * Configuration for the debounced layout preview hook.
 */
export interface UseDebouncedLayoutPreviewConfig {
  /** Function to get all node dimensions */
  getAllDimensions: (nodes: Array<{ id: string; type?: string }>) => Map<string, NodeDimensions>;
  /** Current nodes array */
  nodes: Array<{ id: string; type?: string }>;
  /** Async function to preview layout */
  previewLayoutAsync: (options: LayoutOptions, dimensions: Map<string, NodeDimensions>) => Promise<void>;
  /** Async function to apply/commit layout */
  commitLayoutAsync: (options: LayoutOptions, dimensions: Map<string, NodeDimensions>) => Promise<void>;
  /** Debounce delay in milliseconds (default: 150) */
  debounceMs?: number;
}

/**
 * Return type for useDebouncedLayoutPreview hook.
 */
export interface UseDebouncedLayoutPreviewResult {
  /** Debounced preview handler for slider changes */
  handlePreviewLayout: (options: LayoutOptions) => void;
  /** Apply handler that clears pending preview and commits layout */
  handleApplyLayout: (options: LayoutOptions) => Promise<void>;
}

/**
 * Hook for debounced layout preview and apply.
 *
 * Uses ELK for both preview and apply to ensure consistent layout appearance.
 * Debounces preview calls to prevent overwhelming the layout engine during
 * slider interactions.
 *
 * @example
 * ```tsx
 * const { handlePreviewLayout, handleApplyLayout } = useDebouncedLayoutPreview({
 *   getAllDimensions,
 *   nodes: storeNodes,
 *   previewLayoutAsync: async (options, dims) => {
 *     await actions.previewLayoutAsync(options, dims);
 *   },
 *   commitLayoutAsync: async (options, dims) => {
 *     await actions.commitLayoutPreviewAsync(options, dims);
 *   },
 * });
 *
 * <AutoLayoutPanel
 *   onPreview={handlePreviewLayout}
 *   onApply={handleApplyLayout}
 * />
 * ```
 */
export function useDebouncedLayoutPreview(
  config: UseDebouncedLayoutPreviewConfig
): UseDebouncedLayoutPreviewResult {
  const { getAllDimensions, nodes, previewLayoutAsync, commitLayoutAsync, debounceMs = 150 } = config;

  // Ref for debouncing preview layout calls
  const previewDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Clear any pending preview debounce.
   */
  const clearPendingPreview = useCallback(() => {
    if (previewDebounceRef.current) {
      clearTimeout(previewDebounceRef.current);
      previewDebounceRef.current = null;
    }
  }, []);

  /**
   * Handle layout preview with debouncing.
   * Uses ELK with measured dimensions for consistent preview.
   */
  const handlePreviewLayout = useCallback(
    (options: LayoutOptions) => {
      clearPendingPreview();

      // Debounce the async ELK layout calculation
      previewDebounceRef.current = setTimeout(async () => {
        const dimensions = getAllDimensions(nodes);
        await previewLayoutAsync(options, dimensions);
      }, debounceMs);
    },
    [getAllDimensions, nodes, previewLayoutAsync, debounceMs, clearPendingPreview]
  );

  /**
   * Handle layout apply - clears pending preview and commits layout.
   * Uses ELK for superior layout quality with actual node sizes.
   */
  const handleApplyLayout = useCallback(
    async (options: LayoutOptions) => {
      clearPendingPreview();

      // Get measured dimensions for all nodes from React Flow's internal state
      const dimensions = getAllDimensions(nodes);
      // Apply ELK layout with measured dimensions, then commit to history
      await commitLayoutAsync(options, dimensions);
    },
    [getAllDimensions, nodes, commitLayoutAsync, clearPendingPreview]
  );

  // Cleanup debounce timeout on unmount
  useEffect(() => {
    return clearPendingPreview;
  }, [clearPendingPreview]);

  return {
    handlePreviewLayout,
    handleApplyLayout,
  };
}
