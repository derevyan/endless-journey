/**
 * LLM Config Section
 *
 * Shared component for configuring agent LLM settings.
 * Used by both journey agent editor and workflow agent config.
 *
 * @module features/nodes/journey/editors/sections/agent-config/llm-config-section
 */

import { ModelConfigPanel } from "@/shared/components/model-config-panel";
import { ModelSelectorPopover } from "@/shared/components/model-selector-popover";
import { Button } from "@/shared/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/shared/components/ui/collapsible";
import { Label } from "@/shared/components/ui/label";
import { cn } from "@/shared/lib/utils";
import { llmConfig } from "@journey/schemas";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import type { LLMConfig } from "./types";

/**
 * Props for LLMConfigSection component
 */
export interface LLMConfigSectionProps {
  /** Current LLM configuration */
  config: LLMConfig;
  /** Callback when configuration changes */
  onConfigChange: (updates: Partial<LLMConfig>) => void;
  /** Unique ID prefix for form controls */
  idPrefix: string;
  /** Whether the controls are disabled */
  disabled?: boolean;
  /** Show advanced settings collapsible (maxTokens, maxRetries) */
  showAdvanced?: boolean;
}

/**
 * LLM Config Section Content
 *
 * Renders model selection, temperature, and optional advanced settings.
 */
export function LLMConfigSection({ config, onConfigChange, idPrefix, disabled, showAdvanced = false }: LLMConfigSectionProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const modelId = config.model || llmConfig.agent.model.id;

  return (
    <div className="space-y-3">
      {/* Model Selection */}
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-model`} className="text-xs">
          Model
        </Label>
        <ModelSelectorPopover
          value={modelId}
          onChange={(value) => onConfigChange({ model: value })}
          disabled={disabled}
          className="w-full text-sm"
        />
      </div>

      {/* Temperature / Reasoning Configuration */}
      <ModelConfigPanel
        modelId={modelId}
        temperature={config.temperature ?? 0.7}
        onTemperatureChange={(v) => onConfigChange({ temperature: v })}
        disabled={disabled}
        idPrefix={`${idPrefix}-config`}
      />

      {/* Advanced LLM Options (Collapsible) */}
      {showAdvanced && (
        <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between px-2 h-8 text-xs" type="button">
              <span>Advanced LLM Settings</span>
              <ChevronDown className={cn("h-3 w-3 transition-transform", advancedOpen && "rotate-180")} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 pt-2">
            <ModelConfigPanel
              modelId={modelId}
              temperature={0}
              onTemperatureChange={() => {}}
              disabled={disabled}
              showTemperature={false}
              showAdvanced
              maxTokens={config.maxTokens}
              onMaxTokensChange={(v) => onConfigChange({ maxTokens: v })}
              maxRetries={config.maxRetries ?? 2}
              onMaxRetriesChange={(v) => onConfigChange({ maxRetries: v })}
              idPrefix={`${idPrefix}-advanced`}
            />
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
