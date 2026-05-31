/**
 * StartNodeEditor Component
 *
 * Editor for Start node type (entry point of the journey):
 * - Name + Content (welcome message text)
 * - Media (optional image/video attachment via DynamicNodeSections)
 * - Metadata (tags, notes)
 * - Advanced (custom JSON)
 */

import { useNodeEditorForm } from "../../hooks/use-node-editor-form";
import type { StringFieldApi } from "../../forms/form-types";
import { hasMediaSet } from "../../forms/node-form-extractors";

import { EditorNameField } from "../../editors/editor-common-fields";
import { EditorCommonSections } from "../../editors/editor-common-sections";
import { DynamicNodeSections } from "../../editors/dynamic-node-sections";
import { NodeEditorShell } from "../../editors/node-editor-shell";
import { MessageContentEditor } from "../../editors/sections";
import type { NodeEditorProps } from "../../editors/types";

export function StartNodeEditor({ node, onClose, onDelete, readOnly }: NodeEditorProps) {
  const { form, isDirty, isSaving, validateAndSave, validationErrors, resetForm } = useNodeEditorForm(node);

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
      title={readOnly ? "Start Node Info" : "Edit Start Node"}
      withTemplateProvider
    >
      {/* 1. Name + Content */}
      <EditorNameField form={form} nodeId={node.id} readOnly={readOnly} />

      {/* Welcome Message with Formatting Toolbar (Telegram-specific) */}
      <form.Field name="content">
        {(field: StringFieldApi) => (
          <MessageContentEditor
            id={`content-${node.id}`}
            label="Welcome Message"
            value={field.state.value || ""}
            onChange={(v) => field.handleChange(v)}
            onBlur={field.handleBlur}
            placeholder="Enter the welcome message for your journey..."
            readOnly={readOnly}
            textareaClassName="min-h-[120px] field-sizing-content text-sm"
          />
        )}
      </form.Field>

      {/* 2. Dynamic Sections (Media) - from section registry */}
      <DynamicNodeSections
        node={node}
        form={form}
        readOnly={readOnly}
        getInitialOpenState={(sectionId, n) => {
          if (sectionId === "media") return hasMediaSet(n);
          return false;
        }}
      />

      {/* 3. Common Sections (Tags, Variables, Metadata, Advanced) */}
      <EditorCommonSections form={form} nodeId={node.id} nodeType={node.data.type} readOnly={readOnly} validationErrors={validationErrors} />
    </NodeEditorShell>
  );
}
