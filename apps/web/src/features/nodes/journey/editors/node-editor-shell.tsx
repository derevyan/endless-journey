import { useCallback, type ReactNode } from "react";

import { TemplateProvider } from "@/shared/components/ui/template-context";

import type { NodeEditorFormApi } from "../forms/form-types";
import { useNodeEditorContext } from "../hooks/use-node-editor-context";
import { nodeRegistry } from "../registry/node-registry";
import { EditorBase } from "./editor-base";
import type { NodeEditorProps } from "./types";

interface NodeEditorShellProps extends NodeEditorProps {
  title: string;
  form: NodeEditorFormApi;
  children: ReactNode;
  withTemplateProvider?: boolean;
  /** Whether form has unsaved changes */
  isDirty?: boolean;
  /** Whether save is in progress */
  isSaving?: boolean;
  /** Auto-save handler for validation on close */
  validateAndSave?: () => Promise<boolean>;
  /** Reset form to initial values (for cancel button) */
  resetForm?: () => void;
}

export function NodeEditorShell({
  node,
  onClose,
  onDelete,
  readOnly,
  title,
  form: _form,
  children,
  withTemplateProvider = false,
  isDirty = false,
  isSaving = false,
  validateAndSave,
  resetForm,
}: NodeEditorShellProps) {
  const { nodes, edges, journeyUuid } = useNodeEditorContext();
  const formConfig = nodeRegistry.getFormConfig(node.data.type);
  const autoSaveEnabled = formConfig.autoSave;

  // Cancel handler: reset form to initial values (does not close editor)
  const handleCancel = useCallback(() => {
    if (resetForm) {
      resetForm();
    }
  }, [resetForm]);

  const content = (
    <EditorBase
      title={title}
      nodeId={node.id}
      onClose={onClose}
      onDelete={onDelete}
      onAutoSaveClose={validateAndSave}
      onSave={autoSaveEnabled ? undefined : validateAndSave}
      onCancel={!autoSaveEnabled && resetForm ? handleCancel : undefined}
      isSaving={isSaving}
      isDirty={isDirty}
      readOnly={readOnly}
    >
      {children}
    </EditorBase>
  );

  if (!withTemplateProvider) {
    return content;
  }

  return (
    <TemplateProvider nodes={nodes} edges={edges} journeyId={journeyUuid} nodeId={node.id}>
      {content}
    </TemplateProvider>
  );
}
