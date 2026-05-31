/**
 * EndNodeEditor Component
 *
 * Editor for End node type:
 * - Name
 * - End type selector
 * - Metadata (tags, notes)
 * - Advanced (custom JSON)
 */

import { useCallback } from "react";

import { Label } from "@/shared/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { useNodeEditorForm } from "../../hooks/use-node-editor-form";
import type { StringArrayFieldApi } from "../../forms/form-types";

import { EditorBase } from "../../editors/editor-base";
import { EditorNameField } from "../../editors/editor-common-fields";
import { EditorCommonSections } from "../../editors/editor-common-sections";
import type { NodeEditorProps } from "../../editors/types";

const END_TYPES = [
  { value: "completed", label: "Completed", description: "Journey finished successfully" },
  { value: "converted", label: "Converted", description: "User converted/signed up" },
  { value: "churned", label: "Churned", description: "User dropped off" },
  { value: "error", label: "Error", description: "Journey ended due to an error" },
];

export function EndNodeEditor({ node, onClose, onDelete, readOnly }: NodeEditorProps) {
  const { form, isDirty, isSaving, validateAndSave, validationErrors, resetForm } = useNodeEditorForm(node);

  // Cancel handler: reset form (does not close editor)
  const handleCancel = useCallback(() => {
    resetForm();
  }, [resetForm]);

  return (
    <EditorBase
      title={readOnly ? "End Node Info" : "Edit End Node"}
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

      {/* 2. End Type - stored in tags */}
      <form.Field name="tags">
        {(field: StringArrayFieldApi) => {
          const tags = field.state.value || [];
          // Find end type tag
          const endType = tags.find((t) => END_TYPES.some((et) => et.value === t)) || "completed";

          const handleEndTypeChange = (value: string) => {
            // Remove old end type tags, add new one
            const filteredTags = tags.filter((t) => !END_TYPES.some((et) => et.value === t));
            field.handleChange([...filteredTags, value]);
          };

          const selectedType = END_TYPES.find((t) => t.value === endType);

          return (
            <div className="space-y-2">
              <Label className="text-xs font-medium">End Type</Label>
              <Select value={endType} onValueChange={handleEndTypeChange} disabled={readOnly}>
                <SelectTrigger size="sm">
                  <SelectValue placeholder="Select end type">{selectedType?.label}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {END_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex flex-col items-start">
                        <span className="font-medium">{type.label}</span>
                        <span className="text-[10px] text-muted-foreground">{type.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        }}
      </form.Field>

      {/* 3. Common Sections (Tags, Variables, Metadata, Advanced) */}
      <EditorCommonSections form={form} nodeId={node.id} nodeType={node.data.type} readOnly={readOnly} validationErrors={validationErrors} />
    </EditorBase>
  );
}
