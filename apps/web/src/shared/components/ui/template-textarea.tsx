/**
 * TemplateTextarea Component
 *
 * Enhanced textarea with inline autocomplete for template variables.
 * Triggers autocomplete when user types `{{` and shows categorized variable suggestions.
 * Includes syntax highlighting for {{variables}} and hover tooltips showing mock values.
 *
 * Requires TemplateProvider context.
 *
 * @module components/ui/template-textarea
 */

import { memo } from "react";

import { HighlightedTextarea } from "@/shared/components/ui/highlighted-textarea";
import { useTemplateContext } from "@/shared/components/ui/template-context";
import { TemplateVariablesDropdown } from "@/shared/components/ui/template-variables-dropdown";
import { VariableTooltip } from "@/shared/components/ui/variable-tooltip";
import { useVariableTooltip } from "@/shared/hooks";
import { useTemplateField } from "@/features/nodes/journey/hooks/forms/use-template-field";

interface TemplateTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** External ref for accessing the textarea element */
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
  /** When true, hides the highlighted backdrop (useful for read-only/preview overlays) */
  hideBackdrop?: boolean;
  /** Class for the wrapper container (use for sizing/layout) */
  wrapperClassName?: string;
  /** Show error styling (red border) */
  hasError?: boolean;
}

/**
 * TemplateTextarea with inline variable autocomplete and syntax highlighting.
 *
 * Must be used within a TemplateProvider.
 *
 * @example
 * ```tsx
 * <TemplateProvider nodes={nodes} edges={edges} journeyId={id} nodeId={nodeId}>
 *   <TemplateTextarea value={value} onChange={onChange} />
 * </TemplateProvider>
 * ```
 */
export const TemplateTextarea = memo(function TemplateTextarea({
  textareaRef,
  hideBackdrop,
  wrapperClassName,
  className,
  value,
  onChange,
  hasError,
  ...props
}: TemplateTextareaProps) {
  const { nodeId, nodes, edges, journeyId, workflowNodes } = useTemplateContext();

  // Variable hover tooltip state (shared hook for DRY)
  const { hoveredVariable, handleVariableHover, handleTooltipMouseEnter, handleTooltipMouseLeave } =
    useVariableTooltip();

  const {
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
  } = useTemplateField<HTMLTextAreaElement>({
    nodeId,
    nodes,
    edges,
    journeyId,
    value: (value as string) || "",
    onChange,
    multiline: true,
    externalRef: textareaRef,
  });

  return (
    <div className={wrapperClassName} ref={containerRef}>
      <HighlightedTextarea
        ref={inputRef}
        value={value}
        onChange={handleChange}
        wrapperClassName="h-full"
        className={className}
        highlightClass="text-sky-500"
        hideBackdrop={hideBackdrop}
        onVariableHover={handleVariableHover}
        hasError={hasError}
        {...props}
      />

      <TemplateVariablesDropdown
        open={open}
        query={query}
        onQueryChange={setQuery}
        dropdownLeft={dropdownLeft}
        filteredGroups={filteredGroups}
        flatVariables={flatVariables}
        selectedIndex={selectedIndex}
        onSelectedIndexChange={setSelectedIndex}
        onSelectVariable={handleSelectVariable}
        nodes={nodes}
        maxHeight={280}
        containerRef={containerRef}
        validation={validation}
        onApplySuggestion={applySuggestion}
      />

      {/* Variable hover tooltip */}
      {hoveredVariable && (
        <VariableTooltip
          variablePath={hoveredVariable.path}
          x={hoveredVariable.x}
          y={hoveredVariable.y}
          nodes={nodes}
          workflowNodes={workflowNodes}
          onMouseEnter={handleTooltipMouseEnter}
          onMouseLeave={handleTooltipMouseLeave}
        />
      )}
    </div>
  );
});
