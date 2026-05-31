/**
 * MessageNodeEditor Component
 *
 * Editor for Message node type with:
 * - Name + Content
 * - User Actions (response type, buttons)
 * - Timer configuration
 * - Metadata (tags, notes)
 * - Advanced (store response as, custom JSON)
 */

import { useEditorActionsContext } from "@/features/journey/builder/context";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { NodeSelectorPopover } from "@/features/nodes/journey/editors/components/node-selector-popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Slider } from "@/shared/components/ui/slider";
import type { ButtonConfig } from "@journey/schemas";
import { CirclePlay, MessageSquare, MousePointerClick, Plus, Trash2 } from "lucide-react";
import { useCallback, useMemo } from "react";
import { generateButtonId } from "@/shared/lib/utils/id";
import type { ButtonConfigArrayFieldApi, StringFieldApi, NumberFieldApi } from "../../forms/form-types";
import { hasMediaSet, hasTimerSet } from "../../forms/node-form-extractors";
import { useArrayField } from "../../hooks/use-array-field";
import { ManagedEdgeId } from "../../utils/edge-identity";
import { useNodeEditorContext } from "../../hooks/use-node-editor-context";
import { useNodeEditorForm } from "../../hooks/use-node-editor-form";

import type { ResponseType } from "@/features/nodes/journey/react-flow-types";
import { cn } from "@/shared/lib/utils";
import { EditorNameField } from "../../editors/editor-common-fields";
import { EditorCommonSections } from "../../editors/editor-common-sections";
import { DynamicNodeSections } from "../../editors/dynamic-node-sections";
import { NodeEditorShell } from "../../editors/node-editor-shell";
import { MessageContentEditor } from "../../editors/sections";
import type { NodeEditorProps } from "../../editors/types";

export function MessageNodeEditor({ node, onClose, onDelete, readOnly }: NodeEditorProps) {
  const { form, isDirty, isSaving, validateAndSave, validationErrors, resetForm } = useNodeEditorForm(node);
  const context = useNodeEditorContext();
  const { deleteEdgeRaw, setButtonTarget } = useEditorActionsContext();

  // Use useArrayField for buttons management - eliminates manual array manipulation
  const buttons = useArrayField<ButtonConfig>(form, "buttons");

  // Add new button
  const handleAddButton = useCallback(() => {
    buttons.add({
      id: generateButtonId(),
      text: "",
    });
  }, [buttons]);

  // Update button text by index
  const handleUpdateButtonText = useCallback((index: number, text: string) => {
    buttons.updateByIndex(index, { text });
  }, [buttons]);

  // Remove button with side effect: delete managed edge
  const handleRemoveButton = useCallback((index: number) => {
    const buttonToRemove = buttons.getByIndex(index);
    buttons.removeByIndex(index);

    // Delete managed edge directly (not deleteEdgeWithSync!)
    // We use deleteEdgeRaw() because deleteEdgeWithSync() calls clearButtonTargetNodeOnly()
    // which would update the store's buttons array and trigger a form reset that restores the button
    if (buttonToRemove?.id) {
      const managedEdgeId = ManagedEdgeId.create(node.id, buttonToRemove.id);
      deleteEdgeRaw(managedEdgeId);
    }
  }, [buttons, node.id, deleteEdgeRaw]);

  // Set button target node with side effect: sync to store for managed edges
  const handleSetButtonTargetNode = useCallback((buttonId: string, targetNodeId: string | undefined) => {
    // Update form first (keeps form and store in sync for subsequent operations like delete)
    buttons.updateById(buttonId, { targetNodeId });

    // Then sync to store (for managed edges visualization) via context-injected action
    setButtonTarget(node.id, buttonId, targetNodeId || undefined);
  }, [buttons, node.id, setButtonTarget]);

  // Available nodes for button targeting (excludes current node and start nodes)
  const availableNodes = useMemo(
    () =>
      context.nodes
        .filter((n) => n.id !== node.id && n.data.type !== "start")
        .map((n) => ({
          id: n.id,
          label: n.data.label || n.id,
          type: n.data.type,
        })),
    [context.nodes, node.id]
  );

  // Helper to get button text error for a specific button by index
  const getButtonTextError = (index: number): string | undefined => {
    return validationErrors?.get(`buttons.${index}.text`);
  };

  // Get current response type to determine if we should show storeResponseAs in Advanced
  const responseType = form.getFieldValue("responseType");
  const showStoreResponseAs = responseType && responseType !== "auto";

  // Render the storeResponseAs field for Advanced section
  const renderStoreResponseAs = () => {
    if (!showStoreResponseAs) return null;

    return (
      <form.Field name="storeResponseAs">
        {(field: StringFieldApi) => (
          <div className="space-y-1.5">
            <Label htmlFor={`storeResponseAs-${node.id}`} className="text-xs text-muted-foreground">
              Store response as (optional)
            </Label>
            <Input
              id={`storeResponseAs-${node.id}`}
              value={field.state.value || ""}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              placeholder="e.g., selectedPlan"
              className="h-8 text-sm font-mono"
              disabled={readOnly}
            />
            <p className="text-[10px] text-muted-foreground">
              Stored in <code className="bg-muted px-1 rounded">context.userResponse</code>
              {field.state.value && (
                <>
                  {" "}
                  and <code className="bg-muted px-1 rounded">context.{field.state.value}</code>
                </>
              )}
            </p>
          </div>
        )}
      </form.Field>
    );
  };

  return (
    <NodeEditorShell
      node={node}
      form={form}
      isDirty={isDirty}
      isSaving={isSaving}
      validateAndSave={validateAndSave}
      resetForm={resetForm}
      onClose={onClose}
      onDelete={onDelete}
      readOnly={readOnly}
      title={readOnly ? "Message Node Info" : "Edit Message Node"}
      withTemplateProvider
    >
      {/* 1. Name + Content */}
      <EditorNameField form={form} nodeId={node.id} readOnly={readOnly} />

      {/* Message Content with Formatting Toolbar (Telegram-specific) */}
      <form.Field name="content">
        {(field: StringFieldApi) => (
          <MessageContentEditor
            id={`content-${node.id}`}
            label="Message Content"
            value={field.state.value || ""}
            onChange={(v) => field.handleChange(v)}
            onBlur={field.handleBlur}
            placeholder="Enter message content..."
            readOnly={readOnly}
            textareaClassName="min-h-[120px] field-sizing-content text-sm"
            footer={(() => {
              const charCount = (field.state.value || "").length;
              const hasMedia = Boolean((form.getFieldValue("media") as { url?: string } | undefined)?.url);
              const limit = hasMedia ? 1024 : 4096;
              const isOverLimit = charCount > limit;
              const isNearLimit = charCount > limit * 0.9;
              return (
                <div className="flex justify-end mt-1">
                  <span
                    className={cn(
                      "text-[10px]",
                      isOverLimit ? "text-destructive font-medium" : isNearLimit ? "text-warning" : "text-muted-foreground"
                    )}
                  >
                    {charCount.toLocaleString()}/{limit.toLocaleString()}
                    {hasMedia && charCount > 1024 && " (caption will be truncated)"}
                  </span>
                </div>
              );
            })()}
          />
        )}
      </form.Field>

      {/* Send Delay - Clean slider */}
      <form.Field name="delay">
        {(field: NumberFieldApi) => {
          const delayValue = field.state.value ?? 0;
          return (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-[9px] text-muted-foreground">Message send delay</Label>
                <span className="text-muted-foreground text-[9px] tabular-nums">{delayValue > 0 ? `${delayValue}s` : "off"}</span>
              </div>
              <Slider
                id={`delay-${node.id}`}
                min={0}
                max={60}
                step={1}
                value={[delayValue]}
                onValueChange={(values) => field.handleChange(values[0] || 0)}
                disabled={readOnly}
              />
            </div>
          );
        }}
      </form.Field>

      {/* 2. User Actions Section */}
      <div className="space-y-3">
        <Label className="text-xs font-medium">User Actions</Label>

        {/* Response Type Selector */}
        <form.Field name="responseType">
          {(field: StringFieldApi) => (
            <div className="space-y-2">
              <Label htmlFor={`responseType-${node.id}`} className="text-[11px] text-muted-foreground">
                Wait for
              </Label>
              <Select value={field.state.value || "auto"} onValueChange={(value) => field.handleChange(value as ResponseType)} disabled={readOnly}>
                <SelectTrigger size="sm" id={`responseType-${node.id}`}>
                  <SelectValue placeholder="Select response type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">
                    <span className="flex items-center gap-2">
                      <CirclePlay className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>Auto (no input needed)</span>
                    </span>
                  </SelectItem>
                  <SelectItem value="buttons">
                    <span className="flex items-center gap-2">
                      <MousePointerClick className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>Button click only</span>
                    </span>
                  </SelectItem>
                  <SelectItem value="text">
                    <span className="flex items-center gap-2">
                      <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>Text reply only</span>
                    </span>
                  </SelectItem>
                  <SelectItem value="any">
                    <span className="flex items-center gap-2">
                      <span className="flex">
                        <MousePointerClick className="h-3.5 w-3.5 text-muted-foreground" />
                        <MessageSquare className="h-3.5 w-3.5 text-muted-foreground -ml-1" />
                      </span>
                      <span>Buttons + Text</span>
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                {field.state.value === "auto" && "Message displays and continues automatically."}
                {field.state.value === "buttons" && "Waits for user to click a button."}
                {field.state.value === "text" && "Waits for user to type a message."}
                {field.state.value === "any" && "Accepts button clicks or text messages."}
                {!field.state.value && "Message displays and continues automatically."}
              </p>
            </div>
          )}
        </form.Field>

        {/* Buttons List */}
        <form.Field name="responseType">
          {(responseTypeField: StringFieldApi) => {
            const responseType = responseTypeField.state.value;
            const showButtons = responseType === "buttons" || responseType === "any";

            if (!showButtons) return null;

            return (
              <form.Field name="buttons">
                {(field: ButtonConfigArrayFieldApi) => {
                  const buttons = field.state.value || [];
                  return (
                    <div className="space-y-2 pl-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-[11px] text-muted-foreground">Buttons</Label>
                        {!readOnly && (
                          <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={handleAddButton}>
                            <Plus className="h-3 w-3 mr-1" />
                            Add
                          </Button>
                        )}
                      </div>
                      {buttons.length > 0 ? (
                        <div className="space-y-2">
                          {buttons.map((button, index) => {
                            const buttonText = button.text;
                            const charCount = buttonText.length;
                            const isOverLimit = charCount > 35;
                            const buttonError = getButtonTextError(index);
                            return (
                              <div key={button.id} className="flex items-start gap-2">
                                <div className="flex-1 space-y-1">
                                  <div className="relative">
                                    <Input
                                      value={buttonText}
                                      onChange={(e) => handleUpdateButtonText(index, e.target.value)}
                                      maxLength={35}
                                      className={cn("h-8 text-xs pr-12", isOverLimit && "border-destructive")}
                                      placeholder="Button label..."
                                      disabled={readOnly}
                                      hasError={!!buttonError}
                                    />
                                    <span
                                      className={cn(
                                        "absolute right-2 top-1/2 -translate-y-1/2 text-[10px]",
                                        isOverLimit ? "text-destructive" : "text-muted-foreground"
                                      )}
                                    >
                                      {charCount}/35
                                    </span>
                                  </div>
                                  {buttonError && <p className="text-xs text-destructive">{buttonError}</p>}
                                </div>
                                {/* Target node selector - direct selection via NodeSelectorPopover */}
                                <NodeSelectorPopover
                                  value={button.targetNodeId || ""}
                                  onChange={(nodeId) => handleSetButtonTargetNode(button.id, nodeId || undefined)}
                                  nodes={availableNodes}
                                  disabled={readOnly}
                                  placeholder="Target..."
                                  allowNone
                                  noneLabel="No target"
                                  className="w-[160px]"
                                />
                                {!readOnly && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
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
                        <p className="text-xs text-muted-foreground py-1">No buttons. Add at least one.</p>
                      )}
                    </div>
                  );
                }}
              </form.Field>
            );
          }}
        </form.Field>
      </div>

      {/* 3-5. Dynamic Sections (Media, Timer) - from section registry */}
      <DynamicNodeSections
        node={node}
        form={form}
        readOnly={readOnly}
        getInitialOpenState={(sectionId, n) => {
          if (sectionId === "timer") return hasTimerSet(n);
          if (sectionId === "media") return hasMediaSet(n);
          return false;
        }}
      />

      {/* 6. Common Sections (Tags, Variables, Metadata, Advanced) */}
      <EditorCommonSections
        form={form}
        nodeId={node.id}
        nodeType={node.data.type}
        readOnly={readOnly}
        validationErrors={validationErrors}
        advancedChildren={renderStoreResponseAs()}
      />
    </NodeEditorShell>
  );
}
