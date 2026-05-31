/**
 * External Tool Item Component
 *
 * Shared component for rendering individual external tools with checkboxes.
 * Used by both journey agent editor and workflow agent config.
 *
 * @module features/nodes/journey/editors/sections/agent-config/external-tool-item
 */

import { Checkbox } from "@/shared/components/ui/checkbox";
import { Label } from "@/shared/components/ui/label";
import { Badge } from "@/shared/components/ui/badges";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { Globe, BookOpen, Clock, AlertCircle, CheckCircle2 } from "lucide-react";

import type { ToolCategory, AvailableTool } from "../../../hooks/use-available-tools";

// =============================================================================
// TYPES
// =============================================================================

export interface ExternalToolItemProps {
  /** The tool to display */
  tool: AvailableTool;
  /** Whether this tool is selected */
  isSelected: boolean;
  /** Callback when selection changes */
  onToggle: (checked: boolean) => void;
  /** Unique ID prefix for form controls */
  idPrefix: string;
  /** Whether the control is disabled */
  disabled?: boolean;
}

export interface ExternalToolCategorySectionProps {
  /** Category identifier */
  category: ToolCategory;
  /** Tools in this category */
  tools: AvailableTool[];
  /** Currently selected tool names */
  selectedTools: string[];
  /** Callback when a tool is toggled */
  onToolToggle: (toolName: string, checked: boolean) => void;
  /** Unique ID prefix for form controls */
  idPrefix: string;
  /** Whether the controls are disabled */
  disabled?: boolean;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Category display configuration
 */
export const EXTERNAL_TOOL_CATEGORY_CONFIG: Record<ToolCategory, { label: string; icon: typeof Globe }> = {
  search: { label: "Search Tools", icon: Globe },
  knowledge: { label: "Knowledge Tools", icon: BookOpen },
  utility: { label: "Utility Tools", icon: Clock },
  custom: { label: "Custom Tools", icon: Globe },
};

// =============================================================================
// COMPONENTS
// =============================================================================

/**
 * Single external tool item with checkbox
 */
export function ExternalToolItem({
  tool,
  isSelected,
  onToggle,
  idPrefix,
  disabled = false,
}: ExternalToolItemProps) {
  const checkboxId = `${idPrefix}-tool-${tool.name}`;
  const isAvailable = !tool.requiresApiKey || tool.isConfigured;

  return (
    <div className="flex items-start gap-3 py-1.5">
      <Checkbox
        id={checkboxId}
        checked={isSelected}
        onCheckedChange={onToggle}
        disabled={disabled || !isAvailable}
        className="mt-0.5"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Label htmlFor={checkboxId} className="text-xs font-medium cursor-pointer">
            {tool.displayName}
          </Label>
          {/* MCP badge for external server tools */}
          {tool.source === "mcp" && (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-purple-400 text-purple-600 dark:text-purple-400">
                    MCP
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs">
                  <p className="text-xs">Runs as external Model Context Protocol server</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {tool.requiresApiKey && (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  {tool.isConfigured ? (
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                  ) : (
                    <AlertCircle className="h-3 w-3 text-amber-500" />
                  )}
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs">
                  {tool.isConfigured ? (
                    <p className="text-xs">API key configured ({tool.apiKeyEnvVar})</p>
                  ) : (
                    <p className="text-xs">
                      Requires API key: <code className="text-[10px]">{tool.apiKeyEnvVar}</code>
                    </p>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {!tool.requiresApiKey && tool.source !== "mcp" && (
            <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4">
              Free
            </Badge>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground line-clamp-2">{tool.description}</p>
      </div>
    </div>
  );
}

/**
 * External tools category section with grouped tools
 */
export function ExternalToolCategorySection({
  category,
  tools,
  selectedTools,
  onToolToggle,
  idPrefix,
  disabled = false,
}: ExternalToolCategorySectionProps) {
  const config = EXTERNAL_TOOL_CATEGORY_CONFIG[category];
  const Icon = config.icon;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <Icon className="h-3 w-3 text-muted-foreground" />
        <span className="text-[10px] font-medium uppercase text-muted-foreground">{config.label}</span>
      </div>
      <div className="space-y-1 pl-0.5">
        {tools.map((tool) => (
          <ExternalToolItem
            key={tool.name}
            tool={tool}
            isSelected={selectedTools.includes(tool.name)}
            onToggle={(checked) => onToolToggle(tool.name, checked as boolean)}
            idPrefix={idPrefix}
            disabled={disabled}
          />
        ))}
      </div>
    </div>
  );
}
