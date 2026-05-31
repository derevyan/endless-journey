/**
 * Workflow Node Descriptor Registry
 *
 * Stores base descriptors for workflow node types.
 */

import { BaseRegistry } from "../registry/base-registry";
import type { WorkflowNodeType } from "../agents/workflow/node-type";
import type { WorkflowNodeDescriptor } from "./descriptor";

type AnyWorkflowDescriptor = WorkflowNodeDescriptor<Record<string, unknown>>;

export class WorkflowNodeDescriptorRegistry extends BaseRegistry<
  WorkflowNodeType,
  AnyWorkflowDescriptor
> {
  register(key: WorkflowNodeType, item: AnyWorkflowDescriptor): void;
  register<TData>(descriptor: WorkflowNodeDescriptor<TData>): void;
  register(
    keyOrDescriptor: WorkflowNodeType | AnyWorkflowDescriptor,
    item?: AnyWorkflowDescriptor
  ): void {
    if (typeof keyOrDescriptor === "string") {
      super.register(keyOrDescriptor, item as AnyWorkflowDescriptor);
      return;
    }
    super.register(keyOrDescriptor.type, keyOrDescriptor);
  }

  override(key: WorkflowNodeType, item: AnyWorkflowDescriptor): void;
  override<TData>(descriptor: WorkflowNodeDescriptor<TData>): void;
  override(
    keyOrDescriptor: WorkflowNodeType | AnyWorkflowDescriptor,
    item?: AnyWorkflowDescriptor
  ): void {
    if (typeof keyOrDescriptor === "string") {
      super.override(keyOrDescriptor, item as AnyWorkflowDescriptor);
      return;
    }
    super.override(keyOrDescriptor.type, keyOrDescriptor);
  }

  getTyped<TData>(type: WorkflowNodeType): WorkflowNodeDescriptor<TData> | undefined {
    return this.get(type) as WorkflowNodeDescriptor<TData> | undefined;
  }
}

export const workflowNodeDescriptorRegistry = new WorkflowNodeDescriptorRegistry();
