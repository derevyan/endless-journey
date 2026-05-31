/**
 * Node Selector Panel
 *
 * Reusable overlay panel for adding nodes to canvas via drag-and-drop.
 * Uses React Flow's Panel component for consistent positioning.
 * Works with both Journey and Agent Workflow canvases.
 *
 * Supports optional sections for grouping items (e.g., Nodes vs Plugins).
 *
 * @module shared/components/ui/node-selector-panel
 */

import { Panel } from "@xyflow/react";
import { useCallback } from "react";

import { Button } from "@/shared/components/ui/button";
import { PanelSurface } from "@/shared/components/ui/panel-surface";
import { cn } from "@/shared/lib/utils";

/**
 * Node item definition for the selector panel
 */
export interface NodeSelectorItem {
  /** Unique node type identifier */
  type: string;
  /** Display label */
  label: string;
  /** Icon component */
  icon: React.ComponentType<{ className?: string }>;
  /** Optional icon color class (e.g., "text-blue-500") */
  iconColorClass?: string;
  /** Optional click handler (for items that don't use drag-and-drop, like plugins) */
  onClick?: () => void;
  /** Whether this item is disabled */
  disabled?: boolean;
  /** Optional tooltip when disabled */
  disabledTooltip?: string;
}

/**
 * Section definition for grouping items
 */
export interface NodeSelectorSection {
  /** Section title */
  title: string;
  /** Items in this section */
  items: NodeSelectorItem[];
}

export interface NodeSelectorPanelProps {
  /** Array of node items to display (flat list, backwards compatible) */
  nodes?: NodeSelectorItem[];
  /** Grouped sections (alternative to flat nodes list) */
  sections?: NodeSelectorSection[];
  /** Data transfer type for drag-and-drop (e.g., "application/workflow-node") */
  dataTransferType: string;
  /** Whether the panel should be hidden (read-only mode or simulator mode) */
  readOnly?: boolean;
  /** Panel title (default: "Add Nodes") */
  title?: string;
}

/**
 * Renders a single item button
 */
function ItemButton({
  item,
  onDragStart,
}: {
  item: NodeSelectorItem;
  onDragStart: (event: React.DragEvent, nodeType: string) => void;
}) {
  const Icon = item.icon;
  const isDraggable = !item.onClick && !item.disabled;
  const isClickable = !!item.onClick && !item.disabled;

  return (
    <Button
      key={item.type}
      variant="outline"
      size="sm"
      className={cn(
        "justify-start",
        isDraggable && "cursor-grab active:cursor-grabbing",
        isClickable && "cursor-pointer",
        item.disabled && "opacity-50 cursor-not-allowed"
      )}
      draggable={isDraggable}
      onDragStart={isDraggable ? (e) => onDragStart(e, item.type) : undefined}
      onClick={isClickable ? item.onClick : undefined}
      disabled={item.disabled}
      title={item.disabled ? item.disabledTooltip : undefined}
      data-testid={`node-item-${item.type}`}
    >
      <Icon className={cn("mr-2 h-4 w-4", item.iconColorClass)} />
      {item.label}
    </Button>
  );
}

export function NodeSelectorPanel({
  nodes,
  sections,
  dataTransferType,
  readOnly,
  title = "Add Nodes",
}: NodeSelectorPanelProps) {
  const onDragStart = useCallback(
    (event: React.DragEvent, nodeType: string) => {
      event.dataTransfer.setData(dataTransferType, nodeType);
      event.dataTransfer.effectAllowed = "move";
    },
    [dataTransferType]
  );

  // Don't render in read-only mode
  if (readOnly) return null;

  // Convert flat nodes to a single section if sections not provided
  const effectiveSections: NodeSelectorSection[] = sections ?? (nodes ? [{ title: "", items: nodes }] : []);

  return (
    <Panel position="top-left" className="p-0" data-testid="node-selector-panel">
      <PanelSurface className="p-4 w-56">
        <h3 className="font-semibold text-sm mb-3">{title}</h3>
        <div className="flex flex-col gap-3">
          {effectiveSections.map((section, sectionIdx) => (
            <div key={section.title || sectionIdx} className="flex flex-col gap-1.5">
              {/* Section title (skip if empty - for backwards compatibility) */}
              {section.title && (
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
                  {section.title}
                </span>
              )}
              {/* Section items */}
              {section.items.map((item) => (
                <ItemButton key={item.type} item={item} onDragStart={onDragStart} />
              ))}
            </div>
          ))}
        </div>
      </PanelSurface>
    </Panel>
  );
}
