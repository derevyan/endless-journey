/**
 * ExternalToolsPanel Component
 *
 * Collapsible section for configuring external tools (Embedded + MCP).
 * Allows users to enable/disable available tools for the agent.
 *
 * Features:
 * - Tools grouped by category (Search, Knowledge, Utility)
 * - Visual indicators for API key requirements
 * - Checkbox-based selection with descriptions
 *
 * @module features/nodes/journey/editors/sections/external-tools-panel
 */

import { CollapsibleSection } from "@/shared/components/ui/collapsible-section";
import { Globe } from "lucide-react";

import { useAvailableTools, type ToolCategory } from "../../hooks/use-available-tools";
import { useEditorSectionsContext } from "../editor-sections-context";
import { ExternalToolCategorySection } from "./agent-config";
import type { StringArrayFieldApi } from "../../forms/form-types";

interface ExternalToolsPanelProps {
  /** Collapsible state */
  open: boolean;
  /** Collapsible state change handler */
  onOpenChange: (open: boolean) => void;
}

/**
 * External Tools Panel - Collapsible section for enabling/disabling agent tools
 *
 * @example
 * ```tsx
 * <ExternalToolsPanel
 *   open={toolsOpen}
 *   onOpenChange={setToolsOpen}
 * />
 * ```
 */
export function ExternalToolsPanel({
  open,
  onOpenChange,
}: ExternalToolsPanelProps) {
  const { form, nodeId, readOnly } = useEditorSectionsContext();

  // Get available tools from hook
  const { toolsByCategory } = useAvailableTools();

  // Get ordered categories that have tools
  const orderedCategories: ToolCategory[] = ["search", "knowledge", "utility", "custom"];
  const categoriesWithTools = orderedCategories.filter((cat) => toolsByCategory[cat]?.length > 0);

  return (
    <CollapsibleSection open={open} onOpenChange={onOpenChange} icon={Globe} label="External Tools">
      <p className="text-xs text-muted-foreground">
        Enable external tools for web search, knowledge lookup, and more.
      </p>

      <form.Field name="externalTools.embedded">
        {(field: StringArrayFieldApi) => {
          const selectedTools = field.state.value || [];

          const handleToolToggle = (toolName: string, checked: boolean) => {
            if (checked) {
              field.handleChange([...selectedTools, toolName]);
            } else {
              field.handleChange(selectedTools.filter((t) => t !== toolName));
            }
          };

          return (
            <div className="space-y-4 pt-1">
              {categoriesWithTools.map((category) => (
                <ExternalToolCategorySection
                  key={category}
                  category={category}
                  tools={toolsByCategory[category]}
                  selectedTools={selectedTools}
                  onToolToggle={handleToolToggle}
                  disabled={readOnly}
                  idPrefix={nodeId}
                />
              ))}

              {selectedTools.length > 0 && (
                <div className="pt-2 border-t">
                  <p className="text-[10px] text-muted-foreground">
                    <span className="font-medium">{selectedTools.length}</span> tool
                    {selectedTools.length !== 1 ? "s" : ""} enabled
                  </p>
                </div>
              )}
            </div>
          );
        }}
      </form.Field>
    </CollapsibleSection>
  );
}
