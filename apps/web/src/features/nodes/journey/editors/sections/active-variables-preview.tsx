/**
 * ScopedVariablesPreview Component
 *
 * Displays available variables for a specific scope (Journey, Global, User).
 * Click on variable name to copy {{variable_name}} to clipboard.
 *
 * @module components/journey/node-editors/active-variables-preview
 */

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/shared/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { VariableTypeBadge } from "@/shared/components/ui/badges";
import { useGlobalVariables, useJourneyVariables } from "@/hooks/queries/use-variables";
import { appConfig } from "@/shared/lib/app-config";
import { cn } from "@/shared/lib/utils";
import { ChevronDown, Copy, Eye } from "lucide-react";
import { useState } from "react";

import { notify } from "@/shared/lib/ui/notify";

// =============================================================================
// TYPES
// =============================================================================

type VariableScope = "journey" | "global" | "user";

interface ScopedVariablesPreviewProps {
  scope: VariableScope;
  journeyId?: string | null;
}

interface VariableItem {
  key: string;
  value: unknown;
  description: string | null;
}

function formatPreviewValue(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "string") {
    return value.length > 12 ? `${value.slice(0, 12)}...` : value;
  }
  if (typeof value === "boolean" || typeof value === "number") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return `[${value.length} items]`;
  }
  if (typeof value === "object") {
    const keys = Object.keys(value);
    return `{${keys.length} keys}`;
  }
  return String(value);
}

function formatTooltipValue(value: unknown): string {
  if (value === null || value === undefined) return "null";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function needsTooltip(value: unknown): boolean {
  return Array.isArray(value) || (typeof value === "object" && value !== null);
}

function copyToClipboard(key: string) {
  const template = `{{${key}}}`;
  navigator.clipboard.writeText(template);
  notify.success(`Copied ${template} to clipboard`);
}

// =============================================================================
// VARIABLE LIST COMPONENT
// =============================================================================

interface VariableListProps {
  variables: VariableItem[];
  emptyMessage: string;
  isLoading?: boolean;
}

function VariableRow({ variable }: { variable: VariableItem }) {
  const showTooltip = needsTooltip(variable.value);

  const valueContent = <span className="text-[9px] text-muted-foreground w-[70px] text-right truncate">{formatPreviewValue(variable.value)}</span>;

  return (
    <button
      key={variable.key}
      type="button"
      onClick={() => copyToClipboard(variable.key)}
      className="w-full grid grid-cols-[1fr_auto_70px_16px] items-center gap-1.5 py-0.5 rounded hover:bg-muted/50 transition-colors text-left group"
    >
      <span className="text-[10px] truncate">
        <span className="font-mono text-foreground">
          {"{{"}
          {variable.key}
          {"}}"}
        </span>
      </span>
      <VariableTypeBadge value={variable.value} size="xs" />
      {showTooltip ? (
        <Tooltip>
          <TooltipTrigger asChild>{valueContent}</TooltipTrigger>
          <TooltipContent side="left" className="max-w-[300px] max-h-[200px] overflow-auto">
            <pre className="text-[10px] font-mono whitespace-pre-wrap break-all">{formatTooltipValue(variable.value)}</pre>
          </TooltipContent>
        </Tooltip>
      ) : (
        valueContent
      )}
      <Copy className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}

function VariableList({ variables, emptyMessage, isLoading }: VariableListProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-2">
        <span className="text-[10px] text-muted-foreground">Loading...</span>
      </div>
    );
  }

  if (variables.length === 0) {
    return (
      <div className="flex items-center justify-center py-2 text-center">
        <span className="text-[10px] text-muted-foreground">{emptyMessage}</span>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-0">
        {variables.map((variable) => (
          <VariableRow key={variable.key} variable={variable} />
        ))}
      </div>
    </TooltipProvider>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function ScopedVariablesPreview({ scope, journeyId }: ScopedVariablesPreviewProps) {
  const [open, setOpen] = useState(false);

  // Fetch variables based on scope
  const { data: globalVariables = [], isLoading: globalLoading } = useGlobalVariables();
  const { data: journeyVariables = [], isLoading: journeyLoading } = useJourneyVariables(journeyId ?? undefined);

  // Get variables and config based on scope
  let variables: VariableItem[] = [];
  let isLoading = false;

  switch (scope) {
    case "journey":
      variables = journeyVariables.map((v) => ({
        key: v.key,
        value: v.value,
        description: v.description,
      }));
      isLoading = journeyLoading;
      break;
    case "global":
      variables = globalVariables.map((v) => ({
        key: v.key,
        value: v.value,
        description: v.description,
      }));
      isLoading = globalLoading;
      break;
    case "user":
      // User variables are session-specific, can't be fetched
      variables = [];
      isLoading = false;
      break;
  }

  const count = variables.length;

  // Don't render anything if there are no variables and not loading
  if (count === 0 && !isLoading) {
    return null;
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-1.5 w-full py-1 text-[10px] font-medium hover:text-foreground text-muted-foreground transition-colors">
        <Eye className="h-3 w-3" />
        <span>Available</span>
        {count > 0 && <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px]">{count}</span>}
        <ChevronDown className={cn("h-3 w-3 ml-auto transition-transform", open && "rotate-180")} />
      </CollapsibleTrigger>
      <CollapsibleContent className={cn("pt-1", appConfig.editor.padding.nested)}>
        <VariableList variables={variables} emptyMessage="" isLoading={isLoading} />
      </CollapsibleContent>
    </Collapsible>
  );
}
