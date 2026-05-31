/**
 * Prompt Variable Mapper
 *
 * Inline form for mapping prompt template variables to context values.
 * Shows each required variable with a dropdown to select the source.
 *
 * @module features/prompts/components/prompt-variable-mapper
 */

import { memo, useCallback, useMemo } from "react";

import { Label } from "@/shared/components/ui/label";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { TemplateInput } from "@/shared/components/ui/template-input";
import { cn } from "@/shared/lib/utils";

import { usePromptVariables } from "../hooks";

// =============================================================================
// TYPES
// =============================================================================

interface PromptVariableMapperProps {
  /** Prompt name to fetch variables for */
  promptName: string;
  /** Version ID to fetch variables for (e.g., "v1"). If undefined, uses label. */
  versionId?: string;
  /** Label to use when versionId is undefined (defaults to "production") */
  label?: string;
  /** Current variable mappings */
  mappings: Record<string, string>;
  /** Callback when mappings change */
  onChange: (mappings: Record<string, string>) => void;
  /** Optional class name */
  className?: string;
  /** ID prefix for accessibility */
  idPrefix?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export const PromptVariableMapper = memo(function PromptVariableMapper({
  promptName,
  versionId,
  label = "production",
  mappings,
  onChange,
  className,
  idPrefix = "prompt-var",
}: PromptVariableMapperProps) {
  // Fetch required variables from prompt
  // When versionId is undefined, uses label-based resolution (defaults to "production")
  const { data, isLoading, error } = usePromptVariables(promptName, {
    versionId,
    label,
  });

  const requiredVariables = useMemo(() => data?.paths ?? [], [data?.paths]);

  // Handle individual variable mapping change
  // Store value as-is - resolver handles unwrapping {{}} before resolution
  const handleMappingChange = useCallback(
    (variable: string, value: string) => {
      onChange({
        ...mappings,
        [variable]: value,
      });
    },
    [mappings, onChange]
  );

  // Loading state
  if (isLoading) {
    return (
      <div className={cn("space-y-2", className)}>
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-full" />
      </div>
    );
  }

  // Error state
  if (error) {
    return <div className={cn("text-sm text-muted-foreground", className)}>Unable to load prompt variables</div>;
  }

  // No variables required return and show nothing
  if (requiredVariables.length === 0) {
    return null;
  }

  return (
    <div className={cn("space-y-3", className)}>
      {/* Header */}
      <Label className="text-sm font-medium">
        Prompt Variables
        <span className="ml-1 text-muted-foreground">({requiredVariables.length})</span>
      </Label>

      {/* Variable Mappings */}
      <div className="space-y-3">
        {requiredVariables.map((variable) => {
          const currentMapping = mappings[variable] ?? "";
          const isMapped = !!currentMapping;

          return (
            <div key={variable} className="space-y-1">
              {/* Variable Name - show with {{}} for copy-paste readiness */}
              <code className="text-xs font-mono text-muted-foreground">{`{{${variable}}}`}</code>

              {/* Mapping Input - with autocomplete for available variables */}
              <TemplateInput
                id={`${idPrefix}-${variable}`}
                value={currentMapping}
                onChange={(e) => handleMappingChange(variable, e.target.value)}
                placeholder="{{nodes.Agent_Name.response}}"
                variant="compact"
                hasError={!isMapped}
              />
              {/* Error message - matches journey editor pattern */}
              {!isMapped && <p className="text-xs text-destructive">Required</p>}
            </div>
          );
        })}
      </div>

      {/* Summary */}
      {requiredVariables.length > 0 && (
        <div className="text-xs">
          {requiredVariables.every((v) => mappings[v]) ? (
            <span className="text-emerald-600">All variables mapped</span>
          ) : (
            <span className="text-destructive">
              {requiredVariables.filter((v) => !mappings[v]).length} unmapped variable
              {requiredVariables.filter((v) => !mappings[v]).length > 1 ? "s" : ""}
            </span>
          )}
        </div>
      )}
    </div>
  );
});
