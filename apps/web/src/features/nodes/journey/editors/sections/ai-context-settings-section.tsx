/**
 * AIContextSettingsSection
 *
 * Reusable collapsible section for AI context configuration.
 * Used by Agent Node Editor and Follow-Up Plugin Editor.
 *
 * Features:
 * - Optional model selector (for follow-up, agent uses workflow model)
 * - Context toggles (user profile, node context, session context)
 * - Custom context with TemplateTextarea for variable highlighting
 * - Optional enabled toggle (for follow-up plugin)
 */

import { ChevronDown, Info, Sparkles } from "lucide-react";
import { memo, useCallback, useEffect, useRef, useState } from "react";

import { ModelSelectorPopover } from "@/shared/components/model-selector-popover";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/shared/components/ui/collapsible";
import { CollapsibleSection } from "@/shared/components/ui/collapsible-section";
import { Label } from "@/shared/components/ui/label";
import { Switch } from "@/shared/components/ui/switch";
import { TemplateProvider } from "@/shared/components/ui/template-context";
import { TemplateTextarea } from "@/shared/components/ui/template-textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { cn } from "@/shared/lib/utils";
import type { AIContextSettings } from "@journey/schemas";
import { useNodeEditorContext } from "../../hooks/use-node-editor-context";

// =============================================================================
// TYPES
// =============================================================================

export interface AIContextSettingsSectionProps {
  /** Current AI context values */
  values: AIContextSettings | undefined;
  /** Callback when any field changes */
  onChange: (updates: Partial<AIContextSettings>) => void;
  /** Node ID for TemplateProvider context */
  nodeId: string;
  /** Read-only mode */
  readOnly?: boolean;
  /** Section open state */
  open?: boolean;
  /** Section open state change handler */
  onOpenChange?: (open: boolean) => void;
  /** Show model selector (Agent=false, FollowUp=true) */
  showModelSelector?: boolean;
  /** Show enabled toggle (for follow-up plugin) */
  showEnabledToggle?: boolean;
  /** Callback when enabled toggle changes */
  onEnabledChange?: (enabled: boolean) => void;
  /** Whether AI is enabled (for follow-up plugin) */
  isEnabled?: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

export const AIContextSettingsSection = memo(function AIContextSettingsSection({
  values,
  onChange,
  nodeId,
  readOnly = false,
  open,
  onOpenChange,
  showModelSelector = false,
  showEnabledToggle = false,
  onEnabledChange,
  isEnabled = false,
}: AIContextSettingsSectionProps) {
  // Get nodes and edges for TemplateProvider
  const { nodes, edges, journeyUuid } = useNodeEditorContext();

  // Ref for cursor position in TemplateTextarea
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Track animation state - icon should be colored only during spin animation
  const [isAnimating, setIsAnimating] = useState(false);

  // Trigger animation when enabled changes to true
  useEffect(() => {
    if (isEnabled) {
      setIsAnimating(true);
    }
  }, [isEnabled]);

  // Check if any values are configured (for badge)
  const hasConfiguration =
    values?.customContext ||
    values?.model ||
    values?.includeUserProfile === false ||
    values?.includeNodeContext === false ||
    values?.includeSessionContext === true;

  // Field change handlers
  const handleUserProfileChange = useCallback(
    (checked: boolean) => {
      onChange({ includeUserProfile: checked });
    },
    [onChange]
  );

  const handleNodeContextChange = useCallback(
    (checked: boolean) => {
      onChange({ includeNodeContext: checked });
    },
    [onChange]
  );

  const handleSessionContextChange = useCallback(
    (checked: boolean) => {
      onChange({ includeSessionContext: checked });
    },
    [onChange]
  );

  const handleCustomContextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange({ customContext: e.target.value });
    },
    [onChange]
  );

  const handleModelChange = useCallback(
    (modelId: string) => {
      onChange({ model: modelId || undefined });
    },
    [onChange]
  );

  // Advanced section state for custom context
  const hasCustomContext = !!values?.customContext;

  // Main content (always shown when section is open)
  const renderContent = () => (
    <div className="space-y-4">
      {/* Model Selector (optional) */}
      {showModelSelector && (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Model</Label>
          <ModelSelectorPopover
            value={values?.model ?? ""}
            onChange={handleModelChange}
            placeholder="Default (Gemini Flash 3)"
            className="w-full"
            disabled={readOnly}
          />
        </div>
      )}

      {/* Context Toggles */}
      <div className="space-y-3">
        {/* User Profile Toggle */}
        <div className="flex items-center justify-between py-2">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <span className="text-sm">Include User Profile</span>
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="size-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <div className="text-xs space-y-1">
                      <p className="font-medium">Adds to AI context:</p>
                      <ul className="list-disc list-inside space-y-0.5">
                        <li>Name / first name</li>
                        <li>Username</li>
                        <li>Email, phone, language, timezone</li>
                      </ul>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <p className="text-[10px] text-muted-foreground">User's name, contact info, and preferences</p>
          </div>
          <Switch checked={values?.includeUserProfile ?? true} onCheckedChange={handleUserProfileChange} disabled={readOnly} />
        </div>

        {/* Node Context Toggle */}
        <div className="flex items-center justify-between py-2">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <span className="text-sm">Include Node Context</span>
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="size-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <div className="text-xs space-y-1">
                      <p className="font-medium">Smart extraction by node type:</p>
                      <ul className="list-disc list-inside space-y-0.5">
                        <li>Agent: recent conversation</li>
                        <li>Questionnaire: Q&A table</li>
                        <li>Message: user selection</li>
                      </ul>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <p className="text-[10px] text-muted-foreground">Previous node output (formatted by type)</p>
          </div>
          <Switch checked={values?.includeNodeContext ?? true} onCheckedChange={handleNodeContextChange} disabled={readOnly} />
        </div>

        {/* Session Context Toggle */}
        <div className="flex items-center justify-between py-2">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <span className="text-sm">Include Session Context</span>
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="size-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <div className="text-xs space-y-1">
                      <p className="font-medium">Adds to AI context:</p>
                      <ul className="list-disc list-inside space-y-0.5">
                        <li>User tags</li>
                        <li>All session variables</li>
                        <li>Last 10 messages</li>
                      </ul>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <p className="text-[10px] text-muted-foreground">Full context: variables, history, tags (uses more tokens)</p>
          </div>
          <Switch checked={values?.includeSessionContext ?? false} onCheckedChange={handleSessionContextChange} disabled={readOnly} />
        </div>
      </div>

      {/* Custom Context (Advanced) */}
      <Collapsible defaultOpen={hasCustomContext}>
        <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full">
          <ChevronDown className="size-3.5 transition-transform data-[state=open]:rotate-180" />
          <span>Custom Context</span>
          {hasCustomContext && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">Configured</span>}
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="pt-3 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Label className="text-xs text-muted-foreground">Custom Context Template</Label>
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="size-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <div className="text-xs space-y-1">
                      <p className="font-medium">Build your own context:</p>
                      <ul className="list-disc list-inside space-y-0.5">
                        <li>Use {"{{variable}}"} syntax</li>
                        <li>Access any session data</li>
                        <li>Format as needed for AI</li>
                      </ul>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <TemplateProvider nodeId={nodeId} nodes={nodes} edges={edges} journeyId={journeyUuid}>
              <TemplateTextarea
                textareaRef={textareaRef}
                value={values?.customContext ?? ""}
                onChange={handleCustomContextChange}
                placeholder={"Order ID: {{order.id}}\nStatus: {{order.status}}\nCustomer tier: {{user.tier}}"}
                className="min-h-[80px] text-sm font-mono resize-y"
                disabled={readOnly}
              />
            </TemplateProvider>
            <p className="text-[10px] text-muted-foreground">Build custom context using {"{{variables}}"} from your journey.</p>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );

  // If enabled toggle is shown, render as a toggle section
  if (showEnabledToggle) {
    return (
      <div className="rounded-md border border-border/50 bg-muted/10">
        {/* AI Generation Toggle */}
        <div className="flex items-center justify-between py-2 px-3">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "p-1.5 rounded-lg transition-colors duration-300",
                isAnimating ? "bg-sky-500/20 text-sky-500" : "bg-muted text-muted-foreground"
              )}
            >
              <Sparkles
                className={cn(
                  "size-4 transition-all duration-500",
                  isAnimating && "animate-[spin_0.5s_ease-out]"
                )}
                onAnimationEnd={() => setIsAnimating(false)}
              />
            </div>
            <div>
              <div className="text-sm font-medium">AI-Generated Messages</div>
              <div className="text-xs text-muted-foreground">Use LLM to personalize follow-ups</div>
            </div>
          </div>
          <Switch checked={isEnabled} onCheckedChange={onEnabledChange} disabled={readOnly} />
        </div>

        {/* AI Configuration (shown when enabled) - smooth height animation */}
        <div
          className={cn(
            "grid transition-[grid-template-rows] duration-300 ease-out",
            isEnabled ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          )}
        >
          <div className="overflow-hidden">
            <div className="px-3 pb-3">
              {renderContent()}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Regular collapsible section
  return (
    <CollapsibleSection open={open} onOpenChange={onOpenChange} icon={Sparkles} label="AI Context" badge={hasConfiguration ? "Configured" : undefined}>
      {renderContent()}
    </CollapsibleSection>
  );
});
