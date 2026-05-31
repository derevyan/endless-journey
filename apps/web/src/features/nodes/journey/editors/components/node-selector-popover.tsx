/**
 * NodeSelectorPopover Component
 *
 * Reusable popover for selecting journey nodes with search and grouping.
 * Based on VariableSelectorPopover pattern for consistent UX.
 *
 * @module features/nodes/journey/editors/components/node-selector-popover
 */

import { Button } from "@/shared/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/shared/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { cn } from "@/shared/lib/utils";
import { GitBranch } from "lucide-react";
import { useMemo, useState } from "react";

// ============================================================================
// Types
// ============================================================================

export interface SelectableNode {
  id: string;
  label: string;
  type: string;
}

interface NodeSelectorPopoverProps {
  value: string;
  onChange: (nodeId: string) => void;
  nodes: SelectableNode[];
  disabled?: boolean;
  placeholder?: string;
  /** Allow selecting "none" for optional fields */
  allowNone?: boolean;
  /** Label for the "none" option */
  noneLabel?: string;
  /** Additional className for the trigger button */
  className?: string;
}

// ============================================================================
// Node Type Icons/Colors
// ============================================================================

const NODE_TYPE_STYLES: Record<string, string> = {
  message: "text-blue-500",
  condition: "text-amber-500",
  wait: "text-purple-500",
  webhook: "text-green-500",
  start: "text-emerald-500",
  end: "text-rose-500",
  crm: "text-indigo-500",
  questionnaire: "text-cyan-500",
};

// ============================================================================
// Sub-components
// ============================================================================

interface NodeGroupProps {
  heading: string;
  nodes: SelectableNode[];
  onSelect: (id: string) => void;
}

function NodeGroup({ heading, nodes, onSelect }: NodeGroupProps) {
  if (!nodes || nodes.length === 0) return null;

  return (
    <CommandGroup heading={heading} className="p-0.5 **:[[cmdk-group-heading]]:px-1.5 **:[[cmdk-group-heading]]:py-1 **:[[cmdk-group-heading]]:text-[10px]">
      {nodes.map((node) => (
        <CommandItem key={node.id} value={node.id} onSelect={() => onSelect(node.id)} className="px-1.5 py-1.5 gap-2 text-xs cursor-pointer">
          <span className={cn("text-[10px] font-medium uppercase shrink-0", NODE_TYPE_STYLES[node.type] || "text-muted-foreground")}>{node.type}</span>
          <span className="truncate">{node.label}</span>
        </CommandItem>
      ))}
    </CommandGroup>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * Popover for selecting journey nodes with search
 *
 * @example
 * ```tsx
 * <NodeSelectorPopover
 *   value={targetNodeId}
 *   onChange={(id) => setTargetNodeId(id)}
 *   nodes={availableNodes}
 *   placeholder="Select target node..."
 *   allowNone
 *   noneLabel="No exit path"
 * />
 * ```
 */
export function NodeSelectorPopover({
  value,
  onChange,
  nodes,
  disabled = false,
  placeholder = "Select node...",
  allowNone = false,
  noneLabel = "None",
  className,
}: NodeSelectorPopoverProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  // Find selected node for display
  const selectedNode = useMemo(() => nodes.find((n) => n.id === value), [nodes, value]);

  // Filter nodes by search query
  const filteredNodes = useMemo(() => {
    if (!query) return nodes;
    const lowerQuery = query.toLowerCase();
    return nodes.filter((n) => n.label.toLowerCase().includes(lowerQuery) || n.type.toLowerCase().includes(lowerQuery));
  }, [nodes, query]);

  // Group nodes by type
  const groupedNodes = useMemo(() => {
    const groups: Record<string, SelectableNode[]> = {};
    for (const node of filteredNodes) {
      const type = node.type || "other";
      if (!groups[type]) groups[type] = [];
      groups[type].push(node);
    }
    return groups;
  }, [filteredNodes]);

  // Get ordered group names (common types first)
  const orderedTypes = useMemo(() => {
    const priority = ["message", "condition", "wait", "webhook", "crm", "end"];
    const types = Object.keys(groupedNodes);
    return types.sort((a, b) => {
      const aIdx = priority.indexOf(a);
      const bIdx = priority.indexOf(b);
      if (aIdx === -1 && bIdx === -1) return a.localeCompare(b);
      if (aIdx === -1) return 1;
      if (bIdx === -1) return -1;
      return aIdx - bIdx;
    });
  }, [groupedNodes]);

  const handleSelect = (nodeId: string) => {
    onChange(nodeId);
    setOpen(false);
    setQuery("");
  };

  const handleSelectNone = () => {
    onChange("");
    setOpen(false);
    setQuery("");
  };

  // Capitalize first letter for group heading
  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  const buttonContent = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn("w-full max-w-full justify-start text-xs h-8 gap-2 overflow-hidden min-w-0", className)}
      disabled={disabled}
    >
      <GitBranch className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      {selectedNode ? (
        <>
          <span className={cn("text-[10px] font-medium uppercase shrink-0", NODE_TYPE_STYLES[selectedNode.type] || "text-muted-foreground")}>
            {selectedNode.type}
          </span>
          <span className="truncate min-w-0 flex-1 text-left">{selectedNode.label}</span>
        </>
      ) : (
        <span className="truncate min-w-0 flex-1 text-left text-muted-foreground">{placeholder}</span>
      )}
    </Button>
  );

  const triggerButton = selectedNode ? (
    <Tooltip>
      <TooltipTrigger asChild>
        <PopoverTrigger asChild>{buttonContent}</PopoverTrigger>
      </TooltipTrigger>
      <TooltipContent>
        <span className="text-xs">
          {selectedNode.type}: {selectedNode.label}
        </span>
      </TooltipContent>
    </Tooltip>
  ) : (
    <PopoverTrigger asChild>{buttonContent}</PopoverTrigger>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {triggerButton}
      <PopoverContent className="w-[280px] p-0" align="start">
        <Command shouldFilter={false} className="rounded-md border-none bg-transparent">
          <CommandInput placeholder="Search nodes..." value={query} onValueChange={setQuery} className="h-8 text-xs" />
          <CommandList className="max-h-[300px]">
            <CommandEmpty className="py-3 text-xs text-center text-muted-foreground">No nodes found.</CommandEmpty>

            {/* None option for optional selections */}
            {allowNone && (
              <CommandItem value="__none__" onSelect={handleSelectNone} className="px-1.5 py-1.5 gap-2 text-xs cursor-pointer text-muted-foreground">
                {noneLabel}
              </CommandItem>
            )}

            {/* Grouped nodes */}
            {orderedTypes.map((type) => (
              <NodeGroup key={type} heading={capitalize(type)} nodes={groupedNodes[type]} onSelect={handleSelect} />
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
