/**
 * VariableSelectorPopover Component
 *
 * Reusable popover for selecting template variables.
 * Uses Command palette with search, shared with template autocomplete.
 * Includes a preview panel showing mock data for hovered variables.
 *
 * @module components/ui/variable-selector-popover
 */

import { useState } from "react";
import { Variable } from "lucide-react";

import { Button } from "@/shared/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/shared/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { useDebouncedHover } from "@/shared/hooks";
import type { JourneyNode } from "@/features/nodes/journey/react-flow-types";
import { VariableMockPreview } from "./variable-mock-preview";

export interface SelectableVariable {
  path: string;
  /** Human-readable path for display (e.g., "nodes.Simulation_Skill_Profiling.response") */
  displayPath?: string;
  type?: "string" | "number" | "boolean" | "object" | "any";
  description?: string;
  category: string;
  /** Source node ID for node output variables */
  sourceNodeId?: string;
  /** Source node label for display */
  sourceNodeLabel?: string;
}

interface VariableSelectorPopoverProps {
  value: string;
  onChange: (value: string) => void;
  groupedVariables: Record<string, SelectableVariable[]>;
  /** Journey nodes for mock data generation */
  nodes?: JourneyNode[];
  /** Show preview panel (default: true when nodes provided) */
  showPreview?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

interface VariableGroupProps {
  heading: string;
  variables: SelectableVariable[];
  onSelect: (path: string) => void;
  onHover?: (variable: SelectableVariable | null) => void;
}

/**
 * Renders a single variable group
 */
function VariableGroup({ heading, variables, onSelect, onHover }: VariableGroupProps) {
  if (!variables || variables.length === 0) return null;

  return (
    <CommandGroup heading={heading} className="p-0.5 **:[[cmdk-group-heading]]:px-1.5 **:[[cmdk-group-heading]]:py-1 **:[[cmdk-group-heading]]:text-[10px]">
      {variables.map((v) => (
        <CommandItem
          key={v.path}
          onSelect={() => onSelect(v.path)}
          onMouseEnter={() => onHover?.(v)}
          onMouseLeave={() => onHover?.(null)}
          className="px-1.5 py-1 gap-1.5 text-xs"
        >
          <Variable className="size-3 shrink-0 opacity-60" />
          <span className="font-mono text-[11px]">{v.path}</span>
          {v.description && <span className="ml-auto text-[9px] text-muted-foreground truncate max-w-[120px]">{v.description}</span>}
        </CommandItem>
      ))}
    </CommandGroup>
  );
}

/**
 * Popover for selecting variables with search
 * Includes a preview panel showing mock data when nodes are provided
 */
export function VariableSelectorPopover({
  value,
  onChange,
  groupedVariables,
  nodes = [],
  showPreview,
  disabled = false,
  placeholder = "Select variable...",
}: VariableSelectorPopoverProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  // Debounced hover state for preview panel
  const { hoveredItem: previewVariable, handleHover, clearHover } = useDebouncedHover<SelectableVariable>();

  // Determine if preview should be shown (default: show when nodes provided)
  const shouldShowPreview = showPreview ?? nodes.length > 0;

  // Filter variables by search query
  const filterVariables = (vars: SelectableVariable[]) => {
    if (!query) return vars;
    const lowerQuery = query.toLowerCase();
    return vars.filter((v) => v.path.toLowerCase().includes(lowerQuery) || v.description?.toLowerCase().includes(lowerQuery));
  };

  const handleSelect = (path: string) => {
    onChange(path);
    setOpen(false);
    setQuery("");
    clearHover();
  };

  const buttonContent = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="w-full max-w-full justify-start font-mono text-xs h-8 gap-2 overflow-hidden min-w-0"
      disabled={disabled}
    >
      <Variable className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <span className="truncate min-w-0 flex-1 text-left">{value || placeholder}</span>
    </Button>
  );

  const triggerButton = value ? (
    <Tooltip>
      <TooltipTrigger asChild>
        <PopoverTrigger asChild>{buttonContent}</PopoverTrigger>
      </TooltipTrigger>
      <TooltipContent>
        <span className="font-mono text-xs">{value}</span>
      </TooltipContent>
    </Tooltip>
  ) : (
    <PopoverTrigger asChild>{buttonContent}</PopoverTrigger>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {triggerButton}
      <PopoverContent className={shouldShowPreview ? "w-[480px] p-0" : "w-[320px] p-0"} align="start">
        <div className={shouldShowPreview ? "flex h-[400px]" : ""}>
          {/* Variable List */}
          <Command shouldFilter={false} className={`rounded-md border-none bg-transparent ${shouldShowPreview ? "w-[280px] border-r" : "w-full"}`}>
            <CommandInput placeholder="Search variables..." value={query} onValueChange={setQuery} className="h-8 text-xs" />
            <CommandList className={shouldShowPreview ? "max-h-[360px]" : "max-h-[300px]"}>
              <CommandEmpty className="py-3 text-xs">No variables found.</CommandEmpty>

              <VariableGroup heading="Response" variables={filterVariables(groupedVariables.builtin || [])} onSelect={handleSelect} onHover={handleHover} />
              <VariableGroup heading="User" variables={filterVariables(groupedVariables.user || [])} onSelect={handleSelect} onHover={handleHover} />
              <VariableGroup heading="Session" variables={filterVariables(groupedVariables.session || [])} onSelect={handleSelect} onHover={handleHover} />
              <VariableGroup heading="Variables" variables={filterVariables(groupedVariables.vars || [])} onSelect={handleSelect} onHover={handleHover} />
              <VariableGroup heading="Mindstate" variables={filterVariables(groupedVariables.mindstate || [])} onSelect={handleSelect} onHover={handleHover} />
              <VariableGroup heading="Node Outputs" variables={filterVariables(groupedVariables.nodes || [])} onSelect={handleSelect} onHover={handleHover} />
              <VariableGroup heading="From Messages" variables={filterVariables(groupedVariables.message || [])} onSelect={handleSelect} onHover={handleHover} />
              <VariableGroup heading="From Webhooks" variables={filterVariables(groupedVariables.webhook || [])} onSelect={handleSelect} onHover={handleHover} />
            </CommandList>
          </Command>

          {/* Preview Panel */}
          {shouldShowPreview && (
            <div className="flex-1 border-l bg-muted/10">
              <VariableMockPreview variable={previewVariable} nodes={nodes} className="h-full" />
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
