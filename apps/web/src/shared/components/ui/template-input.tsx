/**
 * TemplateInput Component
 *
 * Enhanced single-line input with inline autocomplete for template variables.
 * Triggers autocomplete when user types `{{` and shows categorized variable suggestions.
 * Shows hover tooltip with mock data when hovering over variables.
 *
 * Requires TemplateProvider context.
 *
 * @module components/ui/template-input
 */

import { memo } from "react";

import { HighlightedInput } from "@/shared/components/ui/highlighted-input";
import { useTemplateContext } from "@/shared/components/ui/template-context";
import { TemplateVariablesDropdown } from "@/shared/components/ui/template-variables-dropdown";
import { VariableTooltip } from "@/shared/components/ui/variable-tooltip";
import { useVariableTooltip } from "@/shared/hooks";
import { useTemplateField } from "@/features/nodes/journey/hooks/forms/use-template-field";

interface TemplateInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "className"> {
  /** Size variant - "default" (h-9) or "compact" (h-8, font-mono) */
  variant?: "default" | "compact";
  /** Additional CSS classes (non-structural styles) */
  className?: string;
  /** CSS class for highlighted variables (default: text-sky-500) */
  highlightClass?: string;
  /** Shows error styling (red border) when true */
  hasError?: boolean;
}

/**
 * TemplateInput with inline variable autocomplete and hover tooltips.
 *
 * Must be used within a TemplateProvider.
 *
 * @example
 * ```tsx
 * <TemplateProvider nodes={nodes} edges={edges} journeyId={id} nodeId={nodeId}>
 *   <TemplateInput value={value} onChange={onChange} />
 * </TemplateProvider>
 * ```
 */
export const TemplateInput = memo(function TemplateInput({
  variant = "default",
  className,
  highlightClass,
  value,
  onChange,
  hasError,
  ...props
}: TemplateInputProps) {
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
  } = useTemplateField<HTMLInputElement>({
    nodeId,
    nodes,
    edges,
    journeyId,
    workflowNodes,
    value: (value as string) || "",
    onChange,
    multiline: false,
  });

  return (
    <div className="relative" ref={containerRef}>
      <HighlightedInput
        ref={inputRef}
        variant={variant}
        value={value}
        onChange={handleChange}
        className={className}
        highlightClass={highlightClass}
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
        maxHeight={240}
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
