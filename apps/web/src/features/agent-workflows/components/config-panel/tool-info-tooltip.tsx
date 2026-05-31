/**
 * Tool Info Tooltip Component
 *
 * Displays AI usage information for a tool in a tooltip.
 * Shows the internal tool name, parameters, and example prompt.
 *
 * @module features/agent-workflows/components/config-panel/tool-info-tooltip
 */

import { Badge } from "@/shared/components/ui/badges";
import { Separator } from "@/shared/components/ui/separator";
import { Tooltip, TooltipProvider, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { cn } from "@/shared/lib/utils";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { Check, Copy, Info } from "lucide-react";
import * as React from "react";
import type { ToolDefinition, ToolParameterProperty } from "../../hooks/use-tool-definitions";

// =============================================================================
// TYPES
// =============================================================================

interface ToolInfoTooltipProps {
  tool: ToolDefinition;
}

interface ParameterListProps {
  properties: Record<string, ToolParameterProperty>;
  required?: string[];
}

// =============================================================================
// COMPONENTS
// =============================================================================

/**
 * Render a single parameter with its type and description
 */
function ParameterItem({
  name,
  property,
  isRequired,
}: {
  name: string;
  property: ToolParameterProperty;
  isRequired: boolean;
}) {
  const typeLabel = property.enum ? "enum" : property.type;

  return (
    <li className="flex flex-col gap-1 text-xs">
      {/* Header Line: Name + Required + Type + Enum */}
      <div className="flex items-center flex-wrap gap-2">
        <div className="flex items-center gap-1">
          <code className="bg-muted px-1.5 py-0.5 rounded-md font-mono text-[11px] font-medium text-foreground border border-border/50">
            {name}
          </code>
          {isRequired && (
            <span className="text-destructive font-bold text-sm leading-none pt-0.5" title="Required">
              *
            </span>
          )}
        </div>

        <Badge 
          variant="outline" 
          className="h-5 px-1.5 text-[10px] font-medium tracking-wide text-muted-foreground border-border/60 bg-background/50"
        >
          {typeLabel}
        </Badge>
        
        {property.enum && (
          <span className="text-[10px] text-muted-foreground font-mono opacity-80">
            [{property.enum.slice(0, 3).join(", ")}
            {property.enum.length > 3 && ", ..."}]
          </span>
        )}
      </div>
      
      {/* Description Line */}
      {property.description && (
        <p className="text-muted-foreground leading-relaxed pl-1">
          {property.description}
        </p>
      )}
    </li>
  );
}

/**
 * Render the list of parameters
 */
function ParameterList({ properties, required = [] }: ParameterListProps) {
  const entries = Object.entries(properties);

  if (entries.length === 0) {
    return <p className="text-xs text-muted-foreground italic pl-1">No parameters required.</p>;
  }

  return (
    <ul className="space-y-3">
      {entries.map(([name, prop]) => (
        <ParameterItem
          key={name}
          name={name}
          property={prop}
          isRequired={required.includes(name)}
        />
      ))}
    </ul>
  );
}

/**
 * Content displayed inside the tooltip
 */
function ToolInfoContent({ tool }: { tool: ToolDefinition }) {
  const hasParameters = tool.parameterSchema?.properties && Object.keys(tool.parameterSchema.properties).length > 0;
  const hasExample = !!tool.usageExample;
  const [copiedExample, setCopiedExample] = React.useState(false);
  const [copiedName, setCopiedName] = React.useState(false);

  const copyToClipboard = React.useCallback(async (text: string, setCopied: (val: boolean) => void) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Silent fail - user can see the copy didn't work because the checkmark won't appear
    }
  }, []);

  return (
    <div className="w-[300px] space-y-3">
      {/* Header */}
      <div className="space-y-0.5 px-0.5">
        <div className="flex items-center justify-between group/header">
          <h4 className="font-semibold text-sm tracking-tight text-foreground flex items-center gap-2">
            {tool.name}
          </h4>
          <button
            onClick={() => copyToClipboard(tool.name, setCopiedName)}
            className="text-muted-foreground/0 group-hover/header:text-muted-foreground/50 hover:!text-foreground transition-all p-0.5"
            title="Copy tool name"
          >
            {copiedName ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Internal tool configuration.
        </p>
      </div>

      <Separator className="bg-border/60" />

      {/* Parameters Section */}
      {hasParameters && (
        <div className="space-y-2">
          <h5 className="text-[10px] font-semibold text-foreground/70 uppercase tracking-widest pl-0.5">
            Parameters
          </h5>
          <div className="p-0.5">
            <ParameterList
              properties={tool.parameterSchema!.properties!}
              required={tool.parameterSchema!.required}
            />
          </div>
        </div>
      )}

      {/* Example Section */}
      {hasExample && (
        <div className="space-y-2">
          <div className="flex items-center justify-between pl-0.5 pr-1">
            <h5 className="text-[10px] font-semibold text-foreground/70 uppercase tracking-widest">
              Example Prompt
            </h5>
            <button
              onClick={() => copyToClipboard(tool.usageExample!, setCopiedExample)}
              className="text-muted-foreground/50 hover:text-foreground transition-colors p-0.5"
              title="Copy example"
            >
              {copiedExample ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            </button>
          </div>
          <div className="bg-accent/40 rounded-md py-2 px-3 border border-border/40 relative overflow-hidden group">
             <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary/30" />
            <p className="text-[10px] text-muted-foreground font-mono leading-relaxed pl-1 whitespace-pre-wrap break-words">
              {tool.usageExample}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}


// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * ToolInfoTooltip Component
 *
 * Displays an info icon that shows AI usage information on hover.
 * Only renders if the tool has parameters or an example prompt.
 *
 * @example
 * ```tsx
 * <ToolInfoTooltip tool={tool} />
 * ```
 */
export function ToolInfoTooltip({ tool }: ToolInfoTooltipProps) {
  const hasParameters = tool.parameterSchema?.properties && Object.keys(tool.parameterSchema.properties).length > 0;
  const hasExample = !!tool.usageExample;

  // Don't render if there's no useful info to show
  if (!hasParameters && !hasExample) {
    return null;
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              "group inline-flex items-center justify-center p-1 rounded-full",
              "text-muted-foreground/70 hover:text-foreground",
              "hover:bg-accent hover:ring-1 hover:ring-border",
              "transition-all duration-200"
            )}
            aria-label="Tool usage information"
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipPrimitive.Portal>
           <TooltipPrimitive.Content
            side="right"
            align="start"
            sideOffset={12}
            className={cn(
              "z-50 rounded-lg border bg-popover p-4 text-popover-foreground shadow-md outline-none",
              "data-[state=open]:animate-in data-[state=closed]:animate-out",
              "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
              "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
              "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2",
              "data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
            )}
           >
            <ToolInfoContent tool={tool} />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </Tooltip>
    </TooltipProvider>
  );
}
