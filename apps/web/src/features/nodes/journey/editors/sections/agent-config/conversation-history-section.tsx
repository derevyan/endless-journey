/**
 * Conversation History Section
 *
 * Shared component for configuring agent conversation history.
 * Used by both journey agent editor and workflow agent config.
 *
 * @module features/nodes/journey/editors/sections/agent-config/conversation-history-section
 */

import type { ConversationHistoryStrategy } from "@journey/schemas";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/shared/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Switch } from "@/shared/components/ui/switch";
import type { ConversationHistoryConfig } from "./types";

/**
 * Props for ConversationHistorySection component
 */
export interface ConversationHistorySectionProps {
  /** Current history configuration */
  config: ConversationHistoryConfig;
  /** Callback when configuration changes */
  onConfigChange: (updates: Partial<ConversationHistoryConfig>) => void;
  /** Unique ID prefix for form controls */
  idPrefix: string;
  /** Whether the controls are disabled */
  disabled?: boolean;
  /** Strategy selector variant: radio (journey) or select (workflow) */
  variant?: "radio" | "select";
  /** Show enabled toggle (journey has this, workflow doesn't) */
  showEnabledToggle?: boolean;
  /** Show sliding_window option (workflow has this, journey doesn't) */
  showSlidingWindow?: boolean;
}

/**
 * Conversation History Section Content
 *
 * Renders conversation history configuration controls.
 * Supports both RadioGroup (journey) and Select (workflow) variants.
 */
export function ConversationHistorySection({
  config,
  onConfigChange,
  idPrefix,
  disabled,
  variant = "select",
  showEnabledToggle = false,
  showSlidingWindow = false,
}: ConversationHistorySectionProps) {
  const strategy = config.strategy ?? "simple";
  const isEnabled = config.enabled ?? true;

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">Control how conversation history is sent to the LLM</p>

      {/* Enabled Toggle (journey-specific) */}
      {showEnabledToggle && (
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor={`${idPrefix}-enabled`} className="text-xs cursor-pointer">
              Include history in LLM context
            </Label>
            <p className="text-[10px] text-muted-foreground">When disabled, each turn is stateless (agent has no memory)</p>
          </div>
          <Switch
            id={`${idPrefix}-enabled`}
            checked={isEnabled}
            onCheckedChange={(checked) => onConfigChange({ enabled: checked })}
            disabled={disabled}
          />
        </div>
      )}

      {/* Only show options when history is enabled */}
      {isEnabled && (
        <div className="space-y-4">
          {/* Strategy Selection - RadioGroup variant */}
          {variant === "radio" && (
            <div className="space-y-2">
              <Label className="text-xs">Strategy</Label>
              <RadioGroup
                value={strategy}
                onValueChange={(value) => onConfigChange({ strategy: value as ConversationHistoryStrategy })}
                disabled={disabled}
                className="space-y-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="none" id={`${idPrefix}-strategy-none`} />
                  <div>
                    <Label htmlFor={`${idPrefix}-strategy-none`} className="text-xs cursor-pointer">
                      None (Stateless)
                    </Label>
                    <p className="text-[10px] text-muted-foreground">No history sent to LLM. Use Chat type prompt.</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="simple" id={`${idPrefix}-strategy-simple`} />
                  <div>
                    <Label htmlFor={`${idPrefix}-strategy-simple`} className="text-xs cursor-pointer">
                      Simple Limit
                    </Label>
                    <p className="text-[10px] text-muted-foreground">Keep last N messages</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="summarize" id={`${idPrefix}-strategy-summarize`} />
                  <div>
                    <Label htmlFor={`${idPrefix}-strategy-summarize`} className="text-xs cursor-pointer">
                      Smart Summarization
                    </Label>
                    <p className="text-[10px] text-muted-foreground">Compress old messages into summaries</p>
                  </div>
                </div>
                {showSlidingWindow && (
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="sliding_window" id={`${idPrefix}-strategy-sliding`} />
                    <div>
                      <Label htmlFor={`${idPrefix}-strategy-sliding`} className="text-xs cursor-pointer">
                        Sliding Window
                      </Label>
                      <p className="text-[10px] text-muted-foreground">Rolling window with overlap</p>
                    </div>
                  </div>
                )}
              </RadioGroup>
            </div>
          )}

          {/* Strategy Selection - Select variant */}
          {variant === "select" && (
            <div className="space-y-2">
              <Label htmlFor={`${idPrefix}-strategy`} className="text-xs">
                Strategy
              </Label>
              <Select
                value={strategy}
                onValueChange={(v) => onConfigChange({ strategy: v as ConversationHistoryStrategy })}
                disabled={disabled}
              >
                <SelectTrigger id={`${idPrefix}-strategy`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (Stateless)</SelectItem>
                  <SelectItem value="simple">Simple Limit</SelectItem>
                  <SelectItem value="summarize">Smart Summarization</SelectItem>
                  {showSlidingWindow && <SelectItem value="sliding_window">Sliding Window</SelectItem>}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                {strategy === "none"
                  ? "No history sent to LLM. Use a Chat type prompt to include user messages."
                  : strategy === "summarize"
                    ? "Compress old messages into summaries"
                    : strategy === "sliding_window"
                      ? "Rolling window with overlap"
                      : "Keep last N messages"}
              </p>
            </div>
          )}

          {/* Max Messages (shown for simple and sliding_window) */}
          {(strategy === "simple" || strategy === "sliding_window") && (
            <div className="space-y-2">
              <Label htmlFor={`${idPrefix}-max`} className="text-xs">
                Maximum messages
              </Label>
              <p className="text-[10px] text-muted-foreground">Limit recent messages sent to LLM (1-100)</p>
              <Input
                id={`${idPrefix}-max`}
                type="number"
                min={1}
                max={100}
                value={config.maxMessages ?? 12}
                onChange={(e) => onConfigChange({ maxMessages: parseInt(e.target.value) || 12 })}
                className="text-sm"
                disabled={disabled}
              />
            </div>
          )}

          {/* Summarization Config (when summarize strategy selected) */}
          {strategy === "summarize" && (
            <div className="space-y-3 pl-2 border-l-2 border-muted">
              <div className="space-y-2">
                <Label htmlFor={`${idPrefix}-trigger`} className="text-xs">
                  Trigger after messages
                </Label>
                <p className="text-[10px] text-muted-foreground">Summarize when history exceeds this count</p>
                <Input
                  id={`${idPrefix}-trigger`}
                  type="number"
                  min={5}
                  max={100}
                  value={config.triggerMessages ?? config.summarizeAfter ?? 20}
                  onChange={(e) => onConfigChange({ triggerMessages: parseInt(e.target.value) || 20 })}
                  className="text-sm"
                  disabled={disabled}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor={`${idPrefix}-keep`} className="text-xs">
                  Keep recent messages
                </Label>
                <p className="text-[10px] text-muted-foreground">Number of recent messages to keep verbatim</p>
                <Input
                  id={`${idPrefix}-keep`}
                  type="number"
                  min={1}
                  max={50}
                  value={config.keepMessages ?? 6}
                  onChange={(e) => onConfigChange({ keepMessages: parseInt(e.target.value) || 6 })}
                  className="text-sm"
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
