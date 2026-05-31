/**
 * Parameter Modal
 *
 * Panel for creating and editing state parameters.
 * Uses the shared editor panel layout for consistent builder styling.
 */

import { useCallback, useRef, useState } from "react";

import { useStore } from "@tanstack/react-store";
import { Eye, Hash, List, ToggleLeft, Trash2, TrendingDown, TrendingUp } from "lucide-react";


import { EditorPanelOverlay } from "@/shared/components/editor-panel";
import { Button } from "@/shared/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { ExpandableTextEditor } from "@/shared/components/ui/expandable-text-editor";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Separator } from "@/shared/components/ui/separator";
import { SettingsSection } from "@/shared/components/ui/settings-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { Textarea } from "@/shared/components/ui/textarea";

import { builderActions, builderSelectors, builderStore } from "../../../stores/builder-store";
import { useParameterForm, useParameterFormFieldValue } from "../../../hooks/use-parameter-form";

type ScaleType = "NUMERIC" | "CATEGORICAL" | "BOOLEAN";

const SCALE_OPTIONS = [
  { value: "NUMERIC" as const, label: "Numeric", icon: Hash, hint: "0-10 range" },
  { value: "CATEGORICAL" as const, label: "Categories", icon: List, hint: "Low, Med, High" },
  { value: "BOOLEAN" as const, label: "Boolean", icon: ToggleLeft, hint: "True / False" },
];

interface ParameterModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ParameterModal({ open, onOpenChange }: ParameterModalProps) {
  const selectedParameterId = useStore(builderStore, (s) => s.ui.selectedParameterId);
  const parameters = useStore(builderStore, builderSelectors.parameters);
  const categories = useStore(builderStore, builderSelectors.categories);
  const systemAgents = useStore(builderStore, builderSelectors.systemAgents);

  // Track if we just saved (use ref to avoid re-render dependency)
  const justSavedRef = useRef(false);

  // Delete confirmation state
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const editingParam = parameters.find((p) => p.id === selectedParameterId);
  const defaultAgentId = systemAgents[0]?.id ?? "general_agent";
  const defaultCategory = categories[0] || "Emotional";

  // Initialize form hook
  const { form, isDirty, validateAndSave, resetForm } = useParameterForm(editingParam ?? null, defaultAgentId, defaultCategory);

  // Cancel handler: reset form (does not close modal)
  const handleCancel = useCallback(() => {
    resetForm();
  }, [resetForm]);

  // Reset save flag when modal opens
  if (open && justSavedRef.current) {
    justSavedRef.current = false;
    builderActions.clearParameterSaveFlag();
  }

  // ✅ Reactive subscriptions for all form values (matches journey editor pattern)
  // Each hook call subscribes to specific field changes, ensuring fresh values on every render
  const name = useParameterFormFieldValue(form, "name") ?? "";
  const category = useParameterFormFieldValue(form, "category") ?? "";
  const description = useParameterFormFieldValue(form, "description") ?? "";
  const scaleType = useParameterFormFieldValue(form, "scaleType") as ScaleType;
  const responsibleAgentId = useParameterFormFieldValue(form, "responsibleAgentId") ?? "";
  const min = useParameterFormFieldValue(form, "min") ?? 0;
  const max = useParameterFormFieldValue(form, "max") ?? 10;
  const currentValue = useParameterFormFieldValue(form, "currentValue");
  const semanticDirection = useParameterFormFieldValue(form, "semanticDirection") ?? "high_is_good";
  const options = useParameterFormFieldValue(form, "options");
  const detectionHints = useParameterFormFieldValue(form, "detectionHints");
  const observations = (detectionHints?.observations as string[] | undefined)?.join("\n") ?? "";
  const phrasesRaise = (detectionHints?.phrasesRaise as string[] | undefined)?.join("\n") ?? "";
  const phrasesLower = (detectionHints?.phrasesLower as string[] | undefined)?.join("\n") ?? "";

  const panelTitle = editingParam ? "Edit State Component" : "New State Component";

  // Form can be saved if name and description are provided
  // Zod schema in form hook handles all validation (min/max, categorical options, etc.)
  const canSave = Boolean(name && description);

  const handleSave = useCallback(async () => {
    const saved = await validateAndSave();
    if (saved) {
      justSavedRef.current = true;
      builderActions.markParameterSaved();
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
    if (editingParam) {
      builderActions.deleteParameter(editingParam.id);
      setConfirmDeleteOpen(false);
      onOpenChange(false);
    }
  };

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
          onDelete={editingParam ? () => setConfirmDeleteOpen(true) : undefined}
        >
          <div className="space-y-3">
            {/* Basic Information Section */}
            <SettingsSection title="Basic Information" description="Define the core identity of this state parameter.">
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="param-name">
                      Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="param-name"
                      value={name}
                      onChange={(e) => form.setFieldValue("name", e.target.value)}
                      placeholder="e.g. Curiosity"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="param-category">Category</Label>
                    <Select value={category} onValueChange={(v) => form.setFieldValue("category", v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="param-agent">Responsible Agent</Label>
                  <Select value={responsibleAgentId} onValueChange={(v) => form.setFieldValue("responsibleAgentId", v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {systemAgents.map((agent) => (
                        <SelectItem key={agent.id} value={agent.id}>
                          {agent.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="param-desc">
                    Description <span className="text-destructive">*</span>
                  </Label>
                  <ExpandableTextEditor
                    value={description}
                    onChange={(v) => form.setFieldValue("description", v)}
                    editable
                    title="Description"
                  >
                    <Textarea
                      id="param-desc"
                      value={description}
                      onChange={(e) => form.setFieldValue("description", e.target.value)}
                      placeholder="What this component measures and how it affects behavior..."
                      className="resize-y text-sm leading-relaxed p-3"
                      rows={2}
                    />
                  </ExpandableTextEditor>
                </div>
              </div>
            </SettingsSection>

            <Separator />

            {/* Detection Hints Section - Important for AI guidance */}
            <SettingsSection title="Detection Hints" description="Guide the AI agent on how to detect state changes in user messages.">
              <div className="space-y-3">
                {/* General Observations */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium flex items-center gap-2">
                    <Eye className="h-3.5 w-3.5" />
                    General Observations
                  </Label>
                  <ExpandableTextEditor
                    value={observations}
                    onChange={(v) => {
                      const observations = v
                        .split("\n")
                        .map((s) => s.trim())
                        .filter(Boolean);
                      form.setFieldValue("detectionHints.observations", observations);
                    }}
                    editable
                    title="General Observations"
                  >
                    <Textarea
                      value={observations}
                      onChange={(e) => {
                        const observations = e.target.value
                          .split("\n")
                          .map((s) => s.trim())
                          .filter(Boolean);
                        form.setFieldValue("detectionHints.observations", observations);
                      }}
                      placeholder="e.g. Look for signs of hesitation, changes in response length..."
                      className="resize-y text-sm leading-relaxed p-3"
                      rows={2}
                    />
                  </ExpandableTextEditor>
                </div>

                {/* Raise Triggers - Own row */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium flex items-center gap-2">
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                    Raise Triggers
                  </Label>
                  <Textarea
                    value={phrasesRaise}
                    onChange={(e) => {
                      const phrases = e.target.value
                        .split(/[\n,]+/)
                        .map((s) => s.trim())
                        .filter(Boolean);
                      form.setFieldValue("detectionHints.phrasesRaise", phrases);
                    }}
                    placeholder="Phrases or events that increase value (one per line)..."
                    className="resize-y overflow-hidden text-sm leading-relaxed p-3"
                  />
                </div>

                {/* Lower Triggers - Own row */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium flex items-center gap-2">
                    <TrendingDown className="h-3.5 w-3.5 text-rose-500" />
                    Lower Triggers
                  </Label>
                  <Textarea
                    value={phrasesLower}
                    onChange={(e) => {
                      const phrases = e.target.value
                        .split(/[\n,]+/)
                        .map((s) => s.trim())
                        .filter(Boolean);
                      form.setFieldValue("detectionHints.phrasesLower", phrases);
                    }}
                    placeholder="Phrases or events that decrease value (one per line)..."
                    className="resize-y overflow-hidden text-sm leading-relaxed p-3"
                  />
                </div>
              </div>
            </SettingsSection>

            <Separator />

            {/* Measurement Scale Section */}
            <SettingsSection title="Measurement Scale" description="Choose how this parameter tracks state changes.">
              <Tabs value={scaleType} onValueChange={(v) => form.setFieldValue("scaleType", v as ScaleType)} className="w-full">
                <TabsList className="w-full">
                  {SCALE_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    return (
                      <TabsTrigger key={option.value} value={option.value} className="flex-1">
                        <Icon className="mr-1.5 h-3.5 w-3.5" />
                        {option.label}
                      </TabsTrigger>
                    );
                  })}
                </TabsList>

                <TabsContent value="NUMERIC" className="mt-4 space-y-3">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="param-min" className="text-sm">
                        Minimum
                      </Label>
                      <Input
                        id="param-min"
                        type="number"
                        value={min}
                        onChange={(e) => form.setFieldValue("min", parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="param-max" className="text-sm">
                        Maximum
                      </Label>
                      <Input
                        id="param-max"
                        type="number"
                        value={max}
                        onChange={(e) => form.setFieldValue("max", parseFloat(e.target.value) || 10)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">Initial Value</Label>
                      <Input
                        type="number"
                        value={String(currentValue ??5)}
                        onChange={(e) => form.setFieldValue("currentValue", parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">Semantic Direction</Label>
                    <Select
                      value={semanticDirection}
                      onValueChange={(v) => form.setFieldValue("semanticDirection", v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="high_is_good">High is Good (e.g. Health)</SelectItem>
                        <SelectItem value="low_is_good">Low is Good (e.g. Stress)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] text-muted-foreground">Determines how colors indicate state quality</p>
                  </div>
                </TabsContent>

                <TabsContent value="CATEGORICAL" className="mt-4 space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="param-options" className="text-sm">
                      Options (comma separated)
                    </Label>
                    <Input
                      id="param-options"
                      value={options?.join(", ") ?? ""}
                      onChange={(e) => {
                        const opts = e.target.value
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean);
                        form.setFieldValue("options", opts);
                      }}
                      placeholder="Low, Medium, High"
                    />
                    <p className="text-[10px] text-muted-foreground">Define the possible states in order of intensity</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">Initial Value</Label>
                    <Select
                      value={String(currentValue ?? "")}
                      onValueChange={(v) => form.setFieldValue("currentValue", v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(options ?? []).map((opt) => (
                          <SelectItem key={opt} value={opt}>
                            {opt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </TabsContent>

                <TabsContent value="BOOLEAN" className="mt-4 space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-sm">Initial Value</Label>
                    <Select value={String(currentValue ??false)} onValueChange={(v) => form.setFieldValue("currentValue", v === "true")}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="false">False</SelectItem>
                        <SelectItem value="true">True</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </TabsContent>
              </Tabs>
            </SettingsSection>

          </div>
        </EditorPanelOverlay>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Delete Component</DialogTitle>
            <DialogDescription>This will remove the component and its history.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="flex items-center gap-3 p-3 rounded-md bg-destructive/10 text-destructive">
              <Trash2 className="size-5" />
              <div className="space-y-0.5">
                <p className="font-medium text-sm">Deleting {editingParam?.name}</p>
                <p className="text-xs opacity-90">This action cannot be undone.</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete Component
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
