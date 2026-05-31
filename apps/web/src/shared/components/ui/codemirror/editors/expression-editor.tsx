/**
 * ExpressionEditor Component
 *
 * CodeMirror-based editor for JEXL expressions with:
 * - Syntax highlighting for operators, functions, variables
 * - Template variable autocomplete (type {{ to trigger)
 * - Bracket matching
 * - Light/dark theme support
 *
 * @module components/ui/codemirror/editors/expression-editor
 */

import { Extension } from "@codemirror/state";
import { memo, useCallback, useMemo, useState } from "react";

import { useTemplateContext } from "@/shared/components/ui/template-context";
import { TemplateVariablesDropdown, type VariableWithMatch } from "@/shared/components/ui/template-variables-dropdown";
import { cn } from "@/shared/lib/utils";
import { useTemplateVariables } from "@/features/nodes/journey/hooks/forms/use-template-variables";
import { DROPDOWN_WIDTH_WITH_PREVIEW, DROPDOWN_HEIGHT } from "@/features/nodes/journey/hooks/forms/use-template-autocomplete";
import { fuzzyFilter } from "@/shared/lib/fuzzy-match";

// =============================================================================
// SMART POSITIONING
// =============================================================================

/**
 * Calculate dropdown position that keeps it within viewport bounds
 */
function calculateSmartPosition(
  triggerX: number,
  triggerY: number,
  dropdownWidth: number,
  dropdownHeight: number
): { x: number; y: number } {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const padding = 8;

  let x = triggerX;
  let y = triggerY;

  // Shift left if going beyond right edge
  if (x + dropdownWidth > viewportWidth - padding) {
    x = Math.max(padding, viewportWidth - dropdownWidth - padding);
  }

  // Flip above if going beyond bottom edge
  if (y + dropdownHeight > viewportHeight - padding) {
    y = Math.max(padding, triggerY - dropdownHeight - 8);
  }

  return { x, y };
}

import { createVariableTriggerExtension, type VariableTriggerInfo } from "../extensions/variable-autocomplete";
import { jexlLanguage } from "../languages/jexl";
import { useCodeMirror } from "../use-codemirror";

// =============================================================================
// TYPES
// =============================================================================

export interface ExpressionEditorProps {
  /** Current expression value */
  value: string;
  /** Callback when value changes */
  onChange: (value: string) => void;
  /** Placeholder text when empty */
  placeholder?: string;
  /** Minimum height in pixels */
  minHeight?: number;
  /** Maximum height in pixels */
  maxHeight?: number;
  /** Disable editing */
  disabled?: boolean;
  /** Show error styling (red border) */
  hasError?: boolean;
  /** Additional CSS classes for the container */
  className?: string;
  /** Called when editor is focused */
  onFocus?: () => void;
  /** Called when editor loses focus */
  onBlur?: () => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

/** Dropdown state for variable autocomplete */
interface DropdownState {
  open: boolean;
  x: number;
  y: number;
  queryFrom: number;
  cursorPos: number;
  query: string;
  selectedIndex: number;
}

const initialDropdownState: DropdownState = {
  open: false,
  x: 0,
  y: 0,
  queryFrom: 0,
  cursorPos: 0,
  query: "",
  selectedIndex: 0,
};

/**
 * Expression editor with JEXL syntax highlighting and variable autocomplete.
 *
 * Must be used within a TemplateProvider for variable autocomplete to work.
 * Type {{ to trigger the variable autocomplete dropdown.
 *
 * @example
 * ```tsx
 * <TemplateProvider nodeId={nodeId} nodes={nodes} edges={edges} journeyId={journeyId}>
 *   <ExpressionEditor
 *     value={expression}
 *     onChange={setExpression}
 *     placeholder="e.g., user.score > 50 && session.tags.includes('vip')"
 *     hasError={!isValid}
 *   />
 * </TemplateProvider>
 * ```
 */
export const ExpressionEditor = memo(function ExpressionEditor({
  value,
  onChange,
  placeholder = "",
  minHeight = 80,
  maxHeight,
  disabled = false,
  hasError = false,
  className,
  onFocus,
  onBlur,
}: ExpressionEditorProps) {
  // Get variables from context for autocomplete
  const { nodeId, nodes, edges, journeyId } = useTemplateContext();
  const { variables } = useTemplateVariables({ nodeId, nodes, edges, journeyId });

  // Dropdown state
  const [dropdownState, setDropdownState] = useState<DropdownState>(initialDropdownState);

  // Handle trigger callback from CodeMirror extension
  const handleTrigger = useCallback((info: VariableTriggerInfo | null) => {
    if (info) {
      // Calculate smart position that stays within viewport
      const smartPos = calculateSmartPosition(info.x, info.y, DROPDOWN_WIDTH_WITH_PREVIEW, DROPDOWN_HEIGHT);
      setDropdownState({
        open: true,
        x: smartPos.x,
        y: smartPos.y,
        queryFrom: info.queryFrom,
        cursorPos: info.cursorPos,
        query: info.query,
        selectedIndex: 0,
      });
    } else {
      setDropdownState((prev) => (prev.open ? { ...initialDropdownState } : prev));
    }
  }, []);

  // Create trigger extension
  const triggerExtension = useMemo<Extension>(
    () => createVariableTriggerExtension(handleTrigger),
    [handleTrigger]
  );

  // Memoize the JEXL language to avoid recreation
  const language = useMemo(() => jexlLanguage(), []);

  // Initialize CodeMirror
  const { containerRef, viewRef } = useCodeMirror({
    value,
    onChange,
    language,
    extensions: [triggerExtension],
    placeholder,
    readOnly: disabled,
    minHeight,
    maxHeight,
    onFocus,
    onBlur,
  });

  // Filter variables based on dropdown query using fuzzy matching
  const filteredVariables = useMemo(() => {
    return fuzzyFilter(dropdownState.query, variables, (v) => v.path);
  }, [variables, dropdownState.query]);

  const filteredGroups = useMemo(() => {
    const groups: Record<string, VariableWithMatch[]> = {};
    for (const variable of filteredVariables) {
      if (!groups[variable.category]) {
        groups[variable.category] = [];
      }
      groups[variable.category].push(variable);
    }
    return groups;
  }, [filteredVariables]);

  // Flat list for keyboard navigation
  const flatVariables = useMemo(() => {
    const categoryOrder = ["builtin", "user", "session", "vars", "mindstate", "nodes", "message", "webhook"];
    const result: VariableWithMatch[] = [];
    for (const category of categoryOrder) {
      const group = filteredGroups[category];
      if (group) {
        result.push(...group);
      }
    }
    return result;
  }, [filteredGroups]);

  // Handle variable selection from dropdown
  const handleSelectVariable = useCallback(
    (variablePath: string) => {
      const view = viewRef.current;
      if (!view) return;

      // Replace from {{ to cursor with {{variable}}
      const insertFrom = dropdownState.queryFrom - 2; // -2 for {{
      const insertText = `{{${variablePath}}}`;

      view.dispatch({
        changes: { from: insertFrom, to: dropdownState.cursorPos, insert: insertText },
        selection: { anchor: insertFrom + insertText.length },
      });

      // Close dropdown and focus editor
      setDropdownState(initialDropdownState);
      view.focus();
    },
    [viewRef, dropdownState.queryFrom, dropdownState.cursorPos]
  );

  // Handle query change from dropdown search input
  const handleQueryChange = useCallback((newQuery: string) => {
    setDropdownState((prev) => ({ ...prev, query: newQuery, selectedIndex: 0 }));
  }, []);

  // Handle selected index change from dropdown
  const handleSelectedIndexChange = useCallback((index: number) => {
    setDropdownState((prev) => ({ ...prev, selectedIndex: index }));
  }, []);

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className={cn(
          // Base styles
          "rounded-md border bg-background shadow-xs",
          // Resize support
          "resize-y overflow-auto",
          // Error state
          hasError && "border-destructive",
          // Disabled state
          disabled && "opacity-50 cursor-not-allowed",
          className
        )}
        style={{ minHeight }}
      />

      {/* Custom variable dropdown */}
      {dropdownState.open && (
        <div
          className="fixed z-50"
          style={{
            left: dropdownState.x,
            top: dropdownState.y,
          }}
        >
          <TemplateVariablesDropdown
            open={true}
            query={dropdownState.query}
            onQueryChange={handleQueryChange}
            dropdownLeft={null}
            filteredGroups={filteredGroups}
            flatVariables={flatVariables}
            selectedIndex={dropdownState.selectedIndex}
            onSelectedIndexChange={handleSelectedIndexChange}
            onSelectVariable={handleSelectVariable}
            nodes={nodes}
            maxHeight={320}
          />
        </div>
      )}
    </div>
  );
});
