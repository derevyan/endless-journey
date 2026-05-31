/**
 * FollowUpStepEditor Component
 *
 * Editor for a single follow-up step with:
 * - Delay configuration (days, hours, minutes, seconds)
 * - Content textarea with character counter
 * - Buttons list with add/remove and target selection
 * - Exit on timeout toggle
 *
 * @module features/nodes/journey/editors/plugin-editors/follow-up-step-editor
 */

import { BellRing, ChevronDown, ChevronRight, Clock, Info, Plus, Trash2 } from "lucide-react";
import { memo, useCallback } from "react";

import { Button } from "@/shared/components/ui/button";
// import { Checkbox } from "@/shared/components/ui/checkbox"; // MEMO: Used by exitOnTimeout (hidden feature)
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/shared/components/ui/collapsible";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Textarea } from "@/shared/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { cn } from "@/shared/lib/utils";
import { generateButtonId } from "@/shared/lib/utils/id";
import type { Duration, FollowUpButton, FollowUpStep } from "@journey/schemas";

import { NodeSelectorPopover, type SelectableNode } from "../components/node-selector-popover";

// =============================================================================
// TYPES
// =============================================================================

interface FollowUpStepEditorProps {
  /** The step data to edit */
  step: FollowUpStep;
  /** Index of this step in the sequence */
  stepIndex: number;
  /** Available nodes for button targeting */
  availableNodes: SelectableNode[];
  /** Callback when step data changes */
  onUpdate: (updates: Partial<FollowUpStep>) => void;
  /** Callback to remove this step */
  onRemove: () => void;
  /** Callback when a button's target changes (for edge sync) */
  onButtonTargetChange: (buttonId: string, targetNodeId: string | undefined) => void;
  /** Whether the step is expanded */
  isExpanded: boolean;
  /** Toggle expansion */
  onToggleExpand: () => void;
  /** Read-only mode */
  readOnly?: boolean;
  /** Whether AI mode is enabled (changes labels and shows fallback field) */
  aiEnabled?: boolean;
  /** Sequence-level cancel on response setting (for dynamic default label) */
  cancelOnAnyResponse?: boolean;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Format duration for display
 */
function formatDelay(delay: Duration | undefined): string {
  if (!delay) return "Immediately";

  const parts: string[] = [];
  if (delay.days && delay.days > 0) parts.push(`${delay.days}d`);
  if (delay.hours && delay.hours > 0) parts.push(`${delay.hours}h`);
  if (delay.minutes && delay.minutes > 0) parts.push(`${delay.minutes}m`);
  if (delay.seconds && delay.seconds > 0) parts.push(`${delay.seconds}s`);

  return parts.length > 0 ? parts.join(" ") : "Immediately";
}

// =============================================================================
// DELAY INPUT COMPONENT
// =============================================================================

interface DelayInputProps {
  delay: Duration;
  onChange: (delay: Duration) => void;
  readOnly?: boolean;
}

function DelayInput({ delay, onChange, readOnly }: DelayInputProps) {
  const handleChange = useCallback(
    (field: keyof Duration, value: string) => {
      const numValue = value === "" ? undefined : parseInt(value, 10);
      onChange({ ...delay, [field]: numValue });
    },
    [delay, onChange]
  );

  return (
    <div className="grid grid-cols-4 gap-2">
      <div className="space-y-1">
        <Label className="text-[10px] text-muted-foreground">Days</Label>
        <Input
          type="number"
          min={0}
          max={7}
          value={delay.days ?? ""}
          onChange={(e) => handleChange("days", e.target.value)}
          placeholder="0"
          className="h-7 text-xs"
          disabled={readOnly}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-[10px] text-muted-foreground">Hours</Label>
        <Input
          type="number"
          min={0}
          max={23}
          value={delay.hours ?? ""}
          onChange={(e) => handleChange("hours", e.target.value)}
          placeholder="0"
          className="h-7 text-xs"
          disabled={readOnly}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-[10px] text-muted-foreground">Min</Label>
        <Input
          type="number"
          min={0}
          max={59}
          value={delay.minutes ?? ""}
          onChange={(e) => handleChange("minutes", e.target.value)}
          placeholder="0"
          className="h-7 text-xs"
          disabled={readOnly}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-[10px] text-muted-foreground">Sec</Label>
        <Input
          type="number"
          min={0}
          max={59}
          value={delay.seconds ?? ""}
          onChange={(e) => handleChange("seconds", e.target.value)}
          placeholder="0"
          className="h-7 text-xs"
          disabled={readOnly}
        />
      </div>
    </div>
  );
}

// =============================================================================
// BUTTON LIST COMPONENT
// =============================================================================

interface ButtonListProps {
  buttons: FollowUpButton[];
  availableNodes: SelectableNode[];
  onChange: (buttons: FollowUpButton[]) => void;
  onButtonTargetChange: (buttonId: string, targetNodeId: string | undefined) => void;
  readOnly?: boolean;
}

function ButtonList({ buttons, availableNodes, onChange, onButtonTargetChange, readOnly }: ButtonListProps) {
  const handleAddButton = useCallback(() => {
    const newButton: FollowUpButton = {
      id: generateButtonId(),
      text: "",
      targetNodeId: "",
    };
    onChange([...buttons, newButton]);
  }, [buttons, onChange]);

  const handleRemoveButton = useCallback(
    (index: number) => {
      const updated = [...buttons];
      updated.splice(index, 1);
      onChange(updated);
    },
    [buttons, onChange]
  );

  const handleUpdateButtonText = useCallback(
    (index: number, text: string) => {
      const updated = [...buttons];
      updated[index] = { ...updated[index], text };
      onChange(updated);
    },
    [buttons, onChange]
  );

  const handleSetTarget = useCallback(
    (buttonId: string, targetNodeId: string) => {
      const index = buttons.findIndex((b) => b.id === buttonId);
      if (index === -1) return;

      const updated = [...buttons];
      updated[index] = { ...updated[index], targetNodeId };
      onChange(updated);

      // Also notify parent for edge sync
      onButtonTargetChange(buttonId, targetNodeId || undefined);
    },
    [buttons, onChange, onButtonTargetChange]
  );

  const canAdd = buttons.length < 4;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-[10px] font-medium uppercase text-muted-foreground">Buttons</Label>
        {!readOnly && canAdd && (
          <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={handleAddButton}>
            <Plus className="h-3 w-3 mr-1" />
            Add
          </Button>
        )}
      </div>

      {buttons.length > 0 ? (
        <div className="space-y-2">
          {buttons.map((button, index) => {
            const charCount = button.text.length;
            const isOverLimit = charCount > 35;

            return (
              <div key={button.id} className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Input
                    value={button.text}
                    onChange={(e) => handleUpdateButtonText(index, e.target.value)}
                    maxLength={35}
                    className={cn("h-7 text-xs pr-12", isOverLimit && "border-destructive")}
                    placeholder="Button label..."
                    disabled={readOnly}
                  />
                  <span className={cn("absolute right-2 top-1/2 -translate-y-1/2 text-[9px]", isOverLimit ? "text-destructive" : "text-muted-foreground")}>
                    {charCount}/35
                  </span>
                </div>
                <NodeSelectorPopover
                  value={button.targetNodeId}
                  onChange={(nodeId) => handleSetTarget(button.id, nodeId)}
                  nodes={availableNodes}
                  disabled={readOnly}
                  placeholder="Target..."
                  className="w-[140px]"
                />
                {!readOnly && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => handleRemoveButton(index)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-[10px] text-muted-foreground py-1">No buttons. Add buttons for user interaction.</p>
      )}

      {!canAdd && <p className="text-[10px] text-muted-foreground">Maximum 4 buttons per step</p>}
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * Editor for a single follow-up step
 */
export const FollowUpStepEditor = memo(function FollowUpStepEditor({
  step,
  stepIndex,
  availableNodes,
  onUpdate,
  onRemove,
  onButtonTargetChange,
  isExpanded,
  onToggleExpand,
  readOnly = false,
  aiEnabled = false,
  cancelOnAnyResponse = true,
}: FollowUpStepEditorProps) {
  // Content change handler
  const handleContentChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onUpdate({ content: e.target.value });
    },
    [onUpdate]
  );

  // Fallback content change handler (for AI mode)
  const handleFallbackContentChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onUpdate({ fallbackContent: e.target.value });
    },
    [onUpdate]
  );

  // Delay change handler
  const handleDelayChange = useCallback(
    (delay: Duration) => {
      onUpdate({ delay });
    },
    [onUpdate]
  );

  // Buttons change handler
  const handleButtonsChange = useCallback(
    (buttons: FollowUpButton[]) => {
      onUpdate({ buttons });
    },
    [onUpdate]
  );

  // MEMO: exitOnTimeout feature hidden - uncomment when re-enabling
  // const handleExitOnTimeoutChange = useCallback(
  //   (checked: boolean) => {
  //     onUpdate({ exitOnTimeout: checked });
  //   },
  //   [onUpdate]
  // );

  const contentCharCount = step.content?.length ?? 0;
  const isContentOverLimit = contentCharCount > 4096;
  const buttonCount = step.buttons?.length ?? 0;

  // Content is no longer required when AI is enabled - defaults will be used
  const hasContentError = false;

  return (
    <div className="rounded-md border border-border/50 bg-muted/20">
      <Collapsible open={isExpanded} onOpenChange={onToggleExpand}>
        {/* Header */}
        <div className="flex w-full items-center gap-2 px-3 py-2 hover:bg-muted/30 transition-colors">
          <CollapsibleTrigger className="flex flex-1 items-center gap-2 text-left">
            <BellRing className={cn("size-3.5", hasContentError ? "text-destructive" : "text-muted-foreground")} />
            {isExpanded ? <ChevronDown className="size-3.5 text-muted-foreground" /> : <ChevronRight className="size-3.5 text-muted-foreground" />}
            <span className={cn("text-xs font-medium flex-1 text-left", hasContentError && "text-destructive")}>
              Step {stepIndex + 1}
              <span className="ml-2 text-muted-foreground font-normal">{formatDelay(step.delay)}</span>
            </span>
            {hasContentError && <span className="text-[10px] text-destructive bg-destructive/10 px-1.5 py-0.5 rounded">Required</span>}
            {buttonCount > 0 && !hasContentError && <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{buttonCount} btn</span>}
          </CollapsibleTrigger>
          {!readOnly && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        {/* Content */}
        <CollapsibleContent className="px-3 pb-3 space-y-4">
          {/* Delay */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="size-3.5" />
              <span>Send after delay:</span>
            </div>
            <DelayInput delay={step.delay} onChange={handleDelayChange} readOnly={readOnly} />
          </div>

          {/* Content */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className={cn("text-[10px] font-medium uppercase", hasContentError ? "text-destructive" : "text-muted-foreground")}>
                {aiEnabled ? "Task Instructions for AI" : "Message"}
                {aiEnabled && <span className="ml-1 text-destructive">*</span>}
              </Label>
              <span className={cn("text-[10px]", isContentOverLimit ? "text-destructive font-medium" : "text-muted-foreground")}>
                {contentCharCount.toLocaleString()}/4,096
              </span>
            </div>
            <Textarea
              value={step.content ?? ""}
              onChange={handleContentChange}
              placeholder={aiEnabled ? "e.g., Send a friendly reminder about their order status. Be warm and helpful." : "Enter follow-up message..."}
              className={cn("min-h-[80px] text-sm resize-y", hasContentError && "border-destructive focus-visible:ring-destructive")}
              disabled={readOnly}
            />
            {aiEnabled && (
              <p className="text-[10px] text-muted-foreground">
                {step.content?.trim()
                  ? "This is the prompt/instructions for AI generation."
                  : "Leave empty to use default instructions from AI settings."}
              </p>
            )}
          </div>

          {/* Fallback Content (only in AI mode) */}
          {aiEnabled && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] font-medium uppercase text-muted-foreground">
                  Fallback Message
                  <span className="ml-1 font-normal lowercase">(optional)</span>
                </Label>
                <span className="text-[10px] text-muted-foreground">{(step.fallbackContent?.length ?? 0).toLocaleString()}/4,096</span>
              </div>
              <Textarea
                value={step.fallbackContent ?? ""}
                onChange={handleFallbackContentChange}
                placeholder="Sent if AI generation fails. Leave empty to use task instructions as fallback."
                className="min-h-[60px] text-sm resize-y"
                disabled={readOnly}
              />
            </div>
          )}

          {/* Buttons */}
          <ButtonList
            buttons={step.buttons ?? []}
            availableNodes={availableNodes}
            onChange={handleButtonsChange}
            onButtonTargetChange={onButtonTargetChange}
            readOnly={readOnly}
          />

          {/* If User Replies */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Label className="text-[10px] font-medium uppercase text-muted-foreground">If User Replies</Label>
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="size-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p className="text-xs max-w-[200px]">
                      Override the sequence-level setting for this step only
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Select
              value={step.onResponse ?? "default"}
              onValueChange={(value) => {
                onUpdate({ onResponse: value === "default" ? undefined : (value as "cancel" | "continue" | "exit") });
              }}
              disabled={readOnly}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Default" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">
                  {cancelOnAnyResponse ? "Default (Stop sending)" : "Default (Keep sending)"}
                </SelectItem>
                <SelectItem value="cancel">Stop sending</SelectItem>
                <SelectItem value="continue">Keep sending</SelectItem>
                <SelectItem value="exit">Exit sequence</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground">What happens if user replies during this step</p>
          </div>

          {/* MEMO: exitOnTimeout feature hidden - advanced option for mid-sequence exits.
              Most users just define the exact number of steps they need.
              Keeping code for potential future use. Engine still supports it.

          <div className="flex items-start space-x-2 pt-2 border-t border-border/30">
            <Checkbox
              id={`exit-${step.id}`}
              checked={step.exitOnTimeout ?? false}
              onCheckedChange={handleExitOnTimeoutChange}
              disabled={readOnly}
              className="mt-0.5"
            />
            <div className="space-y-1">
              <Label htmlFor={`exit-${step.id}`} className="text-xs cursor-pointer">
                End sequence after this step
              </Label>
              <p className="text-[10px] text-muted-foreground">
                Stops further follow-ups. If exit path is configured, transitions after waiting for user response.
              </p>
            </div>
          </div>
          */}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
});
