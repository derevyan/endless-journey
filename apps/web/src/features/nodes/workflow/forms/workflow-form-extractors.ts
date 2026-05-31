/**
 * Workflow Form Extractors
 *
 * Extract form values from node data for each workflow node type.
 *
 * @module features/nodes/workflow/forms/workflow-form-extractors
 */

import type { WorkflowNodeType } from "@journey/schemas";
import type {
  EndNodeConfig,
  QuestionUnderstandingNodeConfig,
  GuardNodeConfig,
  MCPNodeConfig,
  UserApprovalNodeConfig,
  SetStateNodeConfig,
  TransformNodeConfig,
  IfElseNodeConfig,
  ContextNodeConfig,
  AgentNodeConfig,
} from "@journey/schemas";
import type {
  EndNodeFormValues,
  QuestionUnderstandingNodeFormValues,
  GuardNodeFormValues,
  MCPNodeFormValues,
  UserApprovalNodeFormValues,
  SetStateNodeFormValues,
  TransformNodeFormValues,
  IfElseNodeFormValues,
  ContextNodeFormValues,
  AgentNodeFormValues,
} from "./workflow-form-schemas";

// =============================================================================
// EXTRACTORS
// =============================================================================

/**
 * Extract End node form values from node data.
 */
export function extractEndNodeFields(data: EndNodeConfig): EndNodeFormValues {
  return {
    name: data.name,
    outputTemplate: data.outputTemplate,
  };
}

/**
 * Extract Question Understanding node form values from node data.
 */
export function extractQuestionUnderstandingNodeFields(
  data: QuestionUnderstandingNodeConfig
): QuestionUnderstandingNodeFormValues {
  return {
    name: data.name,
    outputVariable: data.outputVariable ?? "synthesized_question",
    includeReasoning: data.includeReasoning ?? false,
  };
}

/**
 * Extract Guard node form values from node data.
 */
export function extractGuardNodeFields(data: GuardNodeConfig): GuardNodeFormValues {
  return {
    name: data.name,
    workers: data.workers ?? ["safety_guard"],
    blockedMessage: data.blockedMessage ?? "I can't help with that request.",
    terminateOnBlock: data.terminateOnBlock ?? true,
  };
}

/**
 * Extract MCP node form values from node data.
 */
export function extractMCPNodeFields(data: MCPNodeConfig): MCPNodeFormValues {
  return {
    name: data.name,
    server: data.server ?? "",
    tool: data.tool ?? "",
    params: data.params ?? {},
    timeout: data.timeout ?? 30000,
    onError: data.onError ?? "fail",
    maxRetries: data.maxRetries ?? 1,
  };
}

/**
 * Extract User Approval node form values from node data.
 */
export function extractUserApprovalNodeFields(
  data: UserApprovalNodeConfig
): UserApprovalNodeFormValues {
  return {
    name: data.name,
    message: data.message ?? "",
    timeoutSeconds: data.timeoutSeconds,
    timeoutAction: data.timeoutAction ?? "skip",
    allowedRoles: data.allowedRoles,
  };
}

/**
 * Extract Set State node form values from node data.
 */
export function extractSetStateNodeFields(data: SetStateNodeConfig): SetStateNodeFormValues {
  return {
    name: data.name,
    key: data.key ?? "",
    value: data.value ?? "",
    isTemplate: data.isTemplate ?? false,
  };
}

/**
 * Extract Transform node form values from node data.
 */
export function extractTransformNodeFields(data: TransformNodeConfig): TransformNodeFormValues {
  const operation = data.operation;
  const baseValues = {
    name: data.name,
    operationType: operation?.type ?? "template",
    outputVariable: data.outputVariable ?? "",
  };

  if (!operation) {
    return baseValues;
  }

  // Extract type-specific fields based on operation type
  switch (operation.type) {
    case "extractJson":
      return { ...baseValues, sourceVariable: operation.sourceVariable };
    case "pick":
      return { ...baseValues, sourceVariable: operation.sourceVariable, fields: operation.fields };
    case "template":
      return { ...baseValues, template: operation.template };
    case "merge":
      return { ...baseValues, sources: operation.sources };
    default:
      return baseValues;
  }
}

/**
 * Extract If/Else node form values from node data.
 */
export function extractIfElseNodeFields(data: IfElseNodeConfig): IfElseNodeFormValues {
  if (data.conditionType === "expression") {
    return {
      name: data.name,
      conditionType: "expression",
      left: data.condition.left,
      operator: data.condition.operator,
      right: data.condition.right,
    };
  } else {
    return {
      name: data.name,
      conditionType: "intent",
      intents: data.intent.intents,
      minConfidence: data.intent.minConfidence,
    };
  }
}

/**
 * Extract Context node form values from node data.
 */
export function extractContextNodeFields(data: ContextNodeConfig): ContextNodeFormValues {
  return {
    name: data.name,
    sources: data.sources ?? [],
    outputVariable: data.outputVariable,
  };
}

/**
 * Extract Agent node form values from node data.
 */
export function extractAgentNodeFields(data: AgentNodeConfig): AgentNodeFormValues {
  // Map history strategy - form supports all strategies
  const historyStrategy = data.history?.strategy;

  // Use stored promptSource if available, fallback to deriving from promptRef for backward compatibility
  // This preserves tab selection when switching modes
  const promptSource = data.promptSource ?? (data.promptRef ? "repository" : "inline");

  return {
    name: data.name,
    // Prompt source configuration
    promptSource,
    systemPrompt: data.systemPrompt ?? "",
    promptRefName: data.promptRef?.name,
    promptRefVersionId: data.promptRef?.versionId,
    promptRefLabel: data.promptRef?.label ?? "production",
    // Variable mappings for repository prompts
    promptVariables: data.promptVariables,
    // LLM settings
    model: data.llm?.model ?? "gpt-4o-mini",
    temperature: data.llm?.temperature,
    reasoningEffort: data.llm?.reasoningEffort,
    enabledTools: data.unifiedTools?.enabled,
    toolTimingOverrides: data.unifiedTools?.toolTimingOverrides,
    historyStrategy,
    historyMaxMessages: data.history?.maxMessages,
    memoryEnabled: data.memory?.enabled,
    memoryMaxResults: data.memory?.maxResults,
    responseFormatType: data.responseFormat?.type,
    responseFormatName: data.responseFormat?.type === "json_schema" ? data.responseFormat.name : undefined,
    responseFormatSchema: data.responseFormat?.type === "json_schema"
      ? JSON.stringify(data.responseFormat.schema, null, 2)
      : undefined,
    outputVariable: data.outputVariable,
    messageSource: data.messageSource,
    enableQuickReplies: data.enableQuickReplies,
  };
}

// =============================================================================
// EXTRACTOR MAP
// =============================================================================

type ExtractorFn = (data: unknown) => Record<string, unknown>;

export const extractorMap: Partial<Record<WorkflowNodeType, ExtractorFn>> = {
  end: extractEndNodeFields as ExtractorFn,
  question_understanding: extractQuestionUnderstandingNodeFields as ExtractorFn,
  guard: extractGuardNodeFields as ExtractorFn,
  mcp: extractMCPNodeFields as ExtractorFn,
  user_approval: extractUserApprovalNodeFields as ExtractorFn,
  set_state: extractSetStateNodeFields as ExtractorFn,
  transform: extractTransformNodeFields as ExtractorFn,
  if_else: extractIfElseNodeFields as ExtractorFn,
  context: extractContextNodeFields as ExtractorFn,
  agent: extractAgentNodeFields as ExtractorFn,
};

/**
 * Extract form values from node data.
 */
export function extractWorkflowFields(
  nodeType: WorkflowNodeType,
  data: unknown
): Record<string, unknown> {
  const extractor = extractorMap[nodeType];
  if (extractor) {
    return extractor(data);
  }
  // Fallback: return data as-is
  return (data as Record<string, unknown>) ?? {};
}
