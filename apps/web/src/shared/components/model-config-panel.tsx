/**
 * ModelConfigPanel Component
 *
 * Reusable panel for LLM model configuration.
 * Displays model-specific settings based on capabilities:
 * - Reasoning effort selector (for reasoning models - ALWAYS takes priority)
 * - Temperature slider (for non-reasoning models that support it)
 * - "Fixed Parameters" info (for models without adjustable settings)
 * - Advanced settings (maxTokens, maxRetries) optionally
 *
 * @module shared/components/model-config-panel
 */

import { useModelsByProvider } from "@/hooks/queries/use-models";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/shared/components/ui/radio-group";
import { Slider } from "@/shared/components/ui/slider";
import { cn } from "@/shared/lib/utils";
import { AlertCircle, Check, Sparkles } from "lucide-react";
import { useMemo } from "react";

/** Reasoning effort options for reasoning models */
const REASONING_EFFORT_OPTIONS = [
  { value: "low", label: "Low", desc: "Faster" },
  { value: "medium", label: "Medium", desc: "Balanced" },
  { value: "high", label: "High", desc: "Thorough" },
] as const;

export type ReasoningEffort = "low" | "medium" | "high";

/**
 * Default temperature range when model info is unavailable
 */
const DEFAULT_TEMPERATURE_RANGE = { min: 0, max: 2 };

interface ModelConfigPanelProps {
  /** The selected model ID */
  modelId: string;
  /** Current temperature value */
  temperature: number;
  /** Callback when temperature changes */
  onTemperatureChange: (value: number) => void;
  /** Whether the panel is disabled */
  disabled?: boolean;
  /** Whether to show temperature/reasoning section (default: true) */
  showTemperature?: boolean;
  /** Whether to show advanced settings (maxTokens, maxRetries) */
  showAdvanced?: boolean;
  /** Current maxTokens value */
  maxTokens?: number;
  /** Callback when maxTokens changes */
  onMaxTokensChange?: (value: number | undefined) => void;
  /** Current maxRetries value */
  maxRetries?: number;
  /** Callback when maxRetries changes */
  onMaxRetriesChange?: (value: number) => void;
  /** Optional ID prefix for form elements */
  idPrefix?: string;
  /** Current reasoning effort value (for reasoning models) */
  reasoningEffort?: ReasoningEffort;
  /** Callback when reasoning effort changes (for reasoning models) */
  onReasoningEffortChange?: (value: ReasoningEffort) => void;
}

/**
 * Panel for model-specific LLM configuration
 */
export function ModelConfigPanel({
  modelId,
  temperature,
  onTemperatureChange,
  disabled = false,
  showTemperature = true,
  showAdvanced = false,
  maxTokens,
  onMaxTokensChange,
  maxRetries,
  onMaxRetriesChange,
  idPrefix = "model-config",
  reasoningEffort,
  onReasoningEffortChange,
}: ModelConfigPanelProps) {
  // Fetch models from API
  const { data: modelsData, isLoading, isError, refetch } = useModelsByProvider();
  const modelsByProvider = useMemo(() => modelsData?.modelsByProvider ?? {}, [modelsData?.modelsByProvider]);

  // Find current model metadata
  const currentModel = useMemo(() => {
    return Object.values(modelsByProvider)
      .flat()
      .find((m) => m.id === modelId);
  }, [modelsByProvider, modelId]);

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-2 animate-pulse">
        <div className="h-4 w-24 bg-muted rounded" />
        <div className="h-8 bg-muted rounded" />
        <div className="h-3 w-32 bg-muted rounded mt-2" />
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-md">
        <AlertCircle className="h-4 w-4 text-destructive" />
        <div className="flex-1">
          <p className="text-xs text-destructive">Failed to load model info</p>
          <p className="text-[10px] text-muted-foreground">Using default settings</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="h-7 text-xs">
          Retry
        </Button>
      </div>
    );
  }

  const tempRange = currentModel?.temperatureRange ?? DEFAULT_TEMPERATURE_RANGE;
  const supportsTemperature = currentModel?.supportsTemperature ?? true;
  const isReasoningModel = currentModel?.capabilities?.reasoning ?? false;

  return (
    <div className="space-y-4">
      {/* Model Settings Section - key forces re-render when model changes */}
      {/* Priority: Reasoning models show reasoning effort, others show temperature if supported */}
      {showTemperature &&
        (isReasoningModel && onReasoningEffortChange ? (
          // Reasoning effort selector for reasoning models (checked FIRST)
          <div key={`reasoning-${modelId}`} className="space-y-2">
            <Label className="text-xs flex items-center gap-1.5">
              <Sparkles className="h-3 w-3" />
              Reasoning Effort
            </Label>
            <RadioGroup
              value={reasoningEffort ?? "medium"}
              onValueChange={(value) => onReasoningEffortChange(value as ReasoningEffort)}
              className="flex gap-2"
              disabled={disabled}
            >
              {REASONING_EFFORT_OPTIONS.map((opt) => {
                const isSelected = (reasoningEffort ?? "medium") === opt.value;
                return (
                  <Label
                    key={opt.value}
                    htmlFor={`${idPrefix}-reasoning-${opt.value}`}
                    className={cn(
                      "flex-1 flex flex-col items-center p-2 border rounded-md cursor-pointer transition-colors relative",
                      isSelected ? "border-orange-500" : "border-border hover:bg-muted/50",
                      disabled && "cursor-not-allowed opacity-50"
                    )}
                  >
                    <RadioGroupItem id={`${idPrefix}-reasoning-${opt.value}`} value={opt.value} className="sr-only" />
                    {isSelected && <Check className="absolute top-1.5 right-1.5 h-3 w-3 text-orange-500" />}
                    <span className="text-xs font-medium">{opt.label}</span>
                    <span className="text-[10px] text-muted-foreground">{opt.desc}</span>
                  </Label>
                );
              })}
            </RadioGroup>
            <p className="text-[10px] text-muted-foreground">Controls how much time the model spends reasoning before responding</p>
          </div>
        ) : supportsTemperature ? (
          // Temperature slider for non-reasoning models
          <div key={`temp-${modelId}`} className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor={`${idPrefix}-temperature`} className="text-xs">
                Temperature
                <span className="text-[10px] text-muted-foreground ml-1">
                  ({tempRange.min} - {tempRange.max})
                </span>
              </Label>
              <span className="text-xs text-muted-foreground">{temperature.toFixed(1)}</span>
            </div>
            <Slider
              id={`${idPrefix}-temperature`}
              value={[temperature]}
              onValueChange={(values: number[]) => onTemperatureChange(values[0])}
              min={tempRange.min}
              max={tempRange.max}
              step={0.1}
              disabled={disabled}
              className="w-full"
            />
            <p className="text-[10px] text-muted-foreground">Lower = more focused, Higher = more creative</p>
          </div>
        ) : (
          // Fallback for models without temperature that aren't reasoning models
          <div key={`no-temp-${modelId}`} className="text-xs text-muted-foreground bg-muted/50 rounded-md p-3 space-y-1">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3 w-3" />
              <span className="font-medium">Fixed Parameters</span>
            </div>
            <p className="text-[10px] leading-relaxed">This model does not support temperature adjustment.</p>
          </div>
        ))}

      {/* Advanced Settings */}
      {showAdvanced && (
        <div className={`space-y-3 ${showTemperature ? "pt-2 border-t border-border/50" : ""}`}>
          {/* Max Tokens */}
          {onMaxTokensChange && (
            <div className="space-y-2">
              <Label htmlFor={`${idPrefix}-maxTokens`} className="text-xs">
                Max Tokens <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                id={`${idPrefix}-maxTokens`}
                type="number"
                value={maxTokens ?? ""}
                onChange={(e) => onMaxTokensChange(e.target.value ? Number(e.target.value) : undefined)}
                placeholder="e.g., 2000"
                className="text-sm"
                disabled={disabled}
                min={1}
              />
              <p className="text-[10px] text-muted-foreground">Maximum tokens in response</p>
            </div>
          )}

          {/* Max Retries */}
          {onMaxRetriesChange && (
            <div className="space-y-2">
              <Label htmlFor={`${idPrefix}-maxRetries`} className="text-xs">
                Max Retries
              </Label>
              <Input
                id={`${idPrefix}-maxRetries`}
                type="number"
                value={maxRetries ?? 2}
                onChange={(e) => onMaxRetriesChange(Number(e.target.value))}
                className="text-sm"
                disabled={disabled}
                min={0}
                max={10}
              />
              <p className="text-[10px] text-muted-foreground">Number of retry attempts on failure</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
