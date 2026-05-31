/**
 * Node Descriptor Types
 *
 * Unified descriptor interfaces shared across journey and workflow nodes.
 */

import type { z } from "zod";

import type { NodeCapabilities } from "./capabilities";
import type { NodeHandleConfig } from "./handles";
import type { JourneyStepData, NodeType } from "./index";
import type { WorkflowNodeType } from "../agents/workflow/node-type";
import type { MigrationEntry } from "./version";

export type NodeSystem = "journey" | "workflow";

export type JourneyNodeCategory = "flow" | "action" | "logic" | "integration";
export type WorkflowNodeCategory = "core" | "tools" | "logic" | "data";

/**
 * Versioning metadata for a node descriptor.
 */
export interface NodeVersionInfo {
  /** Earliest version that can be migrated to latest */
  minSupported: number;
  /** Optional inline migrations (alternative to registry) */
  migrations?: MigrationEntry[];
}

/**
 * Base descriptor shared by journey and workflow nodes.
 */
export interface NodeDescriptorBase<TData, TCategory extends string, TState = void> {
  // Identity
  readonly system: NodeSystem;
  readonly type: string;
  readonly version: number;
  readonly displayName: string;
  readonly description: string;
  readonly category: TCategory;

  // Schema
  readonly schema: z.ZodType<TData>;
  readonly handles: NodeHandleConfig;
  readonly stateSchema?: z.ZodType<TState>;

  // Versioning
  readonly versionInfo?: NodeVersionInfo;

  // Factory + guard
  createDefaultData(): TData;
  isType(data: unknown): data is TData;
}

/**
 * Journey node descriptor.
 */
export interface JourneyNodeDescriptor<
  TData extends JourneyStepData = JourneyStepData,
  TState = void
> extends NodeDescriptorBase<TData, JourneyNodeCategory, TState> {
  readonly system: "journey";
  readonly type: NodeType;
  readonly capabilities: NodeCapabilities;
}

/**
 * Workflow node descriptor.
 */
export interface WorkflowNodeDescriptor<TData = Record<string, unknown>>
  extends NodeDescriptorBase<TData, WorkflowNodeCategory> {
  readonly system: "workflow";
  readonly type: WorkflowNodeType;
  readonly size: "compact" | "standard";
}

