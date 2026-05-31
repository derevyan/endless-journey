/**
 * useTemplateField Hook
 *
 * Shared logic for template-enabled input fields (TemplateInput and TemplateTextarea).
 * Handles autocomplete detection, variable filtering, and value insertion.
 *
 * @module hooks/use-template-field
 */

import { useCallback, useEffect, useRef } from "react";
import { useTemplateAutocomplete, type ValidationResult, type VariableValidationError } from "./use-template-autocomplete";
import type { JourneyEdge, JourneyNode } from "@/features/nodes/journey/react-flow-types";
import type { WorkflowNode } from "@journey/schemas";
import type { AvailableVariable } from "@/shared/lib/variables/variable-resolver";

interface UseTemplateFieldProps<T extends HTMLInputElement | HTMLTextAreaElement> {
  nodeId: string;
  nodes: JourneyNode[];
  edges: JourneyEdge[];
  journeyId?: string | null;
  /** Workflow nodes for agent workflow context (extracts node outputs) */
  workflowNodes?: WorkflowNode[];
  value: string;
  onChange?: (e: React.ChangeEvent<T>) => void;
  /** Whether this is a multiline field (affects cursor detection) */
  multiline?: boolean;
  /** External ref for accessing the input element (synced with internal ref) */
  externalRef?: React.RefObject<T | null>;
}

interface UseTemplateFieldReturn<T extends HTMLInputElement | HTMLTextAreaElement> {
  /** Ref for the input/textarea element */
  inputRef: React.RefObject<T | null>;
  /** Ref for the container element */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Whether the autocomplete dropdown is open */
  open: boolean;
  /** Current search query in the autocomplete */
  query: string;
  /** Update the search query */
  setQuery: (query: string) => void;
  /** Left position for the dropdown */
  dropdownLeft: number | null;
  /** Filtered variable groups to display */
  filteredGroups: ReturnType<typeof useTemplateAutocomplete>["filteredGroups"];
  /** Flat list of all filtered variables for keyboard navigation */
  flatVariables: ReturnType<typeof useTemplateAutocomplete>["flatVariables"];
  /** Current keyboard-selected index */
  selectedIndex: number;
  /** Update the selected index */
  setSelectedIndex: (index: number) => void;
  /** Handler for when a variable is selected */
  handleSelectVariable: (variable: string) => void;
  /** Change handler to wrap the input's onChange */
  handleChange: (e: React.ChangeEvent<T>) => void;
  /** Validation result with errors for undefined variables */
  validation: ValidationResult;
  /** Apply a suggestion to fix an error */
  applySuggestion: (error: VariableValidationError, suggestion: AvailableVariable) => void;
}

/**
 * Hook that provides shared template field logic for inputs and textareas.
 *
 * @example
 * ```tsx
 * function TemplateInput({ nodeId, nodes, edges, value, onChange, ...props }) {
 *   const {
 *     inputRef, containerRef, open, query, setQuery,
 *     dropdownLeft, filteredGroups, handleSelectVariable, handleChange
 *   } = useTemplateField<HTMLInputElement>({
 *     nodeId, nodes, edges, value, onChange, multiline: false
 *   });
 *
 *   return (
 *     <div ref={containerRef}>
 *       <Input ref={inputRef} value={value} onChange={handleChange} {...props} />
 *       <TemplateVariablesDropdown
 *         open={open} query={query} onQueryChange={setQuery}
 *         dropdownLeft={dropdownLeft} filteredGroups={filteredGroups}
 *         onSelectVariable={handleSelectVariable}
 *       />
 *     </div>
 *   );
 * }
 * ```
 */
export function useTemplateField<T extends HTMLInputElement | HTMLTextAreaElement>({
  nodeId,
  nodes,
  edges,
  journeyId,
  workflowNodes,
  value,
  onChange,
  multiline = false,
  externalRef,
}: UseTemplateFieldProps<T>): UseTemplateFieldReturn<T> {
  const inputRef = useRef<T>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync internal ref with external ref when element mounts
  useEffect(() => {
    if (externalRef && inputRef.current) {
      (externalRef as React.MutableRefObject<T | null>).current = inputRef.current;
    }
    return () => {
      if (externalRef) {
        (externalRef as React.MutableRefObject<T | null>).current = null;
      }
    };
  }, [externalRef]);

  const {
    open,
    query,
    setQuery,
    dropdownLeft,
    filteredGroups,
    flatVariables,
    selectedIndex,
    setSelectedIndex,
    handleTemplateDetection,
    handleSelectVariable,
    validation,
    applySuggestion,
  } = useTemplateAutocomplete({
    nodeId,
    nodes,
    edges,
    journeyId,
    workflowNodes,
    inputRef: inputRef as React.RefObject<HTMLInputElement | HTMLTextAreaElement>,
    containerRef,
    value: value || "",
    onChange: (newValue, newCursorPos) => {
      const syntheticEvent = {
        target: { value: newValue, selectionStart: newCursorPos, selectionEnd: newCursorPos },
      } as React.ChangeEvent<T>;
      onChange?.(syntheticEvent);
    },
  });

  const handleChange = useCallback(
    (e: React.ChangeEvent<T>) => {
      const newValue = e.target.value;
      const cursorPos = e.target.selectionStart ?? 0;

      handleTemplateDetection(newValue, cursorPos, multiline);
      onChange?.(e);
    },
    [onChange, handleTemplateDetection, multiline]
  );

  return {
    inputRef,
    containerRef,
    open,
    query,
    setQuery,
    dropdownLeft,
    filteredGroups,
    flatVariables,
    selectedIndex,
    setSelectedIndex,
    handleSelectVariable,
    handleChange,
    validation,
    applySuggestion,
  };
}
