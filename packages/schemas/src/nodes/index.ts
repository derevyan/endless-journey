// Node schemas - central export for all node type definitions
import { z } from "zod";

// Base schemas and utilities
export {
  BaseNodeDataSchema,
  CrmActionSchema,
  EdgeStyleSchema,
  MediaSchema,
  MediaTypeSchema,
  NodeMetadataSchema,
  PositionSchema,
  TagActionSchema,
  TimerSchema,
  VariableActionSchema,
  type BaseNodeData,
  type CrmAction,
  type EdgeStyle,
  type Media,
  type MediaType,
  type NodeMetadata,
  type Position,
  type TagAction,
  type Timer,
  type VariableAction,
} from "./base";

// AI context settings - used by agent nodes and follow-up plugin
export { AIContextSettingsSchema, type AIContextSettings } from "./ai-context";

// Button configuration - used by message and end nodes
export { ButtonConfigSchema, ButtonsSchema, type ButtonConfig, type Buttons } from "./button";

// Follow-up sequence schemas - reused by plugin system (FollowUpPluginData)
export {
  DurationSchema,
  durationToMs,
  FollowUpButtonSchema,
  FollowUpSequenceSchema,
  FollowUpStepSchema,
  type Duration,
  type FollowUpButton,
  type FollowUpSequence,
  type FollowUpStep,
} from "./follow-up";

// Declarative HTTP configuration (shared by HTTP-capable nodes)
export {
  HttpMethods,
  HttpMethodSchema,
  HttpNodeConfigSchema,
  HttpOperationConfigSchema,
  HttpRetryConfigSchema,
  type HttpMethod,
  type HttpNodeConfig,
  type HttpOperationConfig,
  type HttpRetryConfig,
} from "./http-config";

// Journey node schemas + descriptors
export * from "./types/journey";

// Import for union creation
import { AgentNodeDataSchema } from "./types/journey/agent/schema";
import { ConditionNodeDataSchema } from "./types/journey/condition/schema";
import { CrmNodeDataSchema } from "./types/journey/crm/schema";
import { EndNodeDataSchema } from "./types/journey/end/schema";
import { MessageNodeDataSchema } from "./types/journey/message/schema";
import { QuestionnaireNodeDataSchema } from "./types/journey/questionnaire/schema";
import { StartNodeDataSchema } from "./types/journey/start/schema";
import { TeleportNodeDataSchema } from "./types/journey/teleport/schema";
import { WaitNodeDataSchema } from "./types/journey/wait/schema";
import { WebhookNodeDataSchema } from "./types/journey/webhook/schema";

// Named constants for node types (source of truth)
export const NodeTypes = {
  START: "start",
  MESSAGE: "message",
  CONDITION: "condition",
  WAIT: "wait",
  WEBHOOK: "webhook",
  CRM: "crm",
  TELEPORT: "teleport",
  END: "end",
  QUESTIONNAIRE: "questionnaire",
  AGENT: "agent",
} as const;

// Node Type enum values - derived from NodeTypes for Zod schema
export const NodeTypeValues = [
  NodeTypes.START,
  NodeTypes.MESSAGE,
  NodeTypes.CONDITION,
  NodeTypes.WAIT,
  NodeTypes.WEBHOOK,
  NodeTypes.CRM,
  NodeTypes.TELEPORT,
  NodeTypes.END,
  NodeTypes.QUESTIONNAIRE,
  NodeTypes.AGENT,
] as const;

// Node Type enum schema
export const NodeTypeSchema = z.enum(NodeTypeValues);

// Union of all node data types (discriminated union on 'type' field)
export const JourneyStepDataSchema = z.discriminatedUnion("type", [
  StartNodeDataSchema,
  MessageNodeDataSchema,
  ConditionNodeDataSchema,
  WaitNodeDataSchema,
  WebhookNodeDataSchema,
  CrmNodeDataSchema,
  TeleportNodeDataSchema,
  EndNodeDataSchema,
  QuestionnaireNodeDataSchema,
  AgentNodeDataSchema,
]);

// Type exports
export type NodeType = z.infer<typeof NodeTypeSchema>;
export type JourneyStepData = z.infer<typeof JourneyStepDataSchema>;

// Node capabilities (Phase 4: Pluggable Feature System)
export {
  DEFAULT_CAPABILITIES,
  getNodeCapabilities,
  getNodeTypesWithCapability,
  hasCapability,
  NODE_CAPABILITIES,
  NodeCapabilitiesSchema,
  type NodeCapabilities,
} from "./capabilities";

// Output schemas registry - maps node types to their output structures
export {
  // Registry and helpers
  getNodeOutputSchema,
  nodeProducesOutput,
  NodeOutputSchemas,
  // Individual output schemas
  AgentConversationMetricsSchema,
  AgentNodeOutputSchema,
  AgentResponseSchema,
  ConditionNodeOutputSchema,
  CrmNodeOutputSchema,
  EndNodeOutputSchema,
  MessageNodeOutputSchema,
  QuestionnaireNodeOutputSchema,
  StartNodeOutputSchema,
  WaitNodeOutputSchema,
  WebhookNodeOutputSchema,
  // Output types
  type AgentConversationMetrics,
  type AgentNodeOutput,
  type AgentResponse,
  type ConditionNodeOutput,
  type CrmNodeOutput,
  type EndNodeOutput,
  type MessageNodeOutput,
  type QuestionnaireNodeOutput,
  type StartNodeOutput,
  type WaitNodeOutput,
  type WebhookNodeOutput,
} from "./output-registry";

// Node descriptors + handles
export { type HandleDefinition, type NodeHandleConfig } from "./handles";
export {
  type JourneyNodeDescriptor,
  type NodeDescriptorBase,
  type NodeSystem,
  type NodeVersionInfo,
  type WorkflowNodeDescriptor,
  type JourneyNodeCategory,
  type WorkflowNodeCategory,
} from "./descriptor";
export { NodeDescriptorRegistry, nodeDescriptorRegistry } from "./descriptor-registry";
export {
  WorkflowNodeDescriptorRegistry,
  workflowNodeDescriptorRegistry,
} from "./workflow-descriptor-registry";
export {
  NodeVersionRegistry,
  nodeVersionRegistry,
  type MigrationEntry,
  type NodeMigration,
} from "./version";

// Workflow descriptors
export * from "./types/workflow";
