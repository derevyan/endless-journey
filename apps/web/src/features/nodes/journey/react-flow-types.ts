/**
 * Node Types - React Flow Extensions
 *
 * This file is the ONLY place in the web app where React Flow-specific types are defined.
 * All base types are imported from @journey/schemas (single source of truth).
 *
 * ## Type Hierarchy
 *
 * ```
 * @journey/schemas (source of truth)
 *   ├── NodeType, EdgeType (enums)
 *   ├── JourneyStepData, NodeMetadata
 *   ├── StartNodeData, MessageNodeData, ConditionNodeData, etc.
 *   └── JourneyConfig (Zod-inferred, for validation/serialization)
 *
 * apps/web/src/features/nodes/journey/react-flow-types.ts (this file - React Flow extensions)
 *   ├── Re-exports all types from @journey/schemas
 *   ├── JourneyNode = Node<JourneyStepData, "custom"> (React Flow)
 *   ├── JourneyEdge extends Edge (React Flow)
 *   ├── JourneyNodeWithMetadata (with metadata)
 *   └── JourneyConfig (React Flow version, structurally compatible)
 * ```
 *
 * ## When to Use Which
 *
 * | Context | Use |
 * |---------|-----|
 * | Validation (Zod schemas) | `@journey/schemas` |
 * | Engine execution | `@journey/schemas` |
 * | API serialization | `@journey/schemas` |
 * | React Flow rendering | This file |
 * | UI state management | This file |
 *
 * ## IMPORTANT: Never Duplicate Types
 *
 * - DO NOT create new type definitions that duplicate @journey/schemas
 * - If you need a new shared type, add it to @journey/schemas first
 * - Only extend types here when React Flow specifics are needed
 */

import type {
  JourneyConfig as BaseJourneyConfig,
  EdgeType as EdgeTypeFromSchema,
  JourneyStepData,
  NodeMetadata,
  NodeType as NodeTypeFromSchema,
} from "@journey/schemas";
import { EdgeTypes, EdgeTypeValues, NodeTypes, NodeTypeValues } from "@journey/schemas";
import type { Edge, Node } from "@xyflow/react";

// Re-export types from schemas
export type {
  // Agent node types
  AgentNodeData,
  ConditionBranch,
  ConditionNodeData,
  ConditionOperator,
  ConditionRule,
  // CRM node types
  CrmNodeData,
  EdgeStyle,
  EndNodeData,
  ErrorHandling,
  HttpMethod,
  JourneyStepData,
  MessageNodeData,
  NodeMetadata,
  // Questionnaire node types
  Question,
  QuestionnaireNodeData,
  QuestionnaireState,
  QuestionnaireTimeout,
  // Response type for message nodes
  ResponseType,
  // Node data types
  StartNodeData,
  // Teleport node type
  TeleportNodeData,
  Timer,
  WaitNodeData,
  WebhookNodeData,
} from "@journey/schemas";

// Type aliases for schema-derived types (single source of truth)
export type NodeType = NodeTypeFromSchema;
export type EdgeType = EdgeTypeFromSchema;

// Re-export named constants from schemas (no magic numbers!)
export { EdgeTypes as EdgeTypeEnum, NodeTypes as NodeTypeEnum };

// Also re-export the arrays if needed
export { EdgeTypeValues, NodeTypeValues };

// React Flow node type with our custom data
export type JourneyNode = Node<JourneyStepData, "custom">;

// React Flow edge type with our custom properties
export interface JourneyEdge extends Edge {
  sourceHandle?: string; // For timer edges: "timer", for condition branches: branch id
  edgeType?: EdgeType;
  style?: {
    stroke: string;
    strokeWidth: number;
    strokeDasharray?: string;
  };
  // Managed edge properties (auto-created from button/followup targets)
  managed?: boolean; // true = auto-created, engine sees it, UI protects it
  managedBy?: string; // "button-{buttonId}" or "followup-{stepIdx}-{buttonId}"
}

// Node with metadata
export interface JourneyNodeWithMetadata extends JourneyNode {
  metadata: NodeMetadata;
}

/**
 * Journey config structure for React Flow rendering.
 *
 * Extends the base JourneyConfig from @journey/schemas with React Flow-specific types.
 *
 * Differences from base:
 * - Uses `JourneyNodeWithMetadata[]` (React Flow Node with extensions)
 * - Uses `JourneyEdge[]` (React Flow Edge with extensions)
 *
 * Both are structurally compatible for JSON serialization, but TypeScript
 * treats them as distinct types. Use this version for React Flow components,
 * use @journey/schemas version for validation and engine execution.
 *
 * @see BaseJourneyConfig from @journey/schemas for the Zod schema version
 */
export interface JourneyConfig extends Omit<BaseJourneyConfig, "nodes" | "edges"> {
  nodes: JourneyNodeWithMetadata[];
  edges: JourneyEdge[];
}

// Version management types (API-only, from @journey/schemas)
export type { JourneyVersion, VersionedJourneyData } from "@journey/schemas";
