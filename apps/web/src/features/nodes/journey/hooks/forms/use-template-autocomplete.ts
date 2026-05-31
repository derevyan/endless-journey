/**
 * useTemplateAutocomplete Hook
 *
 * Shared autocomplete logic for template input components.
 * Handles state management, variable filtering, dropdown positioning,
 * and keyboard/mouse interactions.
 *
 * @module hooks/use-template-autocomplete
 */

import type { RefObject } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useTemplateVariables } from "./use-template-variables";
import type { JourneyEdge, JourneyNode } from "@/features/nodes/journey/react-flow-types";
import type { WorkflowNode } from "@journey/schemas";
import { fuzzyFilter } from "@/shared/lib/fuzzy-match";
import {
  validateTemplate,
  type ValidationResult,
  type VariableValidationError,
} from "@/shared/lib/variables/variable-validator";
import type { AvailableVariable } from "@/shared/lib/variables/variable-resolver";

/** Dropdown width in pixels (without preview) */
export const DROPDOWN_WIDTH = 360;

/** Dropdown width with preview panel in pixels */
export const DROPDOWN_WIDTH_WITH_PREVIEW = 600;

/** Dropdown height in pixels (fixed for smart positioning) */
export const DROPDOWN_HEIGHT = 360;

interface UseTemplateAutocompleteOptions {
  nodeId: string;
  nodes: JourneyNode[];
  edges: JourneyEdge[];
  journeyId?: string | null;
  /** Workflow nodes for agent workflow context (extracts node outputs) */
  workflowNodes?: WorkflowNode[];
  inputRef: RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
  containerRef: RefObject<HTMLDivElement | null>;
  value: string;
  onChange?: (value: string, cursorPos: number) => void;
}

/**
 * Extract the query from template expression
 * Example: "Hello {{nodes." -> "nodes."
 * Example: "{{user" -> "user"
 */
export function extractTemplateQuery(text: string, cursorPosition: number): { query: string; startPos: number } | null {
  // Find the last `{{` before cursor
  let startPos = cursorPosition - 1;
  while (startPos >= 1 && text[startPos] !== "{") {
    startPos--;
  }

  // Check if we found opening `{{` (not closing `}}`)
  if (startPos < 1 || text[startPos] !== "{" || text[startPos - 1] !== "{") {
    return null;
  }

  // Check if there's a closing `}}` between `{{` and cursor (template already closed)
  const templateStart = startPos - 1;
  const textAfterStart = text.slice(templateStart + 2, cursorPosition);
  if (textAfterStart.includes("}}")) {
    return null; // Template already closed
  }

  // Extract query between `{{` and cursor
  const queryStart = templateStart + 2;
  const query = text.slice(queryStart, cursorPosition);

  return { query, startPos: queryStart };
}

/**
 * Measure text width using canvas for accurate cursor positioning
 */
export function measureTextWidth(text: string, font: string): number {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return 0;
  ctx.font = font;
  return ctx.measureText(text).width;
}

/**
 * Get computed font from element
 */
export function getComputedFont(element: HTMLElement): string {
  const style = window.getComputedStyle(element);
  return `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
}

/**
 * Hook providing shared autocomplete logic for template inputs
 */
export function useTemplateAutocomplete({ nodeId, nodes, edges, journeyId, workflowNodes, inputRef, containerRef, value, onChange }: UseTemplateAutocompleteOptions) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [insertPosition, setInsertPosition] = useState<number | null>(null);
  const [dropdownLeft, setDropdownLeft] = useState<number | null>(null);

  const { variables } = useTemplateVariables({ nodeId, nodes, edges, journeyId, workflowNodes });

  // Keyboard navigation state (-1 means no selection, user hasn't navigated yet)
  const [selectedIndex, setSelectedIndex] = useState(-1);

  // Filter variables using fuzzy matching (search both displayPath and path)
  const filteredVariables = useMemo(() => {
    return fuzzyFilter(query, variables, (v) => {
      // For variables with displayPath, match against both (user sees displayPath but path is used internally)
      return v.displayPath ? `${v.displayPath} ${v.path}` : v.path;
    });
  }, [variables, query]);

  // Group filtered variables (with match results preserved)
  const filteredGroups = useMemo(() => {
    const groups: Record<string, typeof filteredVariables> = {};
    for (const variable of filteredVariables) {
      if (!groups[variable.category]) {
        groups[variable.category] = [];
      }
      groups[variable.category].push(variable);
    }
    return groups;
  }, [filteredVariables]);

  // Flat list of all variables for keyboard navigation (preserves group order)
  const flatVariables = useMemo(() => {
    const categoryOrder = ["builtin", "user", "session", "vars", "mindstate", "nodes", "message", "webhook"];
    const result: typeof filteredVariables = [];
    for (const category of categoryOrder) {
      const group = filteredGroups[category];
      if (group) {
        result.push(...group);
      }
    }
    return result;
  }, [filteredGroups]);

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(-1);
  }, [query]);

  // Reset selection when dropdown closes
  useEffect(() => {
    if (!open) {
      setSelectedIndex(-1);
    }
  }, [open]);

  // Close dropdown and reset state
  const closeDropdown = useCallback(() => {
    setOpen(false);
    setQuery("");
    setInsertPosition(null);
    setDropdownLeft(null);
  }, []);

  // Calculate dropdown left position
  const calculateDropdownPosition = useCallback(
    (textBeforeCursor: string, isMultiline: boolean) => {
      const element = inputRef.current;
      if (!element) return;

      const font = getComputedFont(element);
      const style = window.getComputedStyle(element);
      const paddingLeft = parseFloat(style.paddingLeft) || 0;

      // For multiline, get text from last newline
      let measureText = textBeforeCursor;
      if (isMultiline) {
        const lastNewline = textBeforeCursor.lastIndexOf("\n");
        measureText = lastNewline === -1 ? textBeforeCursor : textBeforeCursor.slice(lastNewline + 1);
      }

      const textWidth = measureTextWidth(measureText, font);
      const leftOffset = paddingLeft + textWidth;

      // Clamp to container bounds
      const containerWidth = containerRef.current?.offsetWidth || 300;
      const maxLeft = Math.max(0, containerWidth - DROPDOWN_WIDTH);
      setDropdownLeft(Math.min(leftOffset, maxLeft));
    },
    [inputRef, containerRef]
  );

  // Handle template detection from text change
  const handleTemplateDetection = useCallback(
    (newValue: string, cursorPos: number, isMultiline: boolean) => {
      const templateInfo = extractTemplateQuery(newValue, cursorPos);

      if (templateInfo) {
        setQuery(templateInfo.query);
        setInsertPosition(templateInfo.startPos);
        setOpen(true);

        const textBeforeCursor = newValue.slice(0, templateInfo.startPos);
        calculateDropdownPosition(textBeforeCursor, isMultiline);
      } else {
        closeDropdown();
      }
    },
    [calculateDropdownPosition, closeDropdown]
  );

  // Insert selected variable
  const handleSelectVariable = useCallback(
    (variablePath: string) => {
      if (insertPosition === null || !inputRef.current) return;

      const element = inputRef.current;
      const currentValue = value || "";
      const cursorPos = element.selectionStart ?? 0;
      const before = currentValue.slice(0, insertPosition - 2); // -2 for `{{`
      const after = currentValue.slice(cursorPos);

      const newValue = `${before}{{${variablePath}}}${after}`;
      const newCursorPos = before.length + variablePath.length + 4; // +4 for `{{` and `}}`

      onChange?.(newValue, newCursorPos);

      // Set cursor position after state update
      setTimeout(() => {
        element.setSelectionRange(newCursorPos, newCursorPos);
        element.focus();
      }, 0);

      closeDropdown();
    },
    [insertPosition, value, onChange, inputRef, closeDropdown]
  );

  // Keyboard navigation handler
  // We handle ↓↑ ourselves because focus stays on the external input, not cmdk
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!open || flatVariables.length === 0) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          // From -1 (no selection) go to 0, otherwise increment
          setSelectedIndex((i) => (i < 0 ? 0 : Math.min(i + 1, flatVariables.length - 1)));
          break;
        case "ArrowUp":
          e.preventDefault();
          // From -1 (no selection) go to 0, otherwise decrement
          setSelectedIndex((i) => (i < 0 ? 0 : Math.max(i - 1, 0)));
          break;
        case "Enter": {
          e.preventDefault();
          // Select current item (cmdk tracks selection via value)
          const enterIndex = selectedIndex < 0 ? 0 : selectedIndex;
          if (flatVariables[enterIndex]) {
            handleSelectVariable(flatVariables[enterIndex].path);
          }
          break;
        }
        case "Tab": {
          // Tab inserts and closes (standard behavior)
          const tabIndex = selectedIndex < 0 ? 0 : selectedIndex;
          if (flatVariables[tabIndex]) {
            e.preventDefault();
            handleSelectVariable(flatVariables[tabIndex].path);
          }
          break;
        }
        case "Escape":
          e.preventDefault();
          closeDropdown();
          inputRef.current?.focus();
          break;
      }
    },
    [open, flatVariables, selectedIndex, handleSelectVariable, closeDropdown, inputRef]
  );

  // Attach keyboard listener
  useEffect(() => {
    if (!open) return;

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, handleKeyDown]);

  // Close when clicking outside (handles portal rendering)
  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Element;

      // Check if click is inside container
      if (containerRef.current?.contains(target)) return;

      // Check if click is inside portaled dropdown (using data attribute)
      if (target.closest?.('[data-template-dropdown="true"]')) return;

      closeDropdown();
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, closeDropdown, containerRef]);

  // Validate template variables
  const validation: ValidationResult = useMemo(() => {
    if (!value || !value.includes("{{")) {
      return { valid: true, errors: [] };
    }
    return validateTemplate(value, variables);
  }, [value, variables]);

  // Apply a suggestion to fix an error
  const applySuggestion = useCallback(
    (error: VariableValidationError, suggestion: AvailableVariable) => {
      if (!inputRef.current) return;

      const newValue = value.slice(0, error.position.start) + `{{${suggestion.path}}}` + value.slice(error.position.end);
      const newCursorPos = error.position.start + suggestion.path.length + 4; // +4 for {{ and }}

      onChange?.(newValue, newCursorPos);

      // Set cursor position after state update
      setTimeout(() => {
        inputRef.current?.setSelectionRange(newCursorPos, newCursorPos);
        inputRef.current?.focus();
      }, 0);
    },
    [value, onChange, inputRef]
  );

  return {
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
    closeDropdown,
    validation,
    applySuggestion,
  };
}

// Re-export types for consumers
export type { ValidationResult, VariableValidationError };
