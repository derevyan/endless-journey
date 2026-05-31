/**
 * Workflow Form Builders
 *
 * Build node data from form values for each workflow node type.
 *
 * @module features/nodes/workflow/forms/workflow-form-builders
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
// BUILDERS
// =============================================================================

/**
 * Build End node data from form values.
 */
export function buildEndNodeData(values: EndNodeFormValues): EndNodeConfig {
  return {
    name: values.name || undefined,
    outputTemplate: values.outputTemplate || undefined,
  };
}

/**
 * Build Question Understanding node data from form values.
 */
export function buildQuestionUnderstandingNodeData(
  values: QuestionUnderstandingNodeFormValues
): QuestionUnderstandingNodeConfig {
  return {
    name: values.name || undefined,
    outputVariable: values.outputVariable,
    includeReasoning: values.includeReasoning,
  };
}

/**
 * Build Guard node data from form values.
 */
export function buildGuardNodeData(values: GuardNodeFormValues): GuardNodeConfig {
  return {
    name: values.name || undefined,
    workers: values.workers,
    blockedMessage: values.blockedMessage,
    terminateOnBlock: values.terminateOnBlock,
  };
}

/**
 * Build MCP node data from form values.
 */
export function buildMCPNodeData(values: MCPNodeFormValues): MCPNodeConfig {
  return {
    name: values.name || undefined,
    server: values.server,
    tool: values.tool,
    params: values.params,
    timeout: values.timeout,
    onError: values.onError,
    maxRetries: values.maxRetries,
  };
}

/**
 * Build User Approval node data from form values.
 */
export function buildUserApprovalNodeData(
  values: UserApprovalNodeFormValues
): UserApprovalNodeConfig {
  return {
    name: values.name || undefined,
    message: values.message,
    timeoutSeconds: values.timeoutSeconds,
    timeoutAction: values.timeoutAction,
    allowedRoles: values.allowedRoles,
  };
}

/**
 * Build Set State node data from form values.
 */
export function buildSetStateNodeData(values: SetStateNodeFormValues): SetStateNodeConfig {
  return {
    name: values.name || undefined,
    key: values.key,
    value: values.value,
    isTemplate: values.isTemplate,
  };
}

/**
 * Build Transform node data from form values.
 */
export function buildTransformNodeData(values: TransformNodeFormValues): TransformNodeConfig {
  let operation;
  switch (values.operationType) {
    case "extractJson":
      operation = {
        type: "extractJson" as const,
        sourceVariable: values.sourceVariable ?? "",
      };
      break;
    case "pick":
      operation = {
        type: "pick" as const,
        sourceVariable: values.sourceVariable ?? "",
        fields: values.fields ?? [],
      };
      break;
    case "template":
      operation = {
        type: "template" as const,
        template: values.template ?? "",
      };
      break;
    case "merge":
      operation = {
        type: "merge" as const,
        sources: values.sources ?? [],
      };
      break;
    default:
      operation = { type: "template" as const, template: "" };
  }

  return {
    name: values.name || undefined,
    operation,
    outputVariable: values.outputVariable,
  };
}

/**
 * Build If/Else node data from form values.
 */
export function buildIfElseNodeData(values: IfElseNodeFormValues): IfElseNodeConfig {
  if (values.conditionType === "expression") {
    return {
      name: values.name || undefined,
      conditionType: "expression",
      condition: {
        left: values.left ?? "",
        operator: values.operator ?? "===",
        right: values.right,
      },
    };
  } else {
    return {
      name: values.name || undefined,
      conditionType: "intent",
      intent: {
        intents: values.intents ?? [],
        minConfidence: values.minConfidence ?? 0.7,
      },
    };
  }
}

/**
 * Build Context node data from form values.
 */
export function buildContextNodeData(values: ContextNodeFormValues): ContextNodeConfig {
  return {
    name: values.name || undefined,
    sources: values.sources,
    outputVariable: values.outputVariable,
    _experimental: true,
  };
}

/**
 * Build Agent node data from form values.
 */
export function buildAgentNodeData(
  values: AgentNodeFormValues,
  existingData?: AgentNodeConfig
): AgentNodeConfig {
  // Parse JSON schema if provided
  let responseFormat;
  if (values.responseFormatType === "json_schema" && values.responseFormatName && values.responseFormatSchema) {
    try {
      responseFormat = {
        type: "json_schema" as const,
        name: values.responseFormatName,
        schema: JSON.parse(values.responseFormatSchema),
        strict: true,
        method: "functionCalling" as const,
      };
    } catch {
      // Keep existing if parse fails
      responseFormat = existingData?.responseFormat;
    }
  } else if (values.responseFormatType === "text") {
    responseFormat = { type: "text" as const };
  }

  // Build LLM config with required fields
  const llmConfig = {
    provider: existingData?.llm?.provider ?? ("openai" as const),
    model: values.model,
    temperature: values.temperature ?? existingData?.llm?.temperature ?? 0.7,
    maxTokens: existingData?.llm?.maxTokens,
    topP: existingData?.llm?.topP,
    frequencyPenalty: existingData?.llm?.frequencyPenalty,
    presencePenalty: existingData?.llm?.presencePenalty,
    reasoningEffort: values.reasoningEffort,
  };

  // Build prompt ref if name is provided (preserve even when in inline mode)
  // versionId takes precedence over label for pinned version selection
  const promptRef = values.promptRefName
    ? {
        name: values.promptRefName,
        versionId: values.promptRefVersionId,
        label: values.promptRefLabel ?? "production",
      }
    : undefined;

  return {
    name: values.name || undefined,
    // Store promptSource explicitly to preserve tab selection
    promptSource: values.promptSource ?? "inline",
    // Always preserve systemPrompt (serves as fallback in repository mode)
    systemPrompt: values.systemPrompt || undefined,
    // Always preserve promptRef if name is provided (preserves repository selection when in inline mode)
    promptRef,
    // Always preserve variable mappings if they exist
    promptVariables: values.promptVariables && Object.keys(values.promptVariables).length > 0
      ? values.promptVariables
      : undefined,
    llm: llmConfig,
    unifiedTools: values.enabledTools
      ? {
          enabled: values.enabledTools,
          mcpServers: existingData?.unifiedTools?.mcpServers,
          toolTimingOverrides: values.toolTimingOverrides,
        }
      : undefined,
    history: {
      strategy: values.historyStrategy ?? "simple",
      maxMessages: values.historyMaxMessages ?? 12,
    },
    memory: values.memoryEnabled !== undefined
      ? {
          enabled: values.memoryEnabled,
          autoInject: existingData?.memory?.autoInject ?? true,
          maxResults: values.memoryMaxResults ?? 10,
          recencyBias: existingData?.memory?.recencyBias ?? 0.3,
        }
      : undefined,
    responseFormat,
    outputVariable: values.outputVariable,
    messageSource: values.messageSource ?? "auto",
    enableQuickReplies: values.enableQuickReplies ?? false,
  };
}

// =============================================================================
// BUILDER MAP
// =============================================================================

type BuilderFn = (values: unknown, existingData?: unknown) => Record<string, unknown>;

export const builderMap: Partial<Record<WorkflowNodeType, BuilderFn>> = {
  end: buildEndNodeData as BuilderFn,
  question_understanding: buildQuestionUnderstandingNodeData as BuilderFn,
  guard: buildGuardNodeData as BuilderFn,
  mcp: buildMCPNodeData as BuilderFn,
  user_approval: buildUserApprovalNodeData as BuilderFn,
  set_state: buildSetStateNodeData as BuilderFn,
  transform: buildTransformNodeData as BuilderFn,
  if_else: buildIfElseNodeData as BuilderFn,
  context: buildContextNodeData as BuilderFn,
  agent: buildAgentNodeData as BuilderFn,
};

/**
 * Build node data from form values.
 */
export function buildWorkflowNodeData(
  nodeType: WorkflowNodeType,
  values: unknown,
  existingData?: unknown
): Record<string, unknown> {
  const builder = builderMap[nodeType];
  if (builder) {
    return builder(values, existingData);
  }
  // Fallback: return values as-is
  return (values ?? {}) as Record<string, unknown>;
}
