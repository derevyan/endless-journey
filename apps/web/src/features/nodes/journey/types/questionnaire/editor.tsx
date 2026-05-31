/**
 * QuestionnaireNodeEditor Component
 *
 * Editor for Questionnaire node type with:
 * - Name
 * - Questions list (add/remove/edit)
 * - Timeout configuration
 * - Introduction/completion messages
 * - Follow-up sequence (via DynamicNodeSections)
 * - Metadata
 */

import { useEditorActionsContext } from "@/features/journey/builder/context";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import type { ButtonConfig, Question } from "@journey/schemas";
import { ChevronDown, ChevronUp, Clock, MessageCircleQuestion, Plus, Settings, Trash2 } from "lucide-react";
import { useCallback, useState } from "react";
import { generateButtonId, generateQuestionId } from "@/shared/lib/utils/id";
import { useArrayField } from "../../hooks/use-array-field";
import { ManagedEdgeId } from "../../utils/edge-identity";
import { useNodeEditorForm, useFormFieldValue } from "../../hooks/use-node-editor-form";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/shared/components/ui/collapsible";
import { cn } from "@/shared/lib/utils";
import { EditorNameField } from "../../editors/editor-common-fields";
import { EditorCommonSections } from "../../editors/editor-common-sections";
import { DynamicNodeSections } from "../../editors/dynamic-node-sections";
import { NodeEditorShell } from "../../editors/node-editor-shell";
import { DurationInput } from "../../editors/sections/duration-input";
import { MessageContentEditor } from "../../editors/sections";
import type { NodeEditorProps } from "../../editors/types";

export function QuestionnaireNodeEditor({ node, onClose, onDelete, readOnly }: NodeEditorProps) {
  const { form, isDirty, isSaving, validateAndSave, validationErrors, resetForm } = useNodeEditorForm(node);
  const { deleteEdgeRaw } = useEditorActionsContext();
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Use useArrayField for questions management
  const questions = useArrayField<Question>(form, "questions");

  // Add a new question
  const handleAddQuestion = useCallback(() => {
    const newQuestion: Question = {
      id: generateQuestionId(),
      content: "New question?",
      responseType: "buttons",
      buttons: [
        { id: generateButtonId(), text: "Yes" },
        { id: generateButtonId(), text: "No" },
      ],
      required: true,
    };
    questions.add(newQuestion);
    setExpandedQuestion(newQuestion.id);
  }, [questions]);

  // Remove a question
  const handleRemoveQuestion = useCallback((questionId: string) => {
    questions.removeById(questionId);
    if (expandedQuestion === questionId) {
      setExpandedQuestion(null);
    }
  }, [questions, expandedQuestion]);

  // Update a question field
  const handleUpdateQuestion = useCallback((questionId: string, field: keyof Question, value: unknown) => {
    questions.updateById(questionId, { [field]: value } as Partial<Question>);
  }, [questions]);

  // Move question up/down using array reordering
  const handleMoveQuestion = useCallback((questionId: string, direction: "up" | "down") => {
    const index = questions.items.findIndex((q) => q.id === questionId);
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    questions.move(index, targetIndex);
  }, [questions]);

  // Add button to a question (nested array operation)
  const handleAddButton = useCallback((questionId: string) => {
    const question = questions.getById(questionId);
    if (!question) return;
    const newButton: ButtonConfig = {
      id: generateButtonId(),
      text: "New option",
    };
    questions.updateById(questionId, { buttons: [...(question.buttons || []), newButton] });
  }, [questions]);

  // Update button text (nested array operation)
  const handleUpdateButtonText = useCallback((questionId: string, buttonIndex: number, text: string) => {
    const question = questions.getById(questionId);
    if (!question) return;
    const buttons = [...(question.buttons || [])];
    buttons[buttonIndex] = { ...buttons[buttonIndex], text };
    questions.updateById(questionId, { buttons });
  }, [questions]);

  // Remove button from question with side effect: delete managed edge
  const handleRemoveButton = useCallback((questionId: string, buttonIndex: number) => {
    const question = questions.getById(questionId);
    if (!question) return;
    const buttonToRemove = question.buttons?.[buttonIndex];

    // Update form to remove the button
    const buttons = (question.buttons || []).filter((_: ButtonConfig, i: number) => i !== buttonIndex);
    questions.updateById(questionId, { buttons });

    // Delete managed edge directly (not deleteEdgeWithSync!)
    // We use deleteEdgeRaw() because deleteEdgeWithSync() calls clearButtonTargetNodeOnly()
    // which would update the store's buttons array and trigger a form reset that restores the button
    if (buttonToRemove?.id) {
      const managedEdgeId = ManagedEdgeId.create(node.id, buttonToRemove.id);
      deleteEdgeRaw(managedEdgeId);
    }
  }, [questions, node.id, deleteEdgeRaw]);

  // Use reactive subscription for questions array rendering
  const questionsItems = (useFormFieldValue(form, "questions") as Question[] | undefined) || [];

  // Helper to get question field errors
  const getQuestionContentError = (questionIndex: number): string | undefined => {
    return validationErrors?.get(`questions.${questionIndex}.content`);
  };

  const getButtonTextError = (questionIndex: number, buttonIndex: number): string | undefined => {
    return validationErrors?.get(`questions.${questionIndex}.buttons.${buttonIndex}.text`);
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
      title={readOnly ? "Questionnaire Info" : "Edit Questionnaire"}
      withTemplateProvider
    >
      {/* 1. Name */}
      <EditorNameField form={form} nodeId={node.id} readOnly={readOnly} />

      {/* 2. Questions Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircleQuestion className="h-4 w-4" />
            <Label className="text-xs font-medium">Questions ({questionsItems.length})</Label>
          </div>
          {!readOnly && (
            <Button variant="ghost" size="sm" onClick={handleAddQuestion}>
              <Plus className="h-3 w-3 mr-1" />
              Add
            </Button>
          )}
        </div>

        <div className="space-y-2">
          {questionsItems.map((q, index) => (
            <Collapsible
              key={q.id}
              open={expandedQuestion === q.id}
              onOpenChange={(open) => setExpandedQuestion(open ? q.id : null)}
            >
              <div className="border rounded-md bg-muted/30">
                <CollapsibleTrigger asChild>
                  <div className="flex items-center gap-2 p-2 cursor-pointer hover:bg-muted/50">
                    <span className="text-xs font-medium shrink-0">{index + 1}.</span>
                    <span className="text-xs truncate flex-1">{q.content}</span>
                    <ChevronDown className="h-3 w-3" />
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-3 pb-3 space-y-3 border-t pt-3">
                    {/* Question content */}
                    <MessageContentEditor
                      id={`question-${q.id}-content`}
                      label="Question Text"
                      labelClassName="text-[10px]"
                      value={q.content || ""}
                      onChange={(v) => handleUpdateQuestion(q.id, "content", v)}
                      placeholder="Enter your question..."
                      readOnly={readOnly}
                      textareaClassName="min-h-[120px] field-sizing-content text-sm"
                      emptyPreviewText="No question text. Click to edit."
                      hasError={!!getQuestionContentError(index)}
                    />
                    {getQuestionContentError(index) && (
                      <p className="text-xs text-destructive">{getQuestionContentError(index)}</p>
                    )}

                    {/* Response type */}
                    <div className="space-y-1">
                      <Label className="text-[10px]">Response Type</Label>
                      <Select
                        value={q.responseType}
                        onValueChange={(value) => handleUpdateQuestion(q.id, "responseType", value)}
                        disabled={readOnly}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="buttons">Buttons only</SelectItem>
                          <SelectItem value="text">Text only</SelectItem>
                          <SelectItem value="any">Buttons or text</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Buttons (for buttons/any response types) */}
                    {(q.responseType === "buttons" || q.responseType === "any") && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-[10px]">Answer Options</Label>
                          {!readOnly && (
                            <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => handleAddButton(q.id)}>
                              <Plus className="h-2 w-2 mr-1" />
                              Add
                            </Button>
                          )}
                        </div>
                        <div className="space-y-1">
                          {(q.buttons || []).map((btn, btnIndex) => {
                            const btnError = getButtonTextError(index, btnIndex);
                            return (
                              <div key={btn.id} className="space-y-0.5">
                                <div className="flex items-center gap-1">
                                  <Input
                                    value={btn.text}
                                    onChange={(e) => handleUpdateButtonText(q.id, btnIndex, e.target.value)}
                                    placeholder="Option text"
                                    className="h-7 text-xs flex-1"
                                    disabled={readOnly}
                                    hasError={!!btnError}
                                  />
                                  {!readOnly && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 w-7 p-0"
                                      onClick={() => handleRemoveButton(q.id, btnIndex)}
                                    >
                                      <Trash2 className="h-3 w-3 text-destructive" />
                                    </Button>
                                  )}
                                </div>
                                {btnError && <p className="text-xs text-destructive pl-1">{btnError}</p>}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-2 border-t">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          disabled={index === 0 || readOnly}
                          onClick={() => handleMoveQuestion(q.id, "up")}
                        >
                          <ChevronUp className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          disabled={index === questionsItems.length - 1 || readOnly}
                          onClick={() => handleMoveQuestion(q.id, "down")}
                        >
                          <ChevronDown className="h-3 w-3" />
                        </Button>
                      </div>
                      {!readOnly && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-destructive text-[10px]"
                          onClick={() => handleRemoveQuestion(q.id)}
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Delete
                        </Button>
                      )}
                    </div>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          ))}

          {questionsItems.length === 0 && (
            <div className="text-center py-6 text-muted-foreground text-xs">
              No questions yet. Click "Add" to create your first question.
            </div>
          )}
        </div>
      </div>

      {/* 3. Settings Section (Timeout) */}
      <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
        <CollapsibleTrigger className="flex w-full items-center gap-2 py-2 text-sm font-medium hover:text-foreground text-muted-foreground transition-colors">
          <Settings className="size-4" />
          <span>Settings</span>
          <ChevronDown className={cn("size-4 ml-auto transition-transform", settingsOpen && "rotate-180")} />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 pt-2 pl-6">
          {/* Timeout */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <Label className="text-xs font-medium">Timeout (optional)</Label>
            </div>
            <DurationInput nodeId={node.id} fieldPrefix="timeout" form={form} readOnly={readOnly} />
            <p className="text-[10px] text-muted-foreground">
              If user doesn't complete questionnaire within this time, they'll be routed to the timeout path.
            </p>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* 4. Introduction (optional) */}
      <form.Field name="introduction.content">
        {(field: { state: { value: string | undefined }; handleChange: (v: string) => void; handleBlur: () => void }) => (
          <MessageContentEditor
            id={`introduction-${node.id}`}
            label="Introduction Message (optional)"
            value={field.state.value || ""}
            onChange={(v) => field.handleChange(v)}
            onBlur={field.handleBlur}
            placeholder="Welcome! This quick survey will help us understand your needs better..."
            readOnly={readOnly}
            textareaClassName="min-h-[120px] field-sizing-content text-sm"
          />
        )}
      </form.Field>

      {/* 5. Completion Message (optional) */}
      <form.Field name="completion.content">
        {(field: { state: { value: string | undefined }; handleChange: (v: string) => void; handleBlur: () => void }) => (
          <MessageContentEditor
            id={`completion-${node.id}`}
            label="Completion Message (optional)"
            value={field.state.value || ""}
            onChange={(v) => field.handleChange(v)}
            onBlur={field.handleBlur}
            placeholder="Thank you for completing the questionnaire!"
            readOnly={readOnly}
            textareaClassName="min-h-[120px] field-sizing-content text-sm"
          />
        )}
      </form.Field>

      {/* 6. Dynamic Sections - from section registry */}
      <DynamicNodeSections node={node} form={form} readOnly={readOnly} />

      {/* 7. Common Sections (Tags, Variables, Metadata, Advanced) */}
      <EditorCommonSections form={form} nodeId={node.id} nodeType={node.data.type} readOnly={readOnly} validationErrors={validationErrors} />
    </NodeEditorShell>
  );
}
