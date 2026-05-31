/**
 * Agent Node Config
 *
 * Configuration panel for Agent workflow nodes.
 * Includes model selection, unified tools, history, and memory settings.
 * Uses TanStack Form for explicit save pattern.
 *
 * @module features/nodes/workflow/definitions/agent/agent-node-config
 */

import { agentWorkflowStore } from "@/features/agent-workflows/stores/agent-workflow-store";
import type { ConversationHistoryConfig, ConversationHistoryStrategy, MemoryConfig, ResponseFormat, ToolExecutionTiming } from "@journey/schemas";
import { llmConfig } from "@journey/schemas";
import { useStore } from "@tanstack/react-store";
import { AlertTriangle, Brain, Database, FileOutput, History, PenLine, Wrench } from "lucide-react";
import { useCallback, useState } from "react";
import type { WorkflowNodeEditorProps } from "../../registry/types";

import { UnifiedToolSelector } from "@/features/agent-workflows/components/config-panel/unified-tool-selector";
import { useWorkflowFormFieldValue } from "@/features/nodes/workflow/hooks/use-workflow-node-form";
import { ConversationHistorySection, MemorySection } from "@/features/nodes/journey/editors/sections/agent-config";
import { PromptSelector } from "@/features/prompts/components";
import { usePrompts } from "@/features/prompts/hooks";
import { ModelConfigPanel } from "@/shared/components/model-config-panel";
import { ModelSelectorPopover } from "@/shared/components/model-selector-popover";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { CollapsibleSection } from "@/shared/components/ui/collapsible-section";
import { ExpandableTextEditor } from "@/shared/components/ui/expandable-text-editor";
import { Tabs, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
// import { Input } from "@/shared/components/ui/input"; // Commented out - Output Variable UI hidden for now
import { Label } from "@/shared/components/ui/label";
import { Switch } from "@/shared/components/ui/switch";
import { TemplateProvider } from "@/shared/components/ui/template-context";
import { Textarea } from "@/shared/components/ui/textarea";
import { OutputFormatSection, buildDefaultSchema } from "./output-format-section";

export function AgentNodeConfig({ form, nodeId }: WorkflowNodeEditorProps) {
  // Section open states
  const [toolsOpen, setToolsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [outputOpen, setOutputOpen] = useState(false);

  // Subscribe to form values for reactive updates
  const model = useWorkflowFormFieldValue<string>(form, "model") ?? llmConfig.agent.model.id;
  const temperature = useWorkflowFormFieldValue<number>(form, "temperature") ?? 0.7;
  const reasoningEffort = useWorkflowFormFieldValue<"low" | "medium" | "high">(form, "reasoningEffort");
  // Prompt source: inline or repository
  const promptSource = useWorkflowFormFieldValue<"inline" | "repository">(form, "promptSource") ?? "inline";
  const systemPrompt = useWorkflowFormFieldValue<string>(form, "systemPrompt") ?? "";
  const promptRefName = useWorkflowFormFieldValue<string>(form, "promptRefName");
  const promptRefVersionId = useWorkflowFormFieldValue<string>(form, "promptRefVersionId");
  const promptRefLabel = useWorkflowFormFieldValue<string>(form, "promptRefLabel") ?? "production";
  const promptVariables = useWorkflowFormFieldValue<Record<string, string>>(form, "promptVariables") ?? {};
  const enabledTools = useWorkflowFormFieldValue<string[]>(form, "enabledTools") ?? [];
  const toolTimingOverrides = useWorkflowFormFieldValue<Record<string, ToolExecutionTiming>>(form, "toolTimingOverrides");

  // Get workflow nodes for variable source extraction (used in TemplateProvider)
  const workflowNodes = useStore(agentWorkflowStore, (s) => s.nodes);

  // Get prompts to determine selected prompt type for warning display
  const { data: promptsData } = usePrompts();
  const selectedPrompt = promptsData?.prompts.find((p) => p.name === promptRefName);
  // Text prompt if: inline mode OR repository prompt with type="text"
  const isTextPrompt = promptSource === "inline" || selectedPrompt?.type === "text";

  // Handler for prompt variable mappings change
  const handlePromptVariablesChange = useCallback(
    (mappings: Record<string, string>) => {
      form.setFieldValue("promptVariables", mappings);
    },
    [form]
  );
  const historyStrategy = useWorkflowFormFieldValue<ConversationHistoryStrategy>(form, "historyStrategy");
  const historyMaxMessages = useWorkflowFormFieldValue<number>(form, "historyMaxMessages");
  const memoryEnabled = useWorkflowFormFieldValue<boolean>(form, "memoryEnabled");
  const memoryMaxResults = useWorkflowFormFieldValue<number>(form, "memoryMaxResults");
  const responseFormatType = useWorkflowFormFieldValue<"text" | "json_schema">(form, "responseFormatType");
  const responseFormatName = useWorkflowFormFieldValue<string>(form, "responseFormatName");
  const responseFormatSchema = useWorkflowFormFieldValue<string>(form, "responseFormatSchema");
  // const outputVariable = useWorkflowFormFieldValue<string>(form, "outputVariable") ?? ""; // Commented out - Output Variable UI hidden for now
  const enableQuickReplies = useWorkflowFormFieldValue<boolean>(form, "enableQuickReplies") ?? false;

  // Handler for unified tools selection
  const handleToolsSelectionChange = useCallback(
    (toolIds: string[]) => {
      form.setFieldValue("enabledTools", toolIds);
    },
    [form]
  );

  // Handler for tool timing changes
  const handleToolTimingChange = useCallback(
    (toolId: string, timing: ToolExecutionTiming) => {
      form.setFieldValue("toolTimingOverrides", {
        ...(toolTimingOverrides ?? {}),
        [toolId]: timing,
      });
    },
    [form, toolTimingOverrides]
  );

  // Convert form values to history config for section
  const historyConfig: Partial<ConversationHistoryConfig> = {
    strategy: historyStrategy,
    maxMessages: historyMaxMessages,
  };

  // Handler for history config changes
  const handleHistoryUpdate = useCallback(
    (updates: Partial<ConversationHistoryConfig>) => {
      if (updates.strategy !== undefined) {
        form.setFieldValue("historyStrategy", updates.strategy as ConversationHistoryStrategy);
      }
      if (updates.maxMessages !== undefined) {
        form.setFieldValue("historyMaxMessages", updates.maxMessages);
      }
    },
    [form]
  );

  // Convert form values to memory config for section
  const memoryConfig: Partial<MemoryConfig> = {
    enabled: memoryEnabled,
    maxResults: memoryMaxResults,
  };

  // Handler for memory config changes
  const handleMemoryUpdate = useCallback(
    (updates: Partial<MemoryConfig>) => {
      if (updates.enabled !== undefined) {
        form.setFieldValue("memoryEnabled", updates.enabled);
      }
      if (updates.maxResults !== undefined) {
        form.setFieldValue("memoryMaxResults", updates.maxResults);
      }
    },
    [form]
  );

  // Convert form values to response format for section
  // Note: JSON.parse is safe here - invalid JSON will result in empty schema
  let parsedSchema = {};
  if (responseFormatSchema) {
    try {
      parsedSchema = JSON.parse(responseFormatSchema);
    } catch {
      // Invalid JSON - use empty schema
    }
  }

  const responseFormat: ResponseFormat | undefined =
    responseFormatType === "json_schema" && responseFormatName
      ? {
          type: "json_schema",
          name: responseFormatName,
          schema: parsedSchema,
          strict: true,
          method: "functionCalling",
        }
      : responseFormatType === "text"
      ? { type: "text" }
      : undefined;

  // Handler for response format changes
  const handleResponseFormatUpdate = useCallback(
    (format: ResponseFormat | undefined) => {
      if (!format) {
        form.setFieldValue("responseFormatType", undefined);
        form.setFieldValue("responseFormatName", undefined);
        form.setFieldValue("responseFormatSchema", undefined);
      } else if (format.type === "text") {
        form.setFieldValue("responseFormatType", "text");
        form.setFieldValue("responseFormatName", undefined);
        form.setFieldValue("responseFormatSchema", undefined);
      } else if (format.type === "json_schema") {
        form.setFieldValue("responseFormatType", "json_schema");
        form.setFieldValue("responseFormatName", format.name);
        form.setFieldValue("responseFormatSchema", JSON.stringify(format.schema, null, 2));
      }
    },
    [form]
  );

  // Count of enabled unified tools for badge
  const toolsCount = enabledTools.length;

  return (
    <div className="space-y-3">
      {/* Model Selection */}
      <div className="space-y-1.5">
        <Label>Model</Label>
        <ModelSelectorPopover value={model} onChange={(modelId) => form.setFieldValue("model", modelId)} />
      </div>

      {/* Temperature / Reasoning Effort */}
      <ModelConfigPanel
        modelId={model}
        temperature={temperature}
        onTemperatureChange={(value) => form.setFieldValue("temperature", value)}
        reasoningEffort={reasoningEffort}
        onReasoningEffortChange={(value) => form.setFieldValue("reasoningEffort", value)}
        idPrefix={`agent-${nodeId}`}
      />

      {/* System Prompt Source */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>System Prompt</Label>
          <Tabs
            value={promptSource}
            onValueChange={(value) => form.setFieldValue("promptSource", value as "inline" | "repository")}
          >
            <TabsList className="h-8">
              <TabsTrigger value="inline" className="gap-1.5 text-xs px-2.5">
                <PenLine className="size-3.5" />
                Inline
              </TabsTrigger>
              <TabsTrigger value="repository" className="gap-1.5 text-xs px-2.5">
                <Database className="size-3.5" />
                Repository
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Inline Prompt Editor */}
        {promptSource === "inline" && (
          <ExpandableTextEditor value={systemPrompt} onChange={(value) => form.setFieldValue("systemPrompt", value)} editable title="System Prompt">
            <Textarea
              value={systemPrompt}
              onChange={(e) => form.setFieldValue("systemPrompt", e.target.value)}
              placeholder="You are a helpful assistant..."
              rows={6}
            />
          </ExpandableTextEditor>
        )}

        {/* Prompt Repository Selector with Variable Mapping */}
        {promptSource === "repository" && (
          <TemplateProvider nodes={[]} edges={[]} journeyId={null} nodeId={nodeId} workflowNodes={workflowNodes}>
            <PromptSelector
              value={promptRefName}
              onChange={(name) => form.setFieldValue("promptRefName", name)}
              versionId={promptRefVersionId}
              onVersionIdChange={(id) => form.setFieldValue("promptRefVersionId", id)}
              label={promptRefLabel}
              onLabelChange={(lbl) => form.setFieldValue("promptRefLabel", lbl)}
              idPrefix={`agent-${nodeId}`}
              // Variable mapping props
              variableMappings={promptVariables}
              onVariableMappingsChange={handlePromptVariablesChange}
              showVariableMapper
              allowedTypes={["text", "chat"]}
            />
          </TemplateProvider>
        )}
      </div>

      {/* Tools Section - Unified selector for all tool types */}
      <CollapsibleSection open={toolsOpen} onOpenChange={setToolsOpen} icon={Wrench} label="Tools" badge={toolsCount > 0 ? toolsCount : undefined}>
        <UnifiedToolSelector
          selectedTools={enabledTools}
          onSelectionChange={handleToolsSelectionChange}
          toolTimingOverrides={toolTimingOverrides}
          onTimingChange={handleToolTimingChange}
          idPrefix={`tools-${nodeId}`}
        />
      </CollapsibleSection>

      {/* Conversation History Section */}
      <CollapsibleSection
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        icon={History}
        label="Conversation History"
        badge={historyStrategy === "summarize" ? "Smart" : undefined}
      >
        <ConversationHistorySection
          config={historyConfig}
          onConfigChange={handleHistoryUpdate}
          idPrefix={`history-${nodeId}`}
          variant="select"
          showSlidingWindow
        />
        {/* Warning for text prompt + none strategy combination */}
        {historyStrategy === "none" && isTextPrompt && (
          <Alert className="mt-3">
            <AlertTriangle className="h-4 w-4 !text-orange-500" />
            <AlertDescription className="text-xs">
              LLM providers require user messages. Use a Chat type prompt, or ensure prompt variables are mapped.
            </AlertDescription>
          </Alert>
        )}
      </CollapsibleSection>

      {/* Long-term Memory Section */}
      <CollapsibleSection open={memoryOpen} onOpenChange={setMemoryOpen} icon={Brain} label="Long-term Memory" badge={memoryEnabled ? "On" : undefined}>
        <MemorySection config={memoryConfig} onConfigChange={handleMemoryUpdate} idPrefix={`memory-${nodeId}`} />
      </CollapsibleSection>

      {/* Output Section */}
      <CollapsibleSection
        open={outputOpen}
        onOpenChange={setOutputOpen}
        icon={FileOutput}
        label="Output"
        badge={responseFormatType === "text" ? "Text" : "JSON"}
      >
        <div className="space-y-3">
          {/* Output Format */}
          <OutputFormatSection
            responseFormat={responseFormat}
            enableQuickReplies={enableQuickReplies}
            onUpdate={handleResponseFormatUpdate}
          />

          {/* Quick Reply Buttons Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor={`quick-replies-${nodeId}`}>Quick Reply Buttons</Label>
              <p className="text-xs text-muted-foreground">AI can suggest clickable response options</p>
            </div>
            <Switch
              id={`quick-replies-${nodeId}`}
              checked={enableQuickReplies}
              onCheckedChange={(checked) => {
                form.setFieldValue("enableQuickReplies", checked);
                // Auto-update schema to add/remove buttons field
                handleResponseFormatUpdate(buildDefaultSchema(checked));
              }}
            />
          </div>

          {/* Output Variable - commented out for now, may reuse later
          <div className="space-y-1.5">
            <Label>Output Variable (optional)</Label>
            <Input value={outputVariable} onChange={(e) => form.setFieldValue("outputVariable", e.target.value || undefined)} placeholder="agent_result" />
            <p className="text-xs text-muted-foreground">Store the agent's response in a variable for later use.</p>
          </div>
          */}
        </div>
      </CollapsibleSection>
    </div>
  );
}
