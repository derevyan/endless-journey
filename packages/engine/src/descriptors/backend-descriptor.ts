/**
 * Backend Node Descriptor
 *
 * Extends the shared journey node descriptor with execution handlers.
 */

import type { JourneyNodeDescriptor, JourneyStepData, NodeType } from "@journey/schemas";
import { BaseRegistry } from "@journey/schemas";
import type { NodeHandler } from "../types";

export interface BackendNodeDescriptor<
  TData extends JourneyStepData = JourneyStepData,
  TState = void
> extends JourneyNodeDescriptor<TData, TState> {
  execution: NodeHandler;
}

type AnyBackendDescriptor = BackendNodeDescriptor<JourneyStepData, unknown>;

export class BackendNodeRegistry extends BaseRegistry<NodeType, AnyBackendDescriptor> {
  register(key: NodeType, item: AnyBackendDescriptor): void;
  register<TData extends JourneyStepData, TState = void>(
    descriptor: BackendNodeDescriptor<TData, TState>
  ): void;
  register(
    keyOrDescriptor: NodeType | AnyBackendDescriptor,
    item?: AnyBackendDescriptor
  ): void {
    if (typeof keyOrDescriptor === "string") {
      super.register(keyOrDescriptor, item as AnyBackendDescriptor);
      return;
    }
    super.register(keyOrDescriptor.type, keyOrDescriptor);
  }

  override(key: NodeType, item: AnyBackendDescriptor): void;
  override<TData extends JourneyStepData, TState = void>(
    descriptor: BackendNodeDescriptor<TData, TState>
  ): void;
  override(
    keyOrDescriptor: NodeType | AnyBackendDescriptor,
    item?: AnyBackendDescriptor
  ): void {
    if (typeof keyOrDescriptor === "string") {
      super.override(keyOrDescriptor, item as AnyBackendDescriptor);
      return;
    }
    super.override(keyOrDescriptor.type, keyOrDescriptor);
  }

  getHandler(type: NodeType): NodeHandler | undefined {
    return this.get(type)?.execution;
  }
}

export const backendNodeRegistry = new BackendNodeRegistry();
