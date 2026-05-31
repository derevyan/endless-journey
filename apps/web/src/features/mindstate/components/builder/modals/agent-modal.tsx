/**
 * Agent Modal
 *
 * Panel for creating and editing agents (main or system).
 * Uses the shared editor panel layout for consistent builder styling.
 */

import { useCallback, useRef, useState } from "react";

import { useStore } from "@tanstack/react-store";
import { Check, Database, Pencil, PenLine, Trash2 } from "lucide-react";


import { PromptSelector } from "@/features/prompts/components";
import { Tabs, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { TemplateProvider } from "@/shared/components/ui/template-context";

import { EditorPanelOverlay } from "@/shared/components/editor-panel";
import { ModelConfigPanel, type ReasoningEffort } from "@/shared/components/model-config-panel";
import { ModelSelectorPopover } from "@/shared/components/model-selector-popover";
import { Button } from "@/shared/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { ExpandableTextEditor } from "@/shared/components/ui/expandable-text-editor";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { Separator } from "@/shared/components/ui/separator";
import { Textarea } from "@/shared/components/ui/textarea";
import { cn } from "@/shared/lib/utils";
import { AGENT_COLORS, getAgentColorClasses } from "../../../lib/colors";
import { builderActions, builderSelectors, builderStore } from "../../../stores/builder-store";
import { DynamicIcon, getAvailableIcons } from "../../common/dynamic-icon";
import { useAgentForm, useAgentFormFieldValue, useAgentFormNestedValue } from "../../../hooks/use-agent-form";

interface AgentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AgentModal({ open, onOpenChange }: AgentModalProps) {
  const selectedAgentId = useStore(builderStore, (s) => s.ui.selectedAgentId);
  const isMainAgentEditing = useStore(builderStore, (s) => s.ui.editingAgentIsMain);
  const mainAgent = useStore(builderStore, builderSelectors.mainAgent);
  const systemAgents = useStore(builderStore, builderSelectors.systemAgents);

  // Track if we just saved (use ref to avoid re-render dependency)
  const justSavedRef = useRef(false);

  // Delete confirmation state
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  // Determine editing agent
  const editingAgent = isMainAgentEditing ? mainAgent : systemAgents.find((a) => a.id === selectedAgentId);

  // Initialize form hook
  const { form, isDirty, isSaving: _isSaving, validateAndSave, resetForm } = useAgentForm(
    isMainAgentEditing ? "main" : "system",
    editingAgent ?? null
  );

  // Cancel handler: reset form (does not close modal)
  const handleCancel = useCallback(() => {
    resetForm();
  }, [resetForm]);

  // Reset save flag when modal opens
  if (open && justSavedRef.current) {
    justSavedRef.current = false;
    builderActions.clearAgentSaveFlag();
  }

  // ✅ Reactive subscriptions for all form values (matches journey editor pattern)
  // Each hook call subscribes to specific field changes, ensuring fresh values on every render
  const name = (useAgentFormFieldValue(form, "name") as string) ?? "";
  const role = (useAgentFormFieldValue(form, "role") as string) ?? "";
  const promptSource = (useAgentFormFieldValue(form, "promptSource") as string) ?? "inline";
  const prompt = (useAgentFormFieldValue(form, "systemPrompt") as string) ?? "";
  const promptRefName = useAgentFormFieldValue(form, "promptRefName") as string | undefined;
  const promptRefVersionId = useAgentFormFieldValue(form, "promptRefVersionId") as string | undefined;
  const promptRefLabel = (useAgentFormFieldValue(form, "promptRefLabel") as string) ?? "production";
  const avatar = (useAgentFormFieldValue(form, "avatar") as string) ?? "Bot";
  const color = (useAgentFormFieldValue(form, "color") as string) ?? (isMainAgentEditing ? "indigo" : "blue");
  const promptVariables = (useAgentFormFieldValue(form, "promptVariables") as Record<string, string>) ?? {};
  const llmModel = useAgentFormNestedValue(form, "llmConfig.model") as string;
  const llmTemp = (useAgentFormNestedValue(form, "llmConfig.temperature") as number) ?? 0.3;
  const reasoningEffort = (useAgentFormNestedValue(form, "llmConfig.reasoningEffort") as ReasoningEffort | undefined);

  const canDelete = Boolean(editingAgent && !isMainAgentEditing && editingAgent.id !== "general_agent");

  // Compute whether form can be saved (all required fields filled)
  // In inline mode: need systemPrompt, in repository mode: need promptRefName
  const hasValidPrompt = promptSource === "repository" ? !!promptRefName : !!prompt.trim();
  const canSave = Boolean(name && role && hasValidPrompt);

  // Handler for prompt variable mappings change
  const handlePromptVariablesChange = useCallback(
    (mappings: Record<string, string>) => {
      form.setFieldValue("promptVariables", mappings);
    },
    [form]
  );

  const handleSave = useCallback(async () => {
    const saved = await validateAndSave();
    if (saved) {
      justSavedRef.current = true;
      builderActions.markAgentSaved();
    }
    return saved;
  }, [validateAndSave]);

  const handleAutoSaveClose = useCallback(async () => {
    if (justSavedRef.current) {
      justSavedRef.current = false;
      return true;
    }
    if (!isDirty) return true;
    return await validateAndSave();
  }, [isDirty, validateAndSave]);

  const handleDelete = () => {
    if (editingAgent && !isMainAgentEditing && editingAgent.id !== "general_agent") {
      builderActions.deleteSystemAgent(editingAgent.id);
      setConfirmDeleteOpen(false);
      onOpenChange(false);
    }
  };

  const currentTheme = getAgentColorClasses(color);

  const panelTitle = isMainAgentEditing ? "Edit Main Agent" : editingAgent ? "Edit Sub-Agent" : "Create Sub-Agent";
  return (
    <>
      {open && (
        <EditorPanelOverlay
          title={panelTitle}
          onClose={() => onOpenChange(false)}
          onAutoSaveClose={handleAutoSaveClose}
          onSave={handleSave}
          onCancel={handleCancel}
          isDirty={isDirty}
          canSave={canSave}
          onDelete={canDelete ? () => setConfirmDeleteOpen(true) : undefined}
        >
          <div className="space-y-3">
            {/* Profile Section - Compact premium card */}
            <div className="rounded-lg border bg-linear-to-br from-muted/30 to-muted/10 p-3.5">
              <div className="flex items-center gap-3.5">
                {/* Avatar with Popover */}
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        "relative size-16 shrink-0 rounded-xl flex items-center justify-center border-2 cursor-pointer group transition-all hover:shadow-md hover:scale-[1.02]",
                        currentTheme.softBg,
                        currentTheme.border
                      )}
                    >
                      <DynamicIcon name={avatar} size={32} className={currentTheme.text} />
                      <div className="absolute inset-0 rounded-xl bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                        <Pencil className="size-4 text-white" />
                      </div>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-4" align="start">
                    <div className="space-y-3">
                      {/* Icon Picker Grid */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-muted-foreground uppercase">Icon</Label>
                        <div className="grid grid-cols-6 gap-2">
                          {getAvailableIcons().map((icon) => (
                            <button
                              key={icon}
                              type="button"
                              onClick={() => form.setFieldValue("avatar", icon)}
                              className={cn(
                                "aspect-square rounded-md border flex items-center justify-center transition-all hover:bg-accent hover:text-accent-foreground",
                                avatar === icon ? "border-primary bg-primary/10 text-primary" : "border-transparent bg-muted/30"
                              )}
                              title={icon}
                            >
                              <DynamicIcon name={icon} size={16} />
                            </button>
                          ))}
                        </div>
                      </div>

                      <Separator />

                      {/* Color Picker Grid */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-muted-foreground uppercase">Color Theme</Label>
                        <div className="flex flex-wrap gap-2">
                          {Object.keys(AGENT_COLORS).map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => form.setFieldValue("color", c)}
                              className={cn(
                                "relative size-8 rounded-full border-2 transition-all hover:scale-110",
                                getAgentColorClasses(c).bg,
                                color === c ? "border-foreground ring-2 ring-offset-2 ring-offset-background" : "border-transparent"
                              )}
                              title={c}
                            >
                              {color === c && <Check className="absolute inset-0 m-auto size-4 text-white drop-shadow-md" />}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Name and Role - Compact inline design */}
                <div className="flex-1 space-y-0.5">
                  <Input
                    id="agent-name"
                    value={name}
                    onChange={(e) => form.setFieldValue("name", e.target.value)}
                    placeholder="Agent name..."
                    className="h-8 text-base font-semibold border-0 bg-transparent px-0 focus-visible:ring-0 placeholder:text-muted-foreground/50"
                  />
                  <Input
                    id="agent-role"
                    value={role}
                    onChange={(e) => form.setFieldValue("role", e.target.value)}
                    placeholder="Role or specialty..."
                    className="h-7 text-sm text-muted-foreground border-0 bg-transparent px-0 focus-visible:ring-0 placeholder:text-muted-foreground/40"
                  />
                </div>
              </div>
            </div>

            {/* Model Configuration - Inline layout matching workflow pattern */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Model</Label>
                <ModelSelectorPopover
                  value={llmModel}
                  onChange={(model) => form.setFieldValue("llmConfig.model", model)}
                />
              </div>

              <ModelConfigPanel
                modelId={llmModel}
                temperature={llmTemp}
                onTemperatureChange={(temp) => form.setFieldValue("llmConfig.temperature", temp)}
                reasoningEffort={reasoningEffort}
                onReasoningEffortChange={(effort) => form.setFieldValue("llmConfig.reasoningEffort", effort)}
                idPrefix="agent-modal"
              />
            </div>

            <Separator />

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
                <ExpandableTextEditor
                  value={prompt}
                  onChange={(value) => form.setFieldValue("systemPrompt", value)}
                  editable
                  title="System Prompt"
                >
                  <Textarea
                    value={prompt}
                    onChange={(e) => form.setFieldValue("systemPrompt", e.target.value)}
                    placeholder="You are a helpful assistant..."
                    rows={6}
                  />
                </ExpandableTextEditor>
              )}

              {/* Prompt Repository Selector with Variable Mapping */}
              {promptSource === "repository" && (
                <TemplateProvider
                  nodes={[]}
                  edges={[]}
                  journeyId={null}
                  nodeId=""
                  workflowNodes={[]}
                >
                  <PromptSelector
                    value={promptRefName}
                    onChange={(name) => form.setFieldValue("promptRefName", name)}
                    versionId={promptRefVersionId}
                    onVersionIdChange={(id) => form.setFieldValue("promptRefVersionId", id)}
                    label={promptRefLabel}
                    onLabelChange={(lbl) => form.setFieldValue("promptRefLabel", lbl)}
                    idPrefix="agent-modal"
                    // Variable mapping props
                    variableMappings={promptVariables}
                    onVariableMappingsChange={handlePromptVariablesChange}
                    showVariableMapper
                  />
                </TemplateProvider>
              )}
            </div>
          </div>
        </EditorPanelOverlay>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Delete Agent</DialogTitle>
            <DialogDescription>Transfer monitoring duties to the General Observer and remove this agent.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="flex items-center gap-3 p-3 rounded-md bg-destructive/10 text-destructive">
              <Trash2 className="size-5" />
              <div className="space-y-0.5">
                <p className="font-medium text-sm">Deleting {editingAgent?.name}</p>
                <p className="text-xs opacity-90">This action cannot be undone.</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete Agent
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
