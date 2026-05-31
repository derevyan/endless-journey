/**
 * JsonEditor Component
 *
 * CodeMirror-based editor for JSON with:
 * - Native JSON syntax highlighting
 * - Template variable highlighting ({{...}}) within strings
 * - Optional variable autocomplete
 * - JSON validation feedback
 * - Light/dark theme support
 *
 * @module components/ui/codemirror/editors/json-editor
 */

import { Extension } from "@codemirror/state";
import { memo, useCallback, useMemo, useState } from "react";

import { useTemplateContext } from "@/shared/components/ui/template-context";
import { cn } from "@/shared/lib/utils";
import { useTemplateVariables } from "@/features/nodes/journey/hooks/forms/use-template-variables";
import type { AvailableVariable } from "@/shared/lib/variables/variable-resolver";

import { createVariableAutocomplete, emptyVariableAutocomplete } from "../extensions/variable-autocomplete";
import { jsonWithTemplates } from "../languages/json-template";
import { useCodeMirror } from "../use-codemirror";

// =============================================================================
// TYPES
// =============================================================================

export interface JsonEditorProps {
  /** Current JSON value (as string) */
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
  /** Validate JSON and show error styling on invalid */
  validateJson?: boolean;
  /** Enable {{variable}} autocomplete (requires TemplateProvider) */
  enableVariableAutocomplete?: boolean;
  /** Additional CSS classes for the container */
  className?: string;
  /** Called when editor is focused */
  onFocus?: () => void;
  /** Called when editor loses focus */
  onBlur?: () => void;
}

// =============================================================================
// HELPERS
// =============================================================================

const EMPTY_VARIABLES: AvailableVariable[] = [];

/**
 * Validate JSON string (ignoring template variables for validation)
 */
function validateJsonWithTemplates(value: string): { valid: boolean; error?: string } {
  if (!value.trim()) {
    return { valid: true }; // Empty is valid
  }

  try {
    // Replace template variables with placeholder strings for validation
    const sanitized = value.replace(/\{\{[^}]*\}\}/g, '"__TEMPLATE_VAR__"');
    JSON.parse(sanitized);
    return { valid: true };
  } catch (e) {
    const error = e instanceof Error ? e.message : "Invalid JSON";
    return { valid: false, error };
  }
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * JSON editor with syntax highlighting and optional template variable support.
 *
 * For variable autocomplete, wrap in TemplateProvider and set enableVariableAutocomplete.
 *
 * @example
 * ```tsx
 * // Basic usage
 * <JsonEditor
 *   value={jsonString}
 *   onChange={setJsonString}
 *   validateJson
 * />
 *
 * // With variable autocomplete
 * <TemplateProvider nodeId={nodeId} nodes={nodes} edges={edges} journeyId={journeyId}>
 *   <JsonEditor
 *     value={jsonString}
 *     onChange={setJsonString}
 *     enableVariableAutocomplete
 *   />
 * </TemplateProvider>
 * ```
 */
export const JsonEditor = memo(function JsonEditor({
  value,
  onChange,
  placeholder = '{\n  "key": "value"\n}',
  minHeight = 100,
  maxHeight,
  disabled = false,
  hasError = false,
  validateJson = false,
  enableVariableAutocomplete = false,
  className,
  onFocus,
  onBlur,
}: JsonEditorProps) {
  // Track internal validation state
  const [internalError, setInternalError] = useState(false);

  // Try to get variables from context if autocomplete is enabled
  let resolvedVariables: AvailableVariable[] = EMPTY_VARIABLES;
  try {
    if (enableVariableAutocomplete) {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const context = useTemplateContext();
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const { variables: vars } = useTemplateVariables({
        nodeId: context.nodeId,
        nodes: context.nodes,
        edges: context.edges,
        journeyId: context.journeyId,
      });
      resolvedVariables = vars;
    }
  } catch {
    // Not in TemplateProvider context, skip autocomplete
  }
  const variables = useMemo(
    () => (enableVariableAutocomplete ? resolvedVariables : EMPTY_VARIABLES),
    [enableVariableAutocomplete, resolvedVariables]
  );

  // Create autocomplete extension
  const autocompleteExtension = useMemo<Extension>(() => {
    if (!enableVariableAutocomplete || variables.length === 0) {
      return emptyVariableAutocomplete;
    }
    return createVariableAutocomplete(variables);
  }, [enableVariableAutocomplete, variables]);

  // Memoize the JSON language extensions
  const languageExtensions = useMemo(() => jsonWithTemplates(), []);

  // Handle change with optional validation
  const handleChange = useCallback(
    (newValue: string) => {
      if (validateJson) {
        const validation = validateJsonWithTemplates(newValue);
        setInternalError(!validation.valid);
      }
      onChange(newValue);
    },
    [onChange, validateJson]
  );

  // Initialize CodeMirror
  const { containerRef } = useCodeMirror({
    value,
    onChange: handleChange,
    extensions: [...languageExtensions, autocompleteExtension],
    placeholder,
    readOnly: disabled,
    minHeight,
    maxHeight,
    onFocus,
    onBlur,
  });

  const showError = hasError || (validateJson && internalError);

  return (
    <div
      ref={containerRef}
      className={cn(
        // Base styles
        "rounded-md border bg-background shadow-xs overflow-hidden",
        // Focus ring
        "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
        // Error state
        showError && "border-destructive focus-within:ring-destructive",
        // Disabled state
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    />
  );
});
