/**
 * Node Config Panel
 *
 * Overlay panel for editing selected workflow node properties.
 * Uses shared EditorPanel for consistent layout with journey builder.
 *
 * Auto-save pattern:
 * - Changes are auto-saved when closing the panel
 * - If validation fails, panel stays open and shows error
 * - Explicit Save button with spinner for immediate save
 *
 * @module features/workflows/components/config-panel/node-config-panel
 */

import { memo, useCallback } from "react";

import { useStore } from "@tanstack/react-store";
import type { WorkflowNodeType } from "@journey/schemas";

import { EditorPanel } from "@/shared/components/editor-panel";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";

import { workflowNodeRegistry } from "@/features/nodes/workflow/definitions";
import { useWorkflowNodeForm } from "@/features/nodes/workflow/hooks/use-workflow-node-form";

import { agentWorkflowStore, agentWorkflowActions } from "../../stores/agent-workflow-store";

// =============================================================================
// TYPES
// =============================================================================

interface NodeConfigPanelProps {
  /** Whether the panel is in read-only mode */
  readOnly?: boolean;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Get the panel title for a node type from the registry.
 */
function getNodePanelTitle(nodeType: WorkflowNodeType): string {
  const def = workflowNodeRegistry.get(nodeType);
  return def ? `${def.displayName} Node` : "Node";
}

// =============================================================================
// COMPONENT
// =============================================================================

export const NodeConfigPanel = memo(function NodeConfigPanel({ readOnly }: NodeConfigPanelProps) {
  const selectedNodeId = useStore(agentWorkflowStore, (s) => s.selectedNodeId);
  const nodes = useStore(agentWorkflowStore, (s) => s.nodes);

  const selectedNode = selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) : null;
  const nodeType = selectedNode?.type as WorkflowNodeType | undefined;
  const formConfig = nodeType ? workflowNodeRegistry.getFormConfig(nodeType) : undefined;
  const autoSaveEnabled = formConfig?.autoSave ?? true;

  // TanStack Form with auto-save support
  // Note: We call this hook unconditionally, but only use it when a node is selected
  const { form, isDirty, isSaving, validateAndSave, validationErrors, resetForm } = useWorkflowNodeForm({
    nodeId: selectedNodeId ?? "",
    nodeType: nodeType ?? "end",
    data: selectedNode?.data ?? {},
    formConfig,
  });

  // Cancel handler: reset form (does not close panel)
  const handleCancel = useCallback(() => {
    resetForm();
  }, [resetForm]);

  // Note: Editor registration is handled by useFormAutoSave hook in useWorkflowNodeForm
  // (useFormAutoSave calls saveManagerActions.registerEditor internally)

  // All hooks must be called before any conditional returns
  const handleDelete = useCallback(() => {
    if (selectedNode && selectedNode.type !== "start") {
      agentWorkflowActions.deleteNode(selectedNode.id);
    }
  }, [selectedNode]);

  const handleClose = useCallback(() => {
    agentWorkflowActions.clearSelection();
  }, []);

  // Don't render if no node is selected or in read-only/simulator mode
  if (!selectedNode || readOnly) {
    return null;
  }

  const canDelete = selectedNode.type !== "start";

  // Get the editor component from registry
  const Editor = workflowNodeRegistry.getEditor(selectedNode.type as WorkflowNodeType);

  const panelTitle = getNodePanelTitle(selectedNode.type as WorkflowNodeType);

  return (
    <EditorPanel
      title={panelTitle}
      onAutoSaveClose={validateAndSave}
      onSave={autoSaveEnabled ? undefined : validateAndSave}
      onCancel={autoSaveEnabled ? undefined : handleCancel}
      isSaving={isSaving}
      isDirty={isDirty}
      onClose={handleClose}
      onDelete={canDelete ? handleDelete : undefined}
      readOnly={readOnly}
      testId="workflow-node-config"
    >
      <div className="space-y-3">
        {/* Shared Node Name input (shown for all configurable nodes) */}
        {selectedNode.type !== "start" && (
          <div className="space-y-1.5">
            <Label htmlFor="node-name" className="text-xs">Node Name</Label>
            <form.Field name="name">
              {(field) => (
                <Input
                  id="node-name"
                  className="h-8"
                  value={(field.state.value as string) || ""}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder={panelTitle}
                />
              )}
            </form.Field>
            <p className="text-[10px] text-muted-foreground">
              Display name shown in console logs and debugging.
            </p>
          </div>
        )}

        {/* Type-specific config from registry */}
        {Editor ? (
          <Editor nodeId={selectedNode.id} data={selectedNode.data} form={form} validationErrors={validationErrors} />
        ) : (
          <div className="text-sm text-muted-foreground">
            Unknown node type: {selectedNode.type}
          </div>
        )}
      </div>
    </EditorPanel>
  );
});
