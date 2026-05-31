/**
 * Prompt Selector
 *
 * Dropdown selector for choosing prompts from the Prompt Repository.
 * Used in agent node configuration to reference prompts instead of inline text.
 * Optionally shows variable mapping UI when showVariableMapper is enabled.
 *
 * @module features/prompts/components/prompt-selector
 */

import { memo, useCallback, useMemo } from "react";

import { Link } from "@tanstack/react-router";
import { ExternalLink, FileText } from "lucide-react";
import type { PromptType } from "@journey/schemas";

import { LabelBadge } from "@/shared/components/ui/badges";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Separator } from "@/shared/components/ui/separator";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { cn } from "@/shared/lib/utils";

import { usePrompts, usePromptVersions } from "../hooks";
import { PromptTypeBadge } from "./prompt-type-badge";
import { PromptVariableMapper } from "./prompt-variable-mapper";

// =============================================================================
// TYPES
// =============================================================================

interface PromptSelectorProps {
  /** Selected prompt name (kebab-case identifier) */
  value: string | undefined;
  /** Callback when prompt selection changes */
  onChange: (name: string | undefined) => void;
  /** Selected version ID (e.g., "v1", "v2"). Takes precedence over label. If undefined, uses label-based resolution. */
  versionId?: string;
  /** Callback when version changes. Pass undefined to use label-based resolution. */
  onVersionIdChange?: (versionId: string | undefined) => void;
  /** Label for label-based resolution (e.g., "production"). Used when versionId is not set. */
  label?: string;
  /** Callback when label changes. */
  onLabelChange?: (label: string) => void;
  /** Optional class name */
  className?: string;
  /** Optional ID prefix for form fields */
  idPrefix?: string;
  /** Whether the selector is disabled */
  disabled?: boolean;

  // Variable mapping props (optional - enable variable mapper UI)
  /** Current variable mappings (promptVar -> sourcePath) */
  variableMappings?: Record<string, string>;
  /** Callback when variable mappings change */
  onVariableMappingsChange?: (mappings: Record<string, string>) => void;
  /** Show the variable mapper UI (default: auto-show if mapping props provided) */
  showVariableMapper?: boolean;
  /** Filter prompts by type (e.g., ['text'] for agent system prompts) */
  allowedTypes?: PromptType[];
}

// =============================================================================
// COMPONENT
// =============================================================================

export const PromptSelector = memo(function PromptSelector({
  value,
  onChange,
  versionId,
  onVersionIdChange,
  label = "production",
  onLabelChange,
  className,
  idPrefix = "prompt-selector",
  disabled,
  // Variable mapping props
  variableMappings,
  onVariableMappingsChange,
  showVariableMapper,
  allowedTypes,
}: PromptSelectorProps) {
  const { data, isLoading } = usePrompts();
  const allPrompts = useMemo(() => data?.prompts ?? [], [data?.prompts]);

  // Filter prompts by type if allowedTypes is provided
  const prompts = useMemo(() => {
    if (!allowedTypes || allowedTypes.length === 0) return allPrompts;
    return allPrompts.filter((p) => allowedTypes.includes(p.type));
  }, [allPrompts, allowedTypes]);

  // Fetch versions for selected prompt
  const { data: versions = [], isLoading: isLoadingVersions } =
    usePromptVersions(value);

  // Determine if variable mapper should be shown
  const shouldShowMapper =
    showVariableMapper ?? (!!variableMappings && !!onVariableMappingsChange);

  const handlePromptChange = useCallback(
    (promptName: string) => {
      onChange(promptName || undefined);
      // Clear variable mappings when prompt changes (they'll be re-applied by smart defaults)
      if (onVariableMappingsChange && promptName !== value) {
        onVariableMappingsChange({});
      }
    },
    [onChange, onVariableMappingsChange, value]
  );

  const handleVersionChange = useCallback(
    (newVersionId: string | undefined) => {
      onVersionIdChange?.(newVersionId);
      // Clear variable mappings when version changes (variables might differ between versions)
      if (onVariableMappingsChange) {
        onVariableMappingsChange({});
      }
    },
    [onVersionIdChange, onVariableMappingsChange]
  );

  // Find selected prompt for display
  const selectedPrompt = prompts.find((p) => p.name === value);

  if (isLoading) {
    return (
      <div className={cn("space-y-3", className)}>
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {/* Prompt Selection */}
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-prompt`}>Prompt</Label>
        <Select
          value={value ?? ""}
          onValueChange={handlePromptChange}
          disabled={disabled}
        >
          <SelectTrigger id={`${idPrefix}-prompt`} className="w-full">
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              <SelectValue placeholder="Select a prompt">
                {selectedPrompt ? (
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="truncate">{selectedPrompt.name}</span>
                    <PromptTypeBadge type={selectedPrompt.type} />
                  </div>
                ) : (
                  "Select a prompt"
                )}
              </SelectValue>
            </div>
          </SelectTrigger>
          <SelectContent>
            {prompts.length === 0 ? (
              <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                No prompts available.{" "}
                <Link to="/prompts" className="text-primary hover:underline">
                  Create one
                </Link>
              </div>
            ) : (
              prompts.map((prompt) => (
                <SelectItem key={prompt.name} value={prompt.name}>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="truncate font-medium">{prompt.name}</span>
                    <PromptTypeBadge type={prompt.type} />
                  </div>
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Version Selection - conditional based on pin state */}
      {value && (
        <div className="space-y-3">
          {/* Pin toggle row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Checkbox
                id={`${idPrefix}-pin-version`}
                checked={Boolean(versionId)}
                onCheckedChange={(checked) => {
                  if (checked) {
                    // Pin to production version (or latest if no production)
                    const prodVersion = versions.find((v) =>
                      v.labels.includes("production")
                    );
                    const latestVersion = versions.find((v) =>
                      v.labels.includes("latest")
                    );
                    const targetVersion =
                      prodVersion ?? latestVersion ?? versions[0];
                    handleVersionChange(targetVersion?.versionId);
                  } else {
                    // Unpin - clear versionId, will use label
                    handleVersionChange(undefined);
                  }
                }}
                disabled={disabled || isLoadingVersions}
              />
              <Label
                htmlFor={`${idPrefix}-pin-version`}
                className="text-xs text-muted-foreground cursor-pointer"
              >
                Pin to specific version
              </Label>
            </div>
            <Link
              to="/prompts/$promptName"
              params={{ promptName: value }}
              className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
            >
              <ExternalLink className="h-3 w-3" />
              Edit prompt
            </Link>
          </div>

          {/* When NOT pinned: Show label selector */}
          {!versionId && (
            <div className="space-y-2">
              <Label htmlFor={`${idPrefix}-label`}>Label</Label>
              <Select
                value={label}
                onValueChange={(lbl) => onLabelChange?.(lbl)}
                disabled={disabled}
              >
                <SelectTrigger id={`${idPrefix}-label`} className="w-full">
                  <SelectValue placeholder="Select label" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="production">
                    <div className="flex items-center gap-2">
                      <LabelBadge label="production" size="sm" />
                    </div>
                  </SelectItem>
                  <SelectItem value="latest">
                    <div className="flex items-center gap-2">
                      <LabelBadge label="latest" size="sm" />
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Auto-updates when prompt changes
              </p>
            </div>
          )}

          {/* When PINNED: Show version dropdown */}
          {versionId && (
            <div className="space-y-2">
              <Label htmlFor={`${idPrefix}-version`}>Version</Label>
              <Select
                value={versionId}
                onValueChange={handleVersionChange}
                disabled={disabled || isLoadingVersions}
              >
                <SelectTrigger id={`${idPrefix}-version`} className="w-full">
                  <SelectValue
                    placeholder={
                      isLoadingVersions ? "Loading..." : "Select version"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {versions.length === 0 ? (
                    <div className="px-2 py-2 text-xs text-muted-foreground text-center">
                      No versions available
                    </div>
                  ) : (
                    versions.map((version) => {
                      const versionNum =
                        version.versionId.replace("v", "").replace(/^0+/, "") ||
                        "0";
                      return (
                        <SelectItem
                          key={version.versionId}
                          value={version.versionId}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-medium">v{versionNum}</span>
                            {version.labels.map((lbl) => (
                              <LabelBadge
                                key={lbl}
                                label={lbl}
                                size="sm"
                              />
                            ))}
                          </div>
                        </SelectItem>
                      );
                    })
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-amber-600">
                ⚠️ Version pinned — won't auto-update when prompt changes
              </p>
            </div>
          )}
        </div>
      )}

      {/* Variable Mapper (shown when prompt is selected and mapper is enabled) */}
      {value &&
        shouldShowMapper &&
        variableMappings !== undefined &&
        onVariableMappingsChange && (
          <>
            <Separator className="my-3" />
            <PromptVariableMapper
              promptName={value}
              versionId={versionId}
              label={label}
              mappings={variableMappings}
              onChange={onVariableMappingsChange}
              idPrefix={`${idPrefix}-var`}
            />
          </>
        )}
    </div>
  );
});
