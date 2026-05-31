/**
 * Memory Section
 *
 * Shared component for configuring agent long-term memory.
 * Used by both journey agent editor and workflow agent config.
 *
 * @module features/nodes/journey/editors/sections/agent-config/memory-section
 */

import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Switch } from "@/shared/components/ui/switch";
import { ToolToggle } from "@/shared/components/ui/tool-toggle";
import { Brain } from "lucide-react";
import type { MemoryConfig } from "./types";

/**
 * Props for MemorySection component
 */
export interface MemorySectionProps {
  /** Current memory configuration */
  config: MemoryConfig;
  /** Callback when memory config changes */
  onConfigChange: (updates: Partial<MemoryConfig>) => void;
  /** Unique ID prefix for form controls */
  idPrefix: string;
  /** Whether the controls are disabled */
  disabled?: boolean;
  /** Show memory tools section (save/recall toggles) */
  showMemoryTools?: boolean;
  /** Callback when memory tool setting changes */
  onToolChange?: (tool: "saveMemory" | "recallMemories", value: boolean) => void;
  /** Current save memory tool state */
  saveMemoryEnabled?: boolean;
  /** Current recall memories tool state */
  recallMemoriesEnabled?: boolean;
}

/**
 * Memory Section Content
 *
 * Renders long-term memory configuration controls.
 */
export function MemorySection({
  config,
  onConfigChange,
  idPrefix,
  disabled,
  showMemoryTools = true,
  onToolChange,
  saveMemoryEnabled,
  recallMemoriesEnabled,
}: MemorySectionProps) {
  const isEnabled = config.enabled ?? false;
  // Support both naming conventions
  const autoInject = config.autoInjectMemories ?? config.autoInject ?? true;
  const maxMemories = config.maxMemoriesInContext ?? config.maxMemories ?? 10;

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">Remember facts about users across conversations using semantic search</p>

      {/* Enable Toggle */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor={`${idPrefix}-enabled`} className="text-xs cursor-pointer">
            Enable long-term memory
          </Label>
          <p className="text-[10px] text-muted-foreground">Agent can save and recall facts about users</p>
        </div>
        <Switch
          id={`${idPrefix}-enabled`}
          checked={isEnabled}
          onCheckedChange={(checked) => onConfigChange({ enabled: checked })}
          disabled={disabled}
        />
      </div>

      {/* Memory options (shown when enabled) */}
      {isEnabled && (
        <div className="space-y-3 pl-2 border-l-2 border-muted">
          {/* Auto-inject Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor={`${idPrefix}-autoinject`} className="text-xs cursor-pointer">
                Auto-inject memories
              </Label>
              <p className="text-[10px] text-muted-foreground">Add relevant memories to system prompt</p>
            </div>
            <Switch
              id={`${idPrefix}-autoinject`}
              checked={autoInject}
              onCheckedChange={(checked) => onConfigChange({ autoInject: checked })}
              disabled={disabled}
            />
          </div>

          {/* Max memories */}
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-max`} className="text-xs">
              Max memories in context
            </Label>
            <p className="text-[10px] text-muted-foreground">Maximum memories to inject (0-50)</p>
            <Input
              id={`${idPrefix}-max`}
              type="number"
              min={0}
              max={50}
              value={maxMemories}
              onChange={(e) => onConfigChange({ maxMemories: parseInt(e.target.value) || 10 })}
              className="text-sm"
              disabled={disabled}
            />
          </div>

          {/* Memory Tools */}
          {showMemoryTools && onToolChange && (
            <div className="space-y-2 pt-2 border-t border-muted">
              <Label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Memory Tools</Label>
              <div className="space-y-1">
                <ToolToggle
                  id={`${idPrefix}-saveMemory`}
                  icon={Brain}
                  label="save_memory"
                  description="Remember facts about the user"
                  checked={saveMemoryEnabled ?? config.saveMemory ?? false}
                  onChange={(v) => onToolChange("saveMemory", v)}
                  disabled={disabled}
                />
                <ToolToggle
                  id={`${idPrefix}-recallMemories`}
                  icon={Brain}
                  label="recall_memories"
                  description="Search memories about the user"
                  checked={recallMemoriesEnabled ?? config.recallMemories ?? false}
                  onChange={(v) => onToolChange("recallMemories", v)}
                  disabled={disabled}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
