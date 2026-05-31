/**
 * Workflow Node Registry Types
 *
 * Shared interfaces for the workflow node self-registration system.
 * Follows the same pattern as journey builder's node-registry.
 *
 * @module features/nodes/workflow/registry/types
 */

import type { NodeProps } from "@xyflow/react";
import type { WorkflowNodeDescriptor } from "@journey/schemas";
import type { FrontendDescriptorBase } from "@/features/nodes/shared/frontend-descriptor";
import type { FormHandlers } from "@/features/nodes/shared/form-registry";

import type { WorkflowNodeFormApi } from "../forms/workflow-form-types";
// =============================================================================
// COMPONENT PROP TYPES
// =============================================================================

/**
 * Props for workflow node config panel components.
 *
 * Components receive:
 * - nodeId: For identification (though form handles updates)
 * - data: Current node data (for reference, but form.Field should be used for values)
 * - form: TanStack Form API for field bindings
 *
 * Use form.setFieldValue() for programmatic updates - dirty state is tracked
 * reactively via useStore in the form hook.
 */
export interface WorkflowNodeEditorProps {
  /** Node ID */
  nodeId: string;
  /** Node configuration data */
  data: Record<string, unknown>;
  /** TanStack Form API for field bindings */
  form: WorkflowNodeFormApi;
  /** Field-level validation errors (path -> message) */
  validationErrors?: Map<string, string>;
}

// =============================================================================
// FRONTEND DESCRIPTOR
// =============================================================================

/**
 * Complete workflow node type definition for the frontend.
 * Extends the base schema descriptor with UI components and styling.
 */
export interface FrontendWorkflowNodeDescriptor<TData = Record<string, unknown>>
  extends WorkflowNodeDescriptor<TData>,
    FrontendDescriptorBase<NodeProps, WorkflowNodeEditorProps> {
  /** Color name referencing WORKFLOW_THEMES in workflow-theme.ts */
  color: string;
  /** Form handlers for schema + transform (optional for nodes without config) */
  formHandlers?: FormHandlers<Record<string, unknown>, Record<string, unknown>, Record<string, unknown>>;
}
