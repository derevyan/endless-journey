/**
 * Output Registry - Central registry mapping node types to their output schemas
 *
 * This registry provides a single source of truth for what data structure
 * each node type produces when executed. Used for:
 * - Mock data generation in variable selector UI
 * - Type introspection for webhook body previews
 * - Runtime validation of node outputs
 */

import type { z } from "zod";
import type { NodeType } from "./index";
import { AgentNodeOutputSchema } from "./types/journey/agent/schema";
import { ConditionNodeOutputSchema } from "./types/journey/condition/schema";
import { CrmNodeOutputSchema } from "./types/journey/crm/schema";
import { EndNodeOutputSchema } from "./types/journey/end/schema";
import { MessageNodeOutputSchema } from "./types/journey/message/schema";
import { QuestionnaireNodeOutputSchema } from "./types/journey/questionnaire/schema";
import { StartNodeOutputSchema } from "./types/journey/start/schema";
import { WaitNodeOutputSchema } from "./types/journey/wait/schema";
import { WebhookNodeOutputSchema } from "./types/journey/webhook/schema";

/**
 * Registry mapping node types to their output schemas
 *
 * Each schema defines the exact structure stored via storeNodeOutput()
 * in the corresponding handler. Output schemas mirror handler implementations.
 */
export const NodeOutputSchemas = {
  agent: AgentNodeOutputSchema,
  message: MessageNodeOutputSchema,
  questionnaire: QuestionnaireNodeOutputSchema,
  webhook: WebhookNodeOutputSchema,
  wait: WaitNodeOutputSchema,
  condition: ConditionNodeOutputSchema,
  crm: CrmNodeOutputSchema,
  start: StartNodeOutputSchema,
  end: EndNodeOutputSchema,
  teleport: null, // Teleport nodes don't produce output (they redirect)
} as const;

/**
 * Get the output schema for a specific node type
 *
 * @param nodeType - The type of node to get schema for
 * @returns The Zod schema for the node's output, or null if node doesn't produce output
 *
 * @example
 * const schema = getNodeOutputSchema("agent");
 * if (schema) {
 *   const result = schema.parse(nodeOutput);
 * }
 */
export function getNodeOutputSchema(nodeType: NodeType): z.ZodTypeAny | null {
  return NodeOutputSchemas[nodeType] ?? null;
}

/**
 * Check if a node type produces output
 *
 * @param nodeType - The type of node to check
 * @returns true if the node produces output, false otherwise
 */
export function nodeProducesOutput(nodeType: NodeType): boolean {
  return NodeOutputSchemas[nodeType] !== null;
}

// Re-export individual output schemas for direct imports
export {
  AgentNodeOutputSchema,
  AgentResponseSchema,
  AgentConversationMetricsSchema,
  type AgentNodeOutput,
  type AgentResponse,
  type AgentConversationMetrics,
} from "./types/journey/agent/schema";

export { MessageNodeOutputSchema, type MessageNodeOutput } from "./types/journey/message/schema";

export { QuestionnaireNodeOutputSchema, type QuestionnaireNodeOutput } from "./types/journey/questionnaire/schema";

export { WebhookNodeOutputSchema, type WebhookNodeOutput } from "./types/journey/webhook/schema";

export { WaitNodeOutputSchema, type WaitNodeOutput } from "./types/journey/wait/schema";

export { ConditionNodeOutputSchema, type ConditionNodeOutput } from "./types/journey/condition/schema";

export { CrmNodeOutputSchema, type CrmNodeOutput } from "./types/journey/crm/schema";

export { StartNodeOutputSchema, type StartNodeOutput } from "./types/journey/start/schema";

export { EndNodeOutputSchema, type EndNodeOutput } from "./types/journey/end/schema";
