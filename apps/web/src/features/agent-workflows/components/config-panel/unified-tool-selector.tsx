/**
 * Unified Tool Selector Component
 *
 * Single component for selecting agent tools from all sources:
 * - System tools (memory, variables, context)
 * - Utility tools (current_time, web_search)
 * - MCP tools (fetch, filesystem)
 *
 * Tools are grouped by category for intuitive selection.
 *
 * @module features/agent-workflows/components/config-panel/unified-tool-selector
 */

import { Badge } from "@/shared/components/ui/badges";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Label } from "@/shared/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { AlertCircle, Brain, CheckCircle2, Clock, Globe, Info, MessageSquare, Route, Search, Tag, User, Users, Variable, type LucideIcon } from "lucide-react";

import type { ToolExecutionTiming } from "@journey/schemas";

import { CATEGORY_LABELS, useToolDefinitionsWithUtils, type ToolCategory, type ToolDefinition } from "../../hooks/use-tool-definitions";
import { ToolInfoTooltip } from "./tool-info-tooltip";

// =============================================================================
// TYPES
// =============================================================================

export interface UnifiedToolSelectorProps {
  /** Currently selected tool IDs */
  selectedTools: string[];
  /** Callback when selection changes */
  onSelectionChange: (toolIds: string[]) => void;
  /** Unique ID prefix for form controls */
  idPrefix?: string;
  /** Whether the controls are disabled */
  disabled?: boolean;
  /** Categories to show (defaults to all) */
  showCategories?: ToolCategory[];
  /** Whether to show unavailable tools (defaults to true) */
  showUnavailable?: boolean;
  /** Timing overrides for selected tools (tool ID → timing) */
  toolTimingOverrides?: Record<string, ToolExecutionTiming>;
  /** Callback when tool timing is changed */
  onTimingChange?: (toolId: string, timing: ToolExecutionTiming) => void;
}

interface ToolItemProps {
  tool: ToolDefinition;
  isSelected: boolean;
  onToggle: (checked: boolean) => void;
  idPrefix: string;
  disabled?: boolean;
  /** Current timing override for this tool (if any) */
  timingOverride?: ToolExecutionTiming;
  /** Callback when timing changes */
  onTimingChange?: (timing: ToolExecutionTiming) => void;
}

interface ToolCategorySectionProps {
  category: ToolCategory;
  tools: ToolDefinition[];
  selectedTools: string[];
  onToolToggle: (toolId: string, checked: boolean) => void;
  idPrefix: string;
  disabled?: boolean;
  /** Timing overrides map (tool ID → timing) */
  toolTimingOverrides?: Record<string, ToolExecutionTiming>;
  /** Callback when timing changes */
  onTimingChange?: (toolId: string, timing: ToolExecutionTiming) => void;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Category icons
 */
const CATEGORY_ICONS: Record<ToolCategory, LucideIcon> = {
  memory: Brain,
  variables: Variable,
  tags: Tag,
  crm: Users,
  context: User,
  journey: Route,
  messaging: MessageSquare,
  search: Search,
  utility: Clock,
  external: Globe,
};

/**
 * Source badge colors
 */
const SOURCE_BADGES: Record<string, { label: string; className: string }> = {
  system: {
    label: "System",
    className: "border-0 text-blue-600 dark:text-blue-400",
  },
  utility: {
    label: "Built-in",
    className: "border-0 text-green-600 dark:text-green-400",
  },
  mcp: {
    label: "MCP",
    className: "border-0 text-purple-600 dark:text-purple-400",
  },
};

// =============================================================================
// COMPONENTS
// =============================================================================

/**
 * Single tool item with checkbox
 */
function ToolItem({ tool, isSelected, onToggle, idPrefix, disabled = false, timingOverride, onTimingChange }: ToolItemProps) {
  const checkboxId = `${idPrefix}-tool-${tool.id.replace(/:/g, "-")}`;
  const isAvailable = tool.available;
  const sourceBadge = SOURCE_BADGES[tool.source];

  // Determine effective timing (override or default)
  const effectiveTiming = timingOverride ?? tool.timingConfig?.timing ?? "immediate";
  const hasTimingConfig = !!tool.timingConfig;
  const isConfigurable = tool.timingConfig?.configurable ?? false;

  return (
    <div className="flex items-start gap-3 py-1.5">
      <Checkbox id={checkboxId} checked={isSelected} onCheckedChange={onToggle} disabled={disabled || !isAvailable} className="mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Label htmlFor={checkboxId} className="text-xs font-medium cursor-pointer">
            {tool.displayName}
          </Label>

          {/* AI usage info tooltip */}
          <ToolInfoTooltip tool={tool} />

          {/* Source badge */}
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 ${sourceBadge.className}`}>
                  {sourceBadge.label}
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs">
                <p className="text-xs">
                  {tool.source === "system" && "Context-aware tool requiring services"}
                  {tool.source === "utility" && "In-process standalone tool"}
                  {tool.source === "mcp" && `External MCP server: ${tool.mcpServer}`}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Availability indicator */}
          {!isAvailable && (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <AlertCircle className="h-3 w-3 text-amber-500" />
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs">
                  <p className="text-xs">{tool.unavailableReason || "Tool unavailable"}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {isAvailable && tool.apiKeyEnvVar && (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs">
                  <p className="text-xs">API key configured ({tool.apiKeyEnvVar})</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* Timing dropdown for configurable tools when selected */}
          {isSelected && hasTimingConfig && isConfigurable && (
            <Select
              value={effectiveTiming}
              onValueChange={(v) => onTimingChange?.(v as ToolExecutionTiming)}
              disabled={disabled}
            >
              <SelectTrigger className="w-fit h-5 text-[10px] px-2 py-0.5 ml-auto">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="immediate" className="text-xs">Before response</SelectItem>
                <SelectItem value="deferred" className="text-xs">After response</SelectItem>
              </SelectContent>
            </Select>
          )}

          {/* Info tooltip for fixed timing tools when selected */}
          {isSelected && hasTimingConfig && !isConfigurable && (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1 ml-auto text-[10px] text-muted-foreground">
                    <Info className="h-3 w-3" />
                    <span>{effectiveTiming === "immediate" ? "Before response" : "After response"}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs">
                  <p className="text-xs font-medium">Timing is fixed</p>
                  {tool.timingConfig?.fixedReason && (
                    <p className="text-xs mt-0.5">{tool.timingConfig.fixedReason}</p>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground line-clamp-2">{tool.description}</p>
      </div>
    </div>
  );
}

/**
 * Tools category section with grouped tools
 */
function ToolCategorySection({ category, tools, selectedTools, onToolToggle, idPrefix, disabled = false, toolTimingOverrides, onTimingChange }: ToolCategorySectionProps) {
  const Icon = CATEGORY_ICONS[category];
  const label = CATEGORY_LABELS[category];

  // Count selected in this category
  const selectedCount = tools.filter((t) => selectedTools.includes(t.id)).length;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <Icon className="h-3 w-3 text-muted-foreground" />
        <span className="text-[10px] font-medium uppercase text-muted-foreground">{label}</span>
        {selectedCount > 0 && (
          <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 ml-auto">
            {selectedCount}
          </Badge>
        )}
      </div>
      <div className="space-y-1 pl-0.5">
        {tools.map((tool) => (
          <ToolItem
            key={tool.id}
            tool={tool}
            isSelected={selectedTools.includes(tool.id)}
            onToggle={(checked) => onToolToggle(tool.id, checked as boolean)}
            idPrefix={idPrefix}
            disabled={disabled}
            timingOverride={toolTimingOverrides?.[tool.id]}
            onTimingChange={(timing) => onTimingChange?.(tool.id, timing)}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Loading skeleton
 */
function ToolSelectorSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <div className="space-y-1.5 pl-0.5">
            {[1, 2].map((j) => (
              <div key={j} className="flex items-start gap-3 py-1.5">
                <Skeleton className="h-4 w-4 rounded" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-2 w-48" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * UnifiedToolSelector Component
 *
 * Displays all available agent tools grouped by category.
 * Fetches tool definitions from the API and allows selection via checkboxes.
 *
 * @example
 * ```tsx
 * <UnifiedToolSelector
 *   selectedTools={["system:save_memory", "utility:current_time"]}
 *   onSelectionChange={(tools) => updateConfig({ tools: { enabled: tools } })}
 * />
 * ```
 */
export function UnifiedToolSelector({
  selectedTools,
  onSelectionChange,
  idPrefix = "tool",
  disabled = false,
  showCategories,
  showUnavailable = true,
  toolTimingOverrides,
  onTimingChange,
}: UnifiedToolSelectorProps) {
  const { toolsByCategory, orderedCategories, isLoading, error } = useToolDefinitionsWithUtils();

  const handleToolToggle = (toolId: string, checked: boolean) => {
    if (checked) {
      onSelectionChange([...selectedTools, toolId]);
    } else {
      onSelectionChange(selectedTools.filter((id) => id !== toolId));
    }
  };

  if (isLoading) {
    return <ToolSelectorSkeleton />;
  }

  if (error) {
    return (
      <div className="text-xs text-destructive flex items-center gap-2">
        <AlertCircle className="h-3 w-3" />
        Failed to load tools
      </div>
    );
  }

  // Filter categories if specified
  const categoriesToShow = showCategories ? orderedCategories.filter((cat) => showCategories.includes(cat)) : orderedCategories;

  // Filter tools by availability if needed
  const getFilteredTools = (category: ToolCategory) => {
    const tools = toolsByCategory[category] || [];
    return showUnavailable ? tools : tools.filter((t) => t.available);
  };

  // Total selected count
  const totalSelected = selectedTools.length;

  return (
    <div className="space-y-4">
      {/* Header with count */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Select tools the agent can use</p>
        {totalSelected > 0 && (
          <Badge variant="secondary" className="text-[10px]">
            {totalSelected} selected
          </Badge>
        )}
      </div>

      {/* Tool categories */}
      <div className="space-y-4">
        {categoriesToShow.map((category) => {
          const tools = getFilteredTools(category);
          if (tools.length === 0) return null;

          return (
            <ToolCategorySection
              key={category}
              category={category}
              tools={tools}
              selectedTools={selectedTools}
              onToolToggle={handleToolToggle}
              idPrefix={idPrefix}
              disabled={disabled}
              toolTimingOverrides={toolTimingOverrides}
              onTimingChange={onTimingChange}
            />
          );
        })}
      </div>

      {/* Empty state */}
      {categoriesToShow.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No tools available</p>}
    </div>
  );
}
