/**
 * Journey Node Descriptor Registry
 *
 * Stores base descriptors for journey node types.
 */

import { BaseRegistry } from "../registry/base-registry";
import type { JourneyStepData, NodeType } from "./index";
import type { JourneyNodeDescriptor } from "./descriptor";

type AnyJourneyDescriptor = JourneyNodeDescriptor<JourneyStepData, unknown>;

export class NodeDescriptorRegistry extends BaseRegistry<NodeType, AnyJourneyDescriptor> {
  register(key: NodeType, item: AnyJourneyDescriptor): void;
  register<TData extends JourneyStepData, TState = void>(
    descriptor: JourneyNodeDescriptor<TData, TState>
  ): void;
  register(
    keyOrDescriptor: NodeType | AnyJourneyDescriptor,
    item?: AnyJourneyDescriptor
  ): void {
    if (typeof keyOrDescriptor === "string") {
      super.register(keyOrDescriptor, item as AnyJourneyDescriptor);
      return;
    }
    super.register(keyOrDescriptor.type, keyOrDescriptor);
  }

  override(key: NodeType, item: AnyJourneyDescriptor): void;
  override<TData extends JourneyStepData, TState = void>(
    descriptor: JourneyNodeDescriptor<TData, TState>
  ): void;
  override(
    keyOrDescriptor: NodeType | AnyJourneyDescriptor,
    item?: AnyJourneyDescriptor
  ): void {
    if (typeof keyOrDescriptor === "string") {
      super.override(keyOrDescriptor, item as AnyJourneyDescriptor);
      return;
    }
    super.override(keyOrDescriptor.type, keyOrDescriptor);
  }

  getTyped<TData extends JourneyStepData, TState = void>(
    type: NodeType
  ): JourneyNodeDescriptor<TData, TState> | undefined {
    return this.get(type) as JourneyNodeDescriptor<TData, TState> | undefined;
  }
}

export const nodeDescriptorRegistry = new NodeDescriptorRegistry();
