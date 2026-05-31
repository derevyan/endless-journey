/**
 * WaitNodeEditor Component
 *
 * Editor for Wait node type with:
 * - Name
 * - Duration inputs (days/hours/minutes/seconds)
 * - Reason textarea (optional)
 * - Metadata (tags, notes)
 * - Advanced (custom JSON)
 */

import { useCallback } from "react";

import { Label } from "@/shared/components/ui/label";
import { TemplateProvider } from "@/shared/components/ui/template-context";
import { TemplateTextarea } from "@/shared/components/ui/template-textarea";
import { useNodeEditorContext } from "../../hooks/use-node-editor-context";
import { useNodeEditorForm } from "../../hooks/use-node-editor-form";
import type { StringFieldApi } from "../../forms/form-types";
import { Timer } from "lucide-react";

import { DurationInput } from "../../editors/sections/duration-input";
import { EditorBase } from "../../editors/editor-base";
import { EditorNameField } from "../../editors/editor-common-fields";
import { EditorCommonSections } from "../../editors/editor-common-sections";
import type { NodeEditorProps } from "../../editors/types";

export function WaitNodeEditor({ node, onClose, onDelete, readOnly }: NodeEditorProps) {
  const { form, isDirty, isSaving, validateAndSave, validationErrors, resetForm } = useNodeEditorForm(node);
  const { nodes, edges, journeyUuid } = useNodeEditorContext();

  // Cancel handler: reset form (does not close editor)
  const handleCancel = useCallback(() => {
    resetForm();
  }, [resetForm]);

  return (
    <EditorBase
      title={readOnly ? "Wait Node Info" : "Edit Wait Node"}
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

      {/* 2. Duration Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Timer className="h-4 w-4" />
          <Label className="text-xs font-medium">Wait Duration</Label>
        </div>
        <p className="text-xs text-muted-foreground">How long to pause the journey before continuing to the next node.</p>
        <DurationInput nodeId={node.id} fieldPrefix="duration" form={form} readOnly={readOnly} />
      </div>

      {/* 3. Reason (optional) */}
      <form.Field name="reason">
        {(field: StringFieldApi) => (
          <div className="space-y-2">
            <Label htmlFor={`reason-${node.id}`} className="text-xs font-medium">
              Reason <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <TemplateProvider nodeId={node.id} nodes={nodes} edges={edges} journeyId={journeyUuid}>
              <TemplateTextarea
                id={`reason-${node.id}`}
                value={field.state.value || ""}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                placeholder="Why are we waiting? e.g., 'Allow time for onboarding emails'"
                className="min-h-[80px] resize-y text-sm"
                disabled={readOnly}
              />
            </TemplateProvider>
            <p className="text-[10px] text-muted-foreground">Internal note explaining the purpose of this wait. Type {"{{" } for variables.</p>
          </div>
        )}
      </form.Field>

      {/* 4. Common Sections (Tags, Variables, Metadata, Advanced) */}
      <EditorCommonSections form={form} nodeId={node.id} nodeType={node.data.type} readOnly={readOnly} validationErrors={validationErrors} />
    </EditorBase>
  );
}
