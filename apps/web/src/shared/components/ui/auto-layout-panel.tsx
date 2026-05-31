/**
 * Auto Layout Panel
 *
 * Reusable floating panel for configuring and applying automatic node layout.
 * Works with both Journey and Agent Workflow canvases.
 * Stays open until explicitly closed - doesn't close on canvas clicks.
 *
 * @module shared/components/ui/auto-layout-panel
 */

import { useState, useEffect, useRef } from "react";
import { ChevronDown, ChevronRight, X } from "lucide-react";
import { notify } from "@/shared/lib/ui/notify";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import { PanelSurface } from "@/shared/components/ui/panel-surface";
import { cn } from "@/shared/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Slider } from "@/shared/components/ui/slider";
import type {
  LayoutDirection,
  LayoutOptions,
  NodeAlignment,
  ModelOrderStrategy,
  CrossingMinimizationStrategy,
  CycleBreakingStrategy,
} from "@/shared/lib/ui/layout";
import { DEFAULT_LAYOUT_OPTIONS } from "@/shared/lib/ui/layout";

const DIRECTION_LABELS: Record<LayoutDirection, string> = {
  TB: "Top to Bottom",
  BT: "Bottom to Top",
  LR: "Left to Right",
  RL: "Right to Left",
};

const ALIGNMENT_LABELS: Record<NodeAlignment, string> = {
  BALANCED: "Balanced",
  LEFTUP: "Compact Left",
  RIGHTUP: "Compact Right",
};

const MODEL_ORDER_LABELS: Record<ModelOrderStrategy, string> = {
  NONE: "Optimize Crossings",
  NODES_AND_EDGES: "Preserve Order",
  PREFER_NODES: "Prefer Node Order",
  PREFER_EDGES: "Prefer Edge Order",
};

const CROSSING_MIN_LABELS: Record<CrossingMinimizationStrategy, string> = {
  LAYER_SWEEP: "Layer Sweep",
  INTERACTIVE: "Interactive",
};

const CYCLE_BREAKING_LABELS: Record<CycleBreakingStrategy, string> = {
  GREEDY: "Greedy",
  INTERACTIVE: "Interactive",
  MODEL_ORDER: "Model Order",
};

export interface AutoLayoutPanelProps {
  /** Whether the panel is open */
  isOpen: boolean;
  /** Called when panel should close */
  onClose: () => void;
  /** Initial options to show in the panel (e.g., from last apply) */
  initialOptions?: LayoutOptions;
  /** Default options for reset (different for journey vs workflow) */
  defaultOptions?: Required<LayoutOptions>;
  /** Called when panel opens to save current state (for live preview) */
  onStartPreview?: () => void;
  /** Called on every option change for live preview */
  onPreview?: (options: LayoutOptions) => void;
  /** Called when user cancels to restore original state */
  onCancelPreview?: () => void;
  /** Called when user applies the layout (can be async) */
  onApply: (options: LayoutOptions) => void | Promise<void>;
  /** Whether the canvas is in read-only mode */
  readOnly?: boolean;
  /** Additional className for positioning (use for different node selector widths) */
  className?: string;
}

export function AutoLayoutPanel({
  isOpen,
  onClose,
  initialOptions,
  defaultOptions = DEFAULT_LAYOUT_OPTIONS,
  onStartPreview,
  onPreview,
  onCancelPreview,
  onApply,
  readOnly,
  className,
}: AutoLayoutPanelProps) {
  const [options, setOptions] = useState<Required<LayoutOptions>>({
    ...defaultOptions,
    ...initialOptions,
  });
  const [isApplying, setIsApplying] = useState(false);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const hasStartedPreview = useRef(false);
  const userHasInteracted = useRef(false);
  const prevIsOpenRef = useRef(false);

  // Reset options only when panel transitions from closed → open
  // NOT when initialOptions changes while panel is already open (avoids circular reset after Apply)
  useEffect(() => {
    const wasJustOpened = isOpen && !prevIsOpenRef.current;
    prevIsOpenRef.current = isOpen;

    if (wasJustOpened) {
      const newInitial: Required<LayoutOptions> = {
        ...defaultOptions,
        ...initialOptions,
      };
      setOptions(newInitial);
      userHasInteracted.current = false;
    }
  }, [isOpen, initialOptions, defaultOptions]);

  // Start preview when panel opens
  useEffect(() => {
    if (isOpen && !hasStartedPreview.current) {
      onStartPreview?.();
      hasStartedPreview.current = true;
    }
    if (!isOpen) {
      hasStartedPreview.current = false;
    }
  }, [isOpen, onStartPreview]);

  // Update options and trigger preview
  const updateOptions = (newOptions: Required<LayoutOptions>) => {
    setOptions(newOptions);
    userHasInteracted.current = true;
    onPreview?.(newOptions);
  };

  const handleApply = async () => {
    setIsApplying(true);
    try {
      await onApply(options);
      // Don't close panel - let user continue adjusting or manually close
    } catch {
      notify.error("Layout failed", { description: "Could not apply auto-layout. Please try again." });
    } finally {
      setIsApplying(false);
    }
  };

  const handleCancel = () => {
    if (userHasInteracted.current) {
      onCancelPreview?.();
    }
    onClose();
  };

  const handleReset = () => {
    updateOptions(defaultOptions);
  };

  // Don't render if closed or in read-only mode
  if (!isOpen || readOnly) return null;

  return (
    <PanelSurface
      className={cn("absolute z-10 w-64", className)}
      data-testid="auto-layout-panel"
    >
      {/* Header with close button */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <h3 className="font-semibold text-sm">Auto Layout</h3>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={handleCancel}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </Button>
      </div>

      {/* Content */}
      <div className="p-3 space-y-4">
        {/* Direction */}
        <div className="space-y-2">
          <Label htmlFor="direction" className="text-xs">
            Direction
          </Label>
          <Select
            value={options.direction}
            onValueChange={(v) =>
              updateOptions({ ...options, direction: v as LayoutDirection })
            }
          >
            <SelectTrigger id="direction" className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(DIRECTION_LABELS) as LayoutDirection[]).map(
                (dir) => (
                  <SelectItem key={dir} value={dir}>
                    {DIRECTION_LABELS[dir]}
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Node Alignment */}
        <div className="space-y-2">
          <Label htmlFor="alignment" className="text-xs">
            Node Alignment
          </Label>
          <Select
            value={options.alignment}
            onValueChange={(v) =>
              updateOptions({ ...options, alignment: v as NodeAlignment })
            }
          >
            <SelectTrigger id="alignment" className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(ALIGNMENT_LABELS) as NodeAlignment[]).map(
                (align) => (
                  <SelectItem key={align} value={align}>
                    {ALIGNMENT_LABELS[align]}
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Vertical Spacing (rankSep) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="rankSep" className="text-xs">
              Vertical Spacing
            </Label>
            <span className="text-xs text-muted-foreground">
              {options.rankSep}px
            </span>
          </div>
          <Slider
            id="rankSep"
            value={[options.rankSep]}
            onValueChange={([v]) => updateOptions({ ...options, rankSep: v })}
            min={0}
            max={200}
            step={10}
          />
        </div>

        {/* Horizontal Spacing (nodeSep) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="nodeSep" className="text-xs">
              Horizontal Spacing
            </Label>
            <span className="text-xs text-muted-foreground">
              {options.nodeSep}px
            </span>
          </div>
          <Slider
            id="nodeSep"
            value={[options.nodeSep]}
            onValueChange={([v]) => updateOptions({ ...options, nodeSep: v })}
            min={0}
            max={150}
            step={10}
          />
        </div>

        {/* Advanced Section (collapsible) */}
        <div className="border-t pt-3">
          <button
            type="button"
            onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
          >
            {isAdvancedOpen ? (
              <ChevronDown className="size-3" />
            ) : (
              <ChevronRight className="size-3" />
            )}
            Advanced
          </button>

          {isAdvancedOpen && (
            <div className="mt-3 space-y-3">
              {/* Model Order Strategy */}
              <div className="space-y-1.5">
                <Label htmlFor="modelOrder" className="text-xs">
                  Node Order
                </Label>
                <Select
                  value={options.modelOrder}
                  onValueChange={(v) =>
                    updateOptions({ ...options, modelOrder: v as ModelOrderStrategy })
                  }
                >
                  <SelectTrigger id="modelOrder" className="h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(MODEL_ORDER_LABELS) as ModelOrderStrategy[]).map(
                      (strategy) => (
                        <SelectItem key={strategy} value={strategy}>
                          {MODEL_ORDER_LABELS[strategy]}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Crossing Minimization Strategy */}
              <div className="space-y-1.5">
                <Label htmlFor="crossingMin" className="text-xs">
                  Crossing Minimization
                </Label>
                <Select
                  value={options.crossingMinimization}
                  onValueChange={(v) =>
                    updateOptions({ ...options, crossingMinimization: v as CrossingMinimizationStrategy })
                  }
                >
                  <SelectTrigger id="crossingMin" className="h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(CROSSING_MIN_LABELS) as CrossingMinimizationStrategy[]).map(
                      (strategy) => (
                        <SelectItem key={strategy} value={strategy}>
                          {CROSSING_MIN_LABELS[strategy]}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Cycle Breaking Strategy */}
              <div className="space-y-1.5">
                <Label htmlFor="cycleBreaking" className="text-xs">
                  Cycle Breaking
                </Label>
                <Select
                  value={options.cycleBreaking}
                  onValueChange={(v) =>
                    updateOptions({ ...options, cycleBreaking: v as CycleBreakingStrategy })
                  }
                >
                  <SelectTrigger id="cycleBreaking" className="h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(CYCLE_BREAKING_LABELS) as CycleBreakingStrategy[]).map(
                      (strategy) => (
                        <SelectItem key={strategy} value={strategy}>
                          {CYCLE_BREAKING_LABELS[strategy]}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="px-3 py-2 border-t flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleReset}
          className="h-7 text-xs"
        >
          Reset
        </Button>
        <div className="flex-1" />
        <Button size="sm" onClick={handleApply} disabled={isApplying} className="h-7 text-xs">
          Apply
        </Button>
      </div>
    </PanelSurface>
  );
}
