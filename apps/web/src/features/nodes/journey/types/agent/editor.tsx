/**
 * AgentNodeEditor Component
 *
 * Editor for Agent Workflow node type - workflow-only mode.
 * All agent logic (prompts, LLM config, tools) lives in the referenced workflow.
 *
 * Features:
 * - Workflow selector (required)
 * - Execution mode selector (immediate, welcome_first, wait_for_input)
 * - Welcome message configuration (for welcome_first mode)
 * - Initial prompt configuration (for immediate mode)
 * - Timeout configuration (optional)
 * - Voice provider selection (OpenAI or ElevenLabs)
 * - Common sections (tags, variables, CRM, metadata)
 */

import { ExpandableTextEditor } from "@/shared/components/ui/expandable-text-editor";
import { Label } from "@/shared/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { TemplateProvider } from "@/shared/components/ui/template-context";
import { TemplateTextarea } from "@/shared/components/ui/template-textarea";
import { getElevenLabsVoices } from "@/shared/lib/api/audio";
import { ELEVENLABS_TTS_MODELS, getDefaultVoiceForProvider, getVoicesForProvider } from "@journey/schemas/config";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, Cpu, Info, MessageSquare, Mic, RefreshCw, Send, Workflow, Zap } from "lucide-react";
import { useCallback, useState, useTransition } from "react";

import { CollapsibleSection } from "@/shared/components/ui/collapsible-section";
import { VoiceCombobox } from "../../editors/components/voice-combobox";
import { WorkflowEditLink } from "../../editors/components/workflow-edit-link";
import { WorkflowSelector } from "../../editors/components/workflow-selector";
import type { StringFieldApi } from "../../forms/form-types";

import type { AIContextSettings } from "@journey/schemas";
import { Switch } from "@/shared/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { EditorBase } from "../../editors/editor-base";
import { EditorNameField } from "../../editors/editor-common-fields";
import { EditorCommonSections } from "../../editors/editor-common-sections";
import { AIContextSettingsSection } from "../../editors/sections/ai-context-settings-section";
import { DurationInput } from "../../editors/sections/duration-input";
import type { NodeEditorProps } from "../../editors/types";
import { useNodeEditorContext } from "../../hooks/use-node-editor-context";
import { useFormFieldValue, useNodeEditorForm } from "../../hooks/use-node-editor-form";
import type { BooleanFieldApi } from "../../forms/form-types";

export function AgentNodeEditor({ node, onClose, onDelete, readOnly }: NodeEditorProps) {
  const { form, isDirty, isSaving, validateAndSave, validationErrors, resetForm } = useNodeEditorForm(node);
  const { nodes, edges, journeyUuid } = useNodeEditorContext();
  const queryClient = useQueryClient();

  // Subscribe to voiceMode and voiceProvider for conditional voice rendering
  const voiceMode = useFormFieldValue(form, "voiceMode") as string | undefined;
  const voiceProvider = useFormFieldValue(form, "voiceProvider") as "openai" | "elevenlabs" | undefined;
  const effectiveProvider = voiceProvider || "openai";

  // Query for ElevenLabs voices (with fallback to hardcoded)
  // Extended cache: voices rarely change (monthly at most), backend also caches in Redis
  const { data: elevenLabsVoicesData, isLoading: isLoadingVoices } = useQuery({
    queryKey: ["elevenlabs-voices"],
    queryFn: () => getElevenLabsVoices(),
    enabled: effectiveProvider === "elevenlabs",
    staleTime: 1000 * 60 * 60, // 1 hour (data rarely changes)
    gcTime: 1000 * 60 * 60 * 24, // 24 hours in memory
  });

  // Track refresh loading state separately (fetchQuery doesn't update useQuery's isFetching)
  const [isRefreshing, startRefreshTransition] = useTransition();

  // Handler to force refresh voices from ElevenLabs API (bypasses backend Redis cache)
  const handleRefreshVoices = () => {
    startRefreshTransition(async () => {
      // Fetch fresh voices with refresh=true - updates React Query cache directly
      // staleTime: 0 forces a fresh fetch even if cached data exists
      // Note: Don't use invalidateQueries - it triggers a background refetch with
      // the original queryFn (without refresh=true), causing a race condition
      await queryClient.fetchQuery({
        queryKey: ["elevenlabs-voices"],
        queryFn: () => getElevenLabsVoices(true),
        staleTime: 0, // Force fresh fetch, ignore cache freshness
      });
    });
  };

  // Get voices for current provider (API voices or fallback to hardcoded)
  const currentVoices =
    effectiveProvider === "elevenlabs"
      ? elevenLabsVoicesData?.voices || getVoicesForProvider("elevenlabs")
      : getVoicesForProvider("openai");

  const [timeoutOpen, setTimeoutOpen] = useState(false);
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [initialPromptOpen, setInitialPromptOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [aiContextOpen, setAiContextOpen] = useState(false);

  // Get reactive values for conditional rendering
  const timeoutValue = useFormFieldValue(form, "timeout");
  const hasTimeout =
    timeoutValue && (timeoutValue as { seconds?: number }).seconds && (timeoutValue as { seconds: number }).seconds > 0;

  const executionModeValue = useFormFieldValue(form, "executionMode") as string | undefined;
  const effectiveMode = executionModeValue || "immediate"; // Default to immediate

  const welcomeValue = useFormFieldValue(form, "welcome") as { message?: string } | undefined;
  const hasWelcome = !!welcomeValue?.message;

  const initialPromptValue = useFormFieldValue(form, "initialPrompt") as { template?: string } | undefined;
  const hasInitialPrompt = !!initialPromptValue?.template;

  const aiContextValue = useFormFieldValue(form, "aiContext") as AIContextSettings | undefined;

  // Handler for AI context changes
  const handleAiContextChange = useCallback(
    (updates: Partial<AIContextSettings>) => {
      const current = aiContextValue ?? {};
      form.setFieldValue("aiContext", { ...current, ...updates });
    },
    [form, aiContextValue]
  );

  // Cancel handler: reset form (does not close editor)
  const handleCancel = useCallback(() => {
    resetForm();
  }, [resetForm]);

  return (
    <EditorBase
      title={readOnly ? "Agent Info" : "Edit Agent"}
      nodeId={node.id}
      onClose={onClose}
      onDelete={onDelete}
      onAutoSaveClose={validateAndSave}
      onSave={validateAndSave}
      onCancel={handleCancel}
      isSaving={isSaving}
      isDirty={isDirty}
      readOnly={readOnly}
    >
      {/* 1. Name */}
      <EditorNameField form={form} nodeId={node.id} readOnly={readOnly} />

      {/* 2. Workflow Selector (Required) */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Workflow className="h-4 w-4" />
          <Label className="text-xs font-medium">
            Agent <span className="text-destructive">*</span>
          </Label>
        </div>
        <p className="text-xs text-muted-foreground">
          Select a workflow to handle this agent's logic. All configuration lives in the workflow canvas.
        </p>
        <form.Field name="workflowKey">
          {(field: StringFieldApi) => (
            <div className="space-y-2">
              <WorkflowSelector
                value={field.state.value}
                onChange={(value) => field.handleChange(value || "")}
                disabled={readOnly}
                hasError={field.state.meta.errors?.length > 0}
              />
              <div className="flex justify-end">
                <WorkflowEditLink workflowKey={field.state.value} />
              </div>
              {field.state.meta.errors && field.state.meta.errors.length > 0 && (
                <p className="text-xs text-destructive">{field.state.meta.errors.join(", ")}</p>
              )}
              {!field.state.value && !field.state.meta.errors?.length && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Select a workflow to configure the agent's behavior
                </p>
              )}
            </div>
          )}
        </form.Field>
      </div>

      {/* 3. Execution Mode */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Cpu className="h-4 w-4" />
          <Label className="text-xs font-medium">Execution Mode</Label>
        </div>
        <form.Field name="executionMode">
          {(field: StringFieldApi) => (
            <Select value={field.state.value || "immediate"} onValueChange={field.handleChange} disabled={readOnly}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="welcome_first">
                  <span className="flex items-center gap-2">
                    <MessageSquare className="h-3.5 w-3.5" />
                    Welcome First
                  </span>
                </SelectItem>
                <SelectItem value="immediate">
                  <span className="flex items-center gap-2">
                    <Zap className="h-3.5 w-3.5" />
                    Immediate
                  </span>
                </SelectItem>
                <SelectItem value="wait_for_input">
                  <span className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5" />
                    Wait for Input
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          )}
        </form.Field>
        <p className="text-[10px] text-muted-foreground">
          {effectiveMode === "welcome_first" && "Send welcome message, wait for user response, then start workflow."}
          {effectiveMode === "immediate" && "Execute workflow immediately when node is reached."}
          {effectiveMode === "wait_for_input" && "Wait for user message before any execution."}
        </p>
      </div>

      {/* 3.5 Typing Indicator Toggle */}
      <div className="flex items-center justify-between py-2">
        <div className="flex items-center gap-2">
          <Label className="text-xs font-medium">Typing Indicator</Label>
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="size-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top">
                <p className="text-xs max-w-[200px]">
                  Show "typing..." while processing messages (Telegram)
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <form.Field name="typingIndicatorEnabled">
          {(field: BooleanFieldApi) => (
            <Switch
              checked={field.state.value ?? true}
              onCheckedChange={field.handleChange}
              disabled={readOnly}
            />
          )}
        </form.Field>
      </div>

      {/* 4. Welcome Message (only for welcome_first mode) */}
      {effectiveMode === "welcome_first" && (
        <CollapsibleSection
          open={welcomeOpen}
          onOpenChange={setWelcomeOpen}
          icon={MessageSquare}
          label="Welcome Message"
          badge={hasWelcome ? "Configured" : undefined}
        >
          <p className="text-xs text-muted-foreground">
            Message sent when user first enters this node. Type {"{{"} to see available variables.
          </p>
          <form.Field name="welcome.message">
            {(field: StringFieldApi) => (
              <TemplateProvider nodeId={node.id} nodes={nodes} edges={edges} journeyId={journeyUuid}>
                <TemplateTextarea
                  value={field.state.value || ""}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder="Hello {{user.firstName}}! How can I help you today?"
                  className="min-h-[100px] text-sm resize-y"
                  disabled={readOnly}
                />
              </TemplateProvider>
            )}
          </form.Field>
        </CollapsibleSection>
      )}

      {/* 5. Initial Prompt (only for immediate mode) */}
      {effectiveMode === "immediate" && (
        <CollapsibleSection
          open={initialPromptOpen}
          onOpenChange={setInitialPromptOpen}
          icon={Send}
          label="Initial Prompt"
          badge={hasInitialPrompt ? "Configured" : undefined}
        >
          <p className="text-xs text-muted-foreground">
            Message to kick off the workflow on first execution. After this, subsequent turns use the user's messages.
          </p>
          <form.Field name="initialPrompt.template">
            {(field: StringFieldApi) => (
              <ExpandableTextEditor
                value={field.state.value || ""}
                onChange={field.handleChange}
                editable={!readOnly}
                title="Initial Prompt"
              >
                <TemplateProvider nodeId={node.id} nodes={nodes} edges={edges} journeyId={journeyUuid}>
                  <TemplateTextarea
                    value={field.state.value || ""}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    placeholder="Send a greeting to the user. Their name is {{user.firstName}}."
                    className="min-h-[80px] text-sm"
                    disabled={readOnly}
                  />
                </TemplateProvider>
              </ExpandableTextEditor>
            )}
          </form.Field>
          <p className="text-[10px] text-muted-foreground">
            Leave empty to use the last user message as input. Type {"{{"} to see available variables.
          </p>
        </CollapsibleSection>
      )}

      {/* 6. Timeout Configuration (Collapsible) */}
      <CollapsibleSection
        open={timeoutOpen}
        onOpenChange={setTimeoutOpen}
        icon={Clock}
        label="Timeout"
        badge={hasTimeout ? "Configured" : undefined}
      >
        <p className="text-xs text-muted-foreground">Handle inactive conversations with a timeout edge</p>

        <DurationInput nodeId={node.id} fieldPrefix="timeout" form={form} readOnly={readOnly} />

        <form.Field name="timeoutMessage">
          {(field: StringFieldApi) => (
            <div className="space-y-2">
              <Label htmlFor={`timeoutMessage-${node.id}`} className="text-xs">
                Timeout Message <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <TemplateProvider nodeId={node.id} nodes={nodes} edges={edges} journeyId={journeyUuid}>
                <TemplateTextarea
                  id={`timeoutMessage-${node.id}`}
                  value={field.state.value || ""}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder="Message to send when conversation times out"
                  className="min-h-[80px] text-sm resize-y"
                  disabled={readOnly}
                />
              </TemplateProvider>
              <p className="text-[10px] text-muted-foreground">Type {"{{"} for variables.</p>
            </div>
          )}
        </form.Field>
      </CollapsibleSection>

      {/* 7. Voice Response Mode (Telegram-specific) */}
      <CollapsibleSection
        open={voiceOpen}
        onOpenChange={setVoiceOpen}
        icon={Mic}
        label="Voice Response"
        badge={voiceMode && voiceMode !== "text-only" ? "Enabled" : undefined}
      >
        <p className="text-xs text-muted-foreground">Configure voice responses for Telegram voice messages</p>

        <form.Field name="voiceMode">
          {(field: StringFieldApi) => (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Response Mode</Label>
              <Select value={field.state.value || "text-only"} onValueChange={field.handleChange} disabled={readOnly}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text-only">Text only</SelectItem>
                  <SelectItem value="voice-to-voice">Reply voice to voice</SelectItem>
                  <SelectItem value="voice-only">Voice only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </form.Field>

        {voiceMode && voiceMode !== "text-only" && (
          <>
            {/* Voice Provider Selector */}
            <form.Field name="voiceProvider">
              {(field: StringFieldApi) => (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Voice Provider</Label>
                  <Select
                    value={field.state.value || "openai"}
                    onValueChange={(value) => {
                      field.handleChange(value);
                      // Reset voice to provider's default when switching
                      const newDefault = getDefaultVoiceForProvider(value as "openai" | "elevenlabs");
                      form.setFieldValue("voiceProfile", newDefault);
                    }}
                    disabled={readOnly}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="openai">OpenAI</SelectItem>
                      <SelectItem value="elevenlabs">ElevenLabs</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </form.Field>

            {/* Voice Profile Selector */}
            <form.Field name="voiceProfile">
              {(field: StringFieldApi) => (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Voice</Label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <VoiceCombobox
                        voices={currentVoices}
                        value={field.state.value || getDefaultVoiceForProvider(effectiveProvider)}
                        onChange={field.handleChange}
                        disabled={readOnly}
                        placeholder="Select voice..."
                        isLoading={effectiveProvider === "elevenlabs" && (isLoadingVoices || isRefreshing)}
                      />
                    </div>
                    {effectiveProvider === "elevenlabs" && (
                      <button
                        type="button"
                        onClick={handleRefreshVoices}
                        disabled={readOnly || isRefreshing}
                        className="p-2 hover:bg-muted rounded-md disabled:opacity-50"
                        title="Refresh voices from ElevenLabs"
                      >
                        <RefreshCw className={`h-4 w-4 text-muted-foreground ${isRefreshing ? "animate-spin" : ""}`} />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </form.Field>

            {/* ElevenLabs Model Selector */}
            {effectiveProvider === "elevenlabs" && (
              <form.Field name="elevenLabsModel">
                {(field: StringFieldApi) => (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Model</Label>
                    <Select
                      value={field.state.value || "eleven_multilingual_v2"}
                      onValueChange={field.handleChange}
                      disabled={readOnly}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ELEVENLABS_TTS_MODELS.multilingual_v2.id}>
                          {ELEVENLABS_TTS_MODELS.multilingual_v2.label}
                        </SelectItem>
                        <SelectItem value={ELEVENLABS_TTS_MODELS.v3.id}>{ELEVENLABS_TTS_MODELS.v3.label}</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] text-muted-foreground">
                      {field.state.value === ELEVENLABS_TTS_MODELS.v3.id
                        ? ELEVENLABS_TTS_MODELS.v3.description
                        : ELEVENLABS_TTS_MODELS.multilingual_v2.description}
                    </p>
                  </div>
                )}
              </form.Field>
            )}
          </>
        )}
      </CollapsibleSection>

      {/* 8. AI Context (Additional context for workflow system prompt) */}
      <AIContextSettingsSection
        values={aiContextValue}
        onChange={handleAiContextChange}
        nodeId={node.id}
        readOnly={readOnly}
        open={aiContextOpen}
        onOpenChange={setAiContextOpen}
        showModelSelector={false}
        showEnabledToggle={false}
      />

      {/* 10. Common Sections (Tags, Variables, CRM, Metadata, Advanced) */}
      <EditorCommonSections
        form={form}
        nodeId={node.id}
        nodeType={node.data.type}
        readOnly={readOnly}
        validationErrors={validationErrors}
      />
    </EditorBase>
  );
}
