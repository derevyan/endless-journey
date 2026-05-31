/**
 * Workflow Node Registry
 *
 * Central registry for workflow node type definitions with self-registration.
 * Each node type registers itself when its definition module is imported.
 *
 * Pattern adapted from journey builder's node-registry.ts.
 *
 * @module features/nodes/workflow/registry/workflow-node-registry
 */

import type { ComponentType } from "react";
import type { NodeProps } from "@xyflow/react";
import type { LucideIcon } from "lucide-react";
import type { NodeHandleConfig, WorkflowNodeType } from "@journey/schemas";

import { BaseRegistry } from "@journey/schemas";
import { createLogger } from "@journey/logger";

import type { NodeFormConfig } from "@/features/nodes/shared/frontend-descriptor";

import { workflowFormRegistry } from "../forms/form-registry";
import type { FrontendWorkflowNodeDescriptor, WorkflowNodeEditorProps } from "./types";

const log = createLogger("workflow-node-registry");
const DEFAULT_FORM_CONFIG: NodeFormConfig = {
  autoSave: false, // Match journey pattern - show Save/Cancel buttons
  saveDebounceMs: 300,
};

type AnyFrontendDescriptor = FrontendWorkflowNodeDescriptor<Record<string, unknown>>;

// =============================================================================
// REGISTRY CLASS
// =============================================================================

/**
 * Workflow Node Registry
 *
 * Manages workflow node type definitions and provides lookup functionality.
 * Node types self-register when their definition modules are imported.
 */
class WorkflowNodeRegistry extends BaseRegistry<WorkflowNodeType, AnyFrontendDescriptor> {
  constructor() {
    super({
      onDuplicate: (nodeType) => {
        log.warn({ nodeType }, "workflowNodeRegistry:duplicateRegistration");
      },
      allowOverwrite: true,
    });
  }

  /**
   * Register a workflow node type definition.
   * Called by each node's definition module at import time.
   */
  register(key: WorkflowNodeType, item: AnyFrontendDescriptor): void;
  register<TData>(descriptor: FrontendWorkflowNodeDescriptor<TData>): void;
  register(
    keyOrDescriptor: WorkflowNodeType | AnyFrontendDescriptor,
    item?: AnyFrontendDescriptor
  ): void {
    if (typeof keyOrDescriptor === "string") {
      if (!item) return;
      super.register(keyOrDescriptor, this.normalizeDescriptor(item));
      if (item.formHandlers) {
        workflowFormRegistry.register(keyOrDescriptor, item.formHandlers);
      }
      return;
    }
    super.register(keyOrDescriptor.type, this.normalizeDescriptor(keyOrDescriptor));
    if (keyOrDescriptor.formHandlers) {
      workflowFormRegistry.register(keyOrDescriptor.type, keyOrDescriptor.formHandlers);
    }
  }

  override(key: WorkflowNodeType, item: AnyFrontendDescriptor): void;
  override<TData>(descriptor: FrontendWorkflowNodeDescriptor<TData>): void;
  override(
    keyOrDescriptor: WorkflowNodeType | AnyFrontendDescriptor,
    item?: AnyFrontendDescriptor
  ): void {
    if (typeof keyOrDescriptor === "string") {
      if (!item) return;
      super.override(keyOrDescriptor, this.normalizeDescriptor(item));
      if (item.formHandlers) {
        workflowFormRegistry.register(keyOrDescriptor, item.formHandlers);
      }
      return;
    }
    super.override(keyOrDescriptor.type, this.normalizeDescriptor(keyOrDescriptor));
    if (keyOrDescriptor.formHandlers) {
      workflowFormRegistry.register(keyOrDescriptor.type, keyOrDescriptor.formHandlers);
    }
  }

  private normalizeDescriptor(def: AnyFrontendDescriptor): AnyFrontendDescriptor {
    return {
      ...def,
      editor: def.editor ?? EmptyEditor,
      formConfig: def.formConfig ?? DEFAULT_FORM_CONFIG,
    };
  }

  /**
   * Get visual component for a node type (for React Flow).
   */
  getComponent(type: WorkflowNodeType): ComponentType<NodeProps> | undefined {
    return this.get(type)?.component;
  }

  /**
   * Get editor component for a node type (for config panel).
   */
  getEditor(type: WorkflowNodeType): ComponentType<WorkflowNodeEditorProps> | undefined {
    return this.get(type)?.editor;
  }

  /**
   * Get icon for a node type.
   */
  getIcon(type: WorkflowNodeType): LucideIcon | undefined {
    return this.get(type)?.icon;
  }

  /**
   * Get color name for a node type.
   * Returns color key like "rose", "violet" - not full theme object.
   */
  getColor(type: WorkflowNodeType): string | undefined {
    return this.get(type)?.color;
  }

  /**
   * Get size tier for a node type.
   */
  getSize(type: WorkflowNodeType): "compact" | "standard" | undefined {
    return this.get(type)?.size;
  }

  /**
   * Get handles configuration for a node type.
   */
  getHandles(type: WorkflowNodeType): NodeHandleConfig | undefined {
    return this.get(type)?.handles;
  }

  /**
   * Get form config for a node type.
   */
  getFormConfig(type: WorkflowNodeType): NodeFormConfig | undefined {
    return this.get(type)?.formConfig;
  }

  /**
   * Create default data for a node type.
   */
  createDefaultData(type: WorkflowNodeType): Record<string, unknown> | undefined {
    return this.get(type)?.createDefaultData();
  }

  /**
   * Get node types that can be added by user (excludes entry points like start).
   */
  getAddable(): AnyFrontendDescriptor[] {
    return this.getAll().filter((descriptor) => descriptor.handles.inputs.length > 0);
  }

  /**
   * Build React Flow nodeTypes map from registered definitions.
   * Used by ReactFlow component for custom node rendering.
   */
  getNodeTypesMap(): Record<string, ComponentType<NodeProps>> {
    const map: Record<string, ComponentType<NodeProps>> = {};
    for (const def of this.getAll()) {
      map[def.type] = def.component;
    }
    return map;
  }
}

// =============================================================================
// EMPTY EDITOR (for nodes without config)
// =============================================================================

/**
 * Placeholder editor for nodes without configurable properties.
 */
function EmptyEditor(_props: WorkflowNodeEditorProps) {
  return (
    <div className="text-sm text-muted-foreground">
      This node has no configurable properties.
    </div>
  );
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

/** Singleton registry instance */
export const workflowNodeRegistry = new WorkflowNodeRegistry();

// Re-export types for convenience
export type { FrontendWorkflowNodeDescriptor, WorkflowNodeEditorProps } from "./types";
