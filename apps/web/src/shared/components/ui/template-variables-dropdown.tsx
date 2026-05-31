/**
 * TemplateVariablesDropdown Component
 *
 * Shared dropdown component for template variable autocomplete.
 * Displays categorized variable suggestions in a Command palette.
 * Includes a preview panel showing mock data for hovered variables.
 *
 * @module components/ui/template-variables-dropdown
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, Variable } from "lucide-react";

import { Button } from "@/shared/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/shared/components/ui/command";
import type { ValidationResult, VariableValidationError } from "@/shared/lib/variables/variable-validator";
import type { AvailableVariable } from "@/shared/lib/variables/variable-resolver";
import { useDebouncedHover } from "@/shared/hooks";
import { DROPDOWN_WIDTH, DROPDOWN_WIDTH_WITH_PREVIEW } from "@/features/nodes/journey/hooks/forms/use-template-autocomplete";
import type { JourneyNode } from "@/features/nodes/journey/react-flow-types";
import type { SelectableVariable } from "./variable-selector-popover";
import { VariableMockPreview } from "./variable-mock-preview";
import type { FuzzyMatchResult } from "@/shared/lib/fuzzy-match";

/** Variable with fuzzy match result attached */
export type VariableWithMatch = SelectableVariable & { matchResult?: FuzzyMatchResult };

interface TemplateVariablesDropdownProps {
  open: boolean;
  query: string;
  onQueryChange: (query: string) => void;
  dropdownLeft: number | null;
  filteredGroups: Record<string, VariableWithMatch[]>;
  onSelectVariable: (variablePath: string) => void;
  /** Journey nodes for mock data generation */
  nodes?: JourneyNode[];
  maxHeight?: number;
  /** Container ref for calculating fixed position (enables portal rendering) */
  containerRef?: React.RefObject<HTMLElement | null>;
  /** Current keyboard-selected index for navigation */
  selectedIndex?: number;
  /** Callback when selection changes (for mouse hover) */
  onSelectedIndexChange?: (index: number) => void;
  /** Flat list of all variables for keyboard navigation */
  flatVariables?: VariableWithMatch[];
  /** Validation result with errors */
  validation?: ValidationResult;
  /** Callback to apply a suggestion fix */
  onApplySuggestion?: (error: VariableValidationError, suggestion: AvailableVariable) => void;
}

interface VariableGroupProps {
  heading: string;
  variables: VariableWithMatch[];
  onSelect: (path: string) => void;
  onHover?: (variable: VariableWithMatch) => void;
  /** Callback when mouse enters an item (for selection sync) */
  onMouseSelect?: (variable: VariableWithMatch) => void;
}

/**
 * Highlights matched characters in a path
 * For nested node paths (nodes.NodeName.property), shows abbreviated form: {{.property}}
 */
function HighlightedPath({ path, matches }: { path: string; matches?: number[] }) {
  // Detect nested node paths (nodes.NodeName.property or deeper)
  const parts = path.split(".");
  const isNestedNodePath = path.startsWith("nodes.") && parts.length > 2;

  // For nested paths, show only the property portion with leading dot
  // e.g., "nodes.Welcome.message" → ".message"
  let displayPath = path;
  let prefixLength = 0;

  if (isNestedNodePath) {
    // Skip "nodes.NodeName" portion, keep ".property.subproperty..."
    prefixLength = parts[0].length + 1 + parts[1].length; // "nodes" + "." + "NodeName"
    displayPath = path.slice(prefixLength); // ".property" or ".property.sub"
  }

  // Adjust match indices for abbreviated display
  // Original matches are relative to full path, shift them for display path
  const adjustedMatches =
    isNestedNodePath && matches ? matches.filter((i) => i >= prefixLength).map((i) => i - prefixLength) : matches;

  const matchSet = new Set(adjustedMatches ?? []);

  // Render path characters with highlighting
  const pathContent =
    matchSet.size === 0 ? (
      `{{${displayPath}}}`
    ) : (
      <>
        {"{{"}
        {displayPath.split("").map((char, i) =>
          matchSet.has(i) ? (
            <span key={i} className="text-primary font-bold">
              {char}
            </span>
          ) : (
            char
          )
        )}
        {"}}"}
      </>
    );

  // Show nesting indicator for nested node paths
  return (
    <span className="inline-flex items-center gap-0.5">
      {isNestedNodePath && <span className="text-sky-500 text-[9px]">↳</span>}
      <span>{pathContent}</span>
    </span>
  );
}

/**
 * Renders a single variable group
 * Note: Selection styling is handled by cmdk via data-[selected=true] attribute
 */
function VariableGroup({ heading, variables, onSelect, onHover, onMouseSelect }: VariableGroupProps) {
  if (!variables || variables.length === 0) return null;

  return (
    <CommandGroup heading={heading} className="p-0.5 **:[[cmdk-group-heading]]:px-1.5 **:[[cmdk-group-heading]]:py-1 **:[[cmdk-group-heading]]:text-[10px]">
      {variables.map((v) => (
        <CommandItem
          key={v.path}
          value={v.path}
          onSelect={() => onSelect(v.path)}
          onMouseEnter={() => {
            onHover?.(v);
            onMouseSelect?.(v);
          }}
          className="px-1.5 py-1 gap-1.5 text-xs"
        >
          <Variable className="size-3 shrink-0 opacity-60" />
          <span className="font-mono text-[11px] truncate flex-1 min-w-0">
            <HighlightedPath path={v.displayPath ?? v.path} matches={v.matchResult?.matches} />
          </span>
          {v.description && <span className="text-[9px] text-muted-foreground truncate max-w-[80px] shrink-0">{v.description}</span>}
        </CommandItem>
      ))}
    </CommandGroup>
  );
}

/**
 * Dropdown for template variable autocomplete
 * Includes a preview panel showing mock data when nodes are provided
 */
export function TemplateVariablesDropdown({
  open,
  query,
  onQueryChange,
  dropdownLeft,
  filteredGroups,
  onSelectVariable,
  nodes = [],
  maxHeight = 280,
  containerRef,
  selectedIndex = -1,
  onSelectedIndexChange,
  flatVariables = [],
  validation,
  onApplySuggestion,
}: TemplateVariablesDropdownProps) {
  // Debounced hover state - preview persists until new variable hovered
  const { hoveredItem: previewVariable, handleHover } = useDebouncedHover<SelectableVariable>({ persistOnLeave: true });

  // Smart positioning: ref and transform state
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [transformX, setTransformX] = useState(0);
  const [fixedPosition, setFixedPosition] = useState<{ left: number; top: number } | null>(null);

  // Get currently selected variable path for highlighting
  // selectedIndex of -1 means no selection (user hasn't navigated with keyboard yet)
  const selectedPath = selectedIndex >= 0 ? flatVariables[selectedIndex]?.path : undefined;

  // Handle mouse selection - sync with keyboard selection
  const handleMouseSelect = (variable: VariableWithMatch) => {
    const index = flatVariables.findIndex((v) => v.path === variable.path);
    if (index !== -1 && onSelectedIndexChange) {
      onSelectedIndexChange(index);
    }
  };

  // Sync keyboard selection with preview panel
  useEffect(() => {
    if (!open || flatVariables.length === 0 || selectedIndex < 0) return;

    const selectedVariable = flatVariables[selectedIndex];
    if (selectedVariable) {
      handleHover(selectedVariable);
    }
  }, [open, selectedIndex, flatVariables, handleHover]);

  // Scroll selected item into view when selection changes
  useEffect(() => {
    if (!open || selectedIndex < 0) return;

    // Small delay to ensure DOM is updated with the new selection
    setTimeout(() => {
      const selected = document.querySelector('[data-template-dropdown="true"] [data-selected="true"]');
      selected?.scrollIntoView({ block: "nearest" });
    }, 0);
  }, [open, selectedIndex]);

  // Determine if preview should be shown (when nodes provided)
  const shouldShowPreview = nodes.length > 0;

  // Calculate width based on preview visibility
  const dropdownWidth = shouldShowPreview ? DROPDOWN_WIDTH_WITH_PREVIEW : DROPDOWN_WIDTH;
  const listWidth = shouldShowPreview ? 360 : DROPDOWN_WIDTH;

  // Calculate fixed position from container (for portal rendering)
  // Pre-adjust to avoid overflow on initial render
  useLayoutEffect(() => {
    if (!open || !containerRef?.current) {
      setFixedPosition(null);
      return;
    }

    const containerRect = containerRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const padding = 12;

    // Initial position
    let left = containerRect.left + (dropdownLeft ?? 0);

    // Pre-calculate if we'd overflow and adjust
    const projectedRight = left + dropdownWidth;
    if (projectedRight > viewportWidth - padding) {
      // Shift left to fit, but don't go past left edge
      const overflow = projectedRight - (viewportWidth - padding);
      left = Math.max(padding, left - overflow);
    }

    setFixedPosition({
      left,
      top: containerRect.bottom + 4, // 4px gap below container
    });
  }, [open, containerRef, dropdownLeft, dropdownWidth]);

  // Smart positioning: ensure dropdown fits within viewport
  useLayoutEffect(() => {
    if (!open || !dropdownRef.current) {
      setTransformX(0);
      return;
    }

    const rect = dropdownRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const padding = 12;

    // Calculate overflow on right side
    const rightOverflow = rect.right - (viewportWidth - padding);

    if (rightOverflow > 0) {
      // Need to shift left - ensure we don't go past left edge
      const maxShift = rect.left - padding;
      const neededShift = Math.min(rightOverflow, maxShift);
      setTransformX(-neededShift);
    } else {
      setTransformX(0);
    }
  }, [open, dropdownLeft, shouldShowPreview, fixedPosition]);

  if (!open) return null;

  // Use fixed positioning when containerRef provided (portal mode), otherwise absolute
  const usePortal = containerRef && fixedPosition;
  const positionStyle = usePortal
    ? { left: fixedPosition.left, top: fixedPosition.top, width: dropdownWidth }
    : dropdownLeft !== null
      ? { left: dropdownLeft, width: dropdownWidth }
      : { width: dropdownWidth };

  const dropdownContent = (
    <div
      ref={dropdownRef}
      data-template-dropdown="true"
      className={`${usePortal ? "fixed" : "absolute mt-1"} z-[100] rounded-md border bg-background/95 shadow-lg backdrop-blur-sm`}
      style={{
        ...positionStyle,
        transform: transformX !== 0 ? `translateX(${transformX}px)` : undefined,
      }}
    >
      <div className={shouldShowPreview ? "flex h-[360px]" : ""}>
        {/* Variable List */}
        <Command
          shouldFilter={false}
          value={selectedPath ?? ""}
          onValueChange={(newValue) => {
            // Sync cmdk's selection with our state (for preview panel)
            const index = flatVariables.findIndex((v) => v.path === newValue);
            if (index !== -1) {
              onSelectedIndexChange?.(index);
              // Also update preview
              handleHover(flatVariables[index]);
            }
          }}
          className="rounded-md border-none bg-transparent **:data-[slot=command-input-wrapper]:h-7 **:data-[slot=command-input-wrapper]:px-2 [&_[data-slot=command-input-wrapper]_svg]:size-3"
          style={{ width: listWidth }}
        >
          <CommandInput placeholder="Search..." value={query} onValueChange={onQueryChange} className="h-7 text-xs" />
          <CommandList className="scroll-py-0.5" style={{ maxHeight: shouldShowPreview ? 320 : maxHeight }}>
            {/* Validation Errors Section */}
            {validation && validation.errors.length > 0 && (
              <div className="border-b border-destructive/20 bg-destructive/5 px-2 py-1.5">
                {validation.errors.map((error, idx) => (
                  <div key={`${error.path}-${idx}`} className="text-xs text-destructive flex items-center gap-1.5 py-0.5">
                    <AlertCircle className="size-3 shrink-0" />
                    <span className="truncate flex-1 min-w-0">{error.message}</span>
                    {error.suggestions[0] && onApplySuggestion && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 px-1.5 text-[10px] text-primary hover:text-primary/80 shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          onApplySuggestion(error, error.suggestions[0]);
                        }}
                      >
                        Use {error.suggestions[0].path}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <CommandEmpty className="h-[200px] flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <Variable className="size-6 opacity-40" />
              <span className="text-xs">No variables found.</span>
            </CommandEmpty>

            <VariableGroup heading="Response" variables={filteredGroups.builtin || []} onSelect={onSelectVariable} onHover={handleHover} onMouseSelect={handleMouseSelect} />
            <VariableGroup heading="User" variables={filteredGroups.user || []} onSelect={onSelectVariable} onHover={handleHover} onMouseSelect={handleMouseSelect} />
            <VariableGroup heading="Session" variables={filteredGroups.session || []} onSelect={onSelectVariable} onHover={handleHover} onMouseSelect={handleMouseSelect} />
            <VariableGroup heading="Variables" variables={filteredGroups.vars || []} onSelect={onSelectVariable} onHover={handleHover} onMouseSelect={handleMouseSelect} />
            <VariableGroup heading="Mindstate" variables={filteredGroups.mindstate || []} onSelect={onSelectVariable} onHover={handleHover} onMouseSelect={handleMouseSelect} />
            <VariableGroup heading="Node Outputs" variables={filteredGroups.nodes || []} onSelect={onSelectVariable} onHover={handleHover} onMouseSelect={handleMouseSelect} />
            <VariableGroup heading="From Messages" variables={filteredGroups.message || []} onSelect={onSelectVariable} onHover={handleHover} onMouseSelect={handleMouseSelect} />
            <VariableGroup heading="From Webhooks" variables={filteredGroups.webhook || []} onSelect={onSelectVariable} onHover={handleHover} onMouseSelect={handleMouseSelect} />
          </CommandList>
        </Command>

        {/* Preview Panel */}
        {shouldShowPreview && (
          <div className="flex-1 border-l bg-muted/10">
            <VariableMockPreview variable={previewVariable} nodes={nodes} className="h-full" />
          </div>
        )}
      </div>
    </div>
  );

  // Portal to body when containerRef provided (to escape overflow:hidden)
  return usePortal ? createPortal(dropdownContent, document.body) : dropdownContent;
}
