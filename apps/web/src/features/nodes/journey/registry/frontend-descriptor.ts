/**
 * Frontend Node Descriptor
 *
 * Extends the shared journey node descriptor with UI-specific configuration.
 */

import type { ComponentType } from "react";
import type { LucideIcon } from "lucide-react";

import { createLogger } from "@journey/logger";
import type { JourneyNodeDescriptor, JourneyStepData, NodeType } from "@journey/schemas";
import { BaseRegistry } from "@journey/schemas";

import type { FrontendDescriptorBase, NodeFormConfig } from "@/features/nodes/shared/frontend-descriptor";

import type { NodeEditorProps } from "../editors/types";
import type { NodeColorScheme } from "../config/node-theme";
import type { FormHandlers } from "./form-registry";
import { formRegistry } from "./form-registry";

// =============================================================================
// COMPONENT PROP TYPES
// =============================================================================

/**
 * Props for visual node components rendered in React Flow canvas.
 *
 * Simplified: Only data is passed by NodeWrapper.
 * Visualization state (selected, isEditMode, journey path) is derived
 * from stores via useNodeVisualization hook in BaseNode/WaitNode.
 */
export interface NodeComponentProps {
  data: JourneyStepData;
}

const DEFAULT_FORM_CONFIG: NodeFormConfig = {
  autoSave: false,
  saveDebounceMs: 300,
};

/**
 * Complete frontend descriptor for a journey node type.
 */
export interface FrontendNodeDescriptor<
  TData extends JourneyStepData = JourneyStepData,
  TState = void
> extends JourneyNodeDescriptor<TData, TState>,
    FrontendDescriptorBase<NodeComponentProps, NodeEditorProps> {
  /** Color scheme for theming */
  colors: NodeColorScheme;
  /** Editor panel component */
  editor: ComponentType<NodeEditorProps>;
  /** Form handlers for schema + transform */
  formHandlers: FormHandlers;
}

const log = createLogger("frontend-node-registry");

type AnyFrontendDescriptor = FrontendNodeDescriptor<JourneyStepData, unknown>;

/**
 * Frontend node registry.
 */
export class FrontendNodeRegistry extends BaseRegistry<NodeType, AnyFrontendDescriptor> {
  constructor() {
    super({
      onDuplicate: (nodeType) => {
        log.warn({ nodeType }, "frontendNodeRegistry:duplicateRegistration");
      },
      allowOverwrite: true,
    });
  }

  register(key: NodeType, item: AnyFrontendDescriptor): void;
  register<TData extends JourneyStepData, TState = void>(
    descriptor: FrontendNodeDescriptor<TData, TState>
  ): void;
  register(
    keyOrDescriptor: NodeType | AnyFrontendDescriptor,
    item?: AnyFrontendDescriptor
  ): void {
    if (typeof keyOrDescriptor === "string") {
      super.register(keyOrDescriptor, item as FrontendNodeDescriptor);
      if (item) {
        formRegistry.register(keyOrDescriptor, item.formHandlers);
      }
      return;
    }
    super.register(keyOrDescriptor.type, keyOrDescriptor);
    formRegistry.register(keyOrDescriptor.type, keyOrDescriptor.formHandlers);
  }

  override(key: NodeType, item: AnyFrontendDescriptor): void;
  override<TData extends JourneyStepData, TState = void>(
    descriptor: FrontendNodeDescriptor<TData, TState>
  ): void;
  override(
    keyOrDescriptor: NodeType | AnyFrontendDescriptor,
    item?: AnyFrontendDescriptor
  ): void {
    if (typeof keyOrDescriptor === "string") {
      super.override(keyOrDescriptor, item as FrontendNodeDescriptor);
      if (item) {
        formRegistry.register(keyOrDescriptor, item.formHandlers);
      }
      return;
    }
    super.override(keyOrDescriptor.type, keyOrDescriptor);
    formRegistry.register(keyOrDescriptor.type, keyOrDescriptor.formHandlers);
  }

  getComponent(type: NodeType): ComponentType<NodeComponentProps> | undefined {
    return this.get(type)?.component;
  }

  getEditor(type: NodeType): ComponentType<NodeEditorProps> | undefined {
    return this.get(type)?.editor;
  }

  getIcon(type: NodeType): LucideIcon | undefined {
    return this.get(type)?.icon;
  }

  getColors(type: NodeType): NodeColorScheme | undefined {
    return this.get(type)?.colors;
  }

  getFormConfig(type: NodeType): NodeFormConfig {
    return this.get(type)?.formConfig ?? DEFAULT_FORM_CONFIG;
  }

  getAddable(): AnyFrontendDescriptor[] {
    return this.getAll().filter((descriptor) => descriptor.handles.inputs.length > 0);
  }

  createDefaultData(type: NodeType): JourneyStepData | undefined {
    return this.get(type)?.createDefaultData();
  }
}

export const frontendNodeRegistry = new FrontendNodeRegistry();

export type { NodeFormConfig };
