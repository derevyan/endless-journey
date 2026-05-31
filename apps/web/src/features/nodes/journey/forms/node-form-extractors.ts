/**
 * Node Form Extractors
 *
 * Type-specific functions to extract default form values from node data.
 * Used by the unified useNodeEditorForm hook.
 *
 * Note: Capability-based extraction (timer, tags, variables, CRM) is handled
 * by fieldRegistry.extractAll() using definitions in field-definitions.ts.
 * These extractors focus on node-specific fields that are not covered by
 * shared capabilities.
 */

import type { AIContextSettings, ConditionRule, ErrorHandling, HttpMethod } from "@journey/schemas";

import { secondsToDHMS } from "@/shared/lib/utils/duration-utils";
import { generateShortId } from "@/shared/lib/utils/id";
import type { JourneyNode, JourneyNodeWithMetadata, ResponseType } from "@/features/nodes/journey/react-flow-types";

import { fieldRegistry } from "./field-registry";
import type {
  CrmActionFormValue,
  TagActionFormValue,
  VariableActionFormValue,
  VariableOperationFormValue,
} from "./node-form-builders";

// ============================================================================
// Duration Extraction Helpers
// ============================================================================

// Specific return types for each prefix
interface TimerDurationFields {
  timerDays: number | undefined;
  timerHours: number | undefined;
  timerMinutes: number | undefined;
  timerSeconds: number | undefined;
}

interface DurationDurationFields {
  durationDays: number | undefined;
  durationHours: number | undefined;
  durationMinutes: number | undefined;
  durationSeconds: number | undefined;
}

interface TimeoutDurationFields {
  timeoutDays: number | undefined;
  timeoutHours: number | undefined;
  timeoutMinutes: number | undefined;
  timeoutSeconds: number | undefined;
}

type PrefixedDurationFields<P extends "timer" | "duration" | "timeout"> = P extends "timer"
  ? TimerDurationFields
  : P extends "duration"
    ? DurationDurationFields
    : TimeoutDurationFields;

/**
 * Helper to build duration fields with a specific prefix
 */
function buildDurationFields<P extends "timer" | "duration" | "timeout">(
  prefix: P,
  parts: { days: number; hours: number; minutes: number; seconds: number } | null
): PrefixedDurationFields<P> {
  if (prefix === "timer") {
    return {
      timerDays: parts?.days || undefined,
      timerHours: parts?.hours || undefined,
      timerMinutes: parts?.minutes || undefined,
      timerSeconds: parts?.seconds || undefined,
    } as PrefixedDurationFields<P>;
  }
  if (prefix === "timeout") {
    return {
      timeoutDays: parts?.days || undefined,
      timeoutHours: parts?.hours || undefined,
      timeoutMinutes: parts?.minutes || undefined,
      timeoutSeconds: parts?.seconds || undefined,
    } as PrefixedDurationFields<P>;
  }
  return {
    durationDays: parts?.days || undefined,
    durationHours: parts?.hours || undefined,
    durationMinutes: parts?.minutes || undefined,
    durationSeconds: parts?.seconds || undefined,
  } as PrefixedDurationFields<P>;
}

/**
 * Generic duration field extractor
 * Extracts seconds from node data and returns prefixed DHMS fields
 */
function extractDurationWithPrefix<P extends "timer" | "duration" | "timeout">(
  node: JourneyNode,
  sourceField: "timer" | "duration" | "timeout",
  prefix: P
): PrefixedDurationFields<P> {
  if (!(sourceField in node.data)) return buildDurationFields(prefix, null);

  const fieldValue = node.data[sourceField as keyof typeof node.data];
  if (!fieldValue || typeof fieldValue !== "object") return buildDurationFields(prefix, null);

  const durationObj = fieldValue as { seconds?: number; duration?: string };

  // Format: { seconds: number }
  if (typeof durationObj.seconds === "number") {
    return buildDurationFields(prefix, secondsToDHMS(durationObj.seconds));
  }

  return buildDurationFields(prefix, null);
}

// ============================================================================
// Common Field Extractors
// ============================================================================

/**
 * Extract tagAction field from node data (single scope)
 */
export function extractTagAction(node: JourneyNode): TagActionFormValue | undefined {
  if ("tagAction" in node.data && node.data.tagAction && typeof node.data.tagAction === "object") {
    const tagAction = node.data.tagAction as TagActionFormValue;
    const operations = tagAction.tags || { add: [], remove: [] };
    return {
      tags: operations,
    };
  }
  return undefined;
}

/**
 * Extract variableAction field from node data
 */
export function extractVariableAction(node: JourneyNode): VariableActionFormValue | undefined {
  if ("variableAction" in node.data && node.data.variableAction && typeof node.data.variableAction === "object") {
    type VariableOperationFormValueInput = Omit<VariableOperationFormValue, "id"> & { id?: string };
    const ensureOperationIds = (
      operations: VariableOperationFormValueInput[] | undefined
    ): VariableOperationFormValue[] =>
      (operations ?? []).map((operation) => ({
        ...operation,
        id: operation.id ?? generateShortId("var-op"),
      }));

    const variableAction = node.data.variableAction as VariableActionFormValue;
    return {
      userOperations: ensureOperationIds(variableAction.userOperations as VariableOperationFormValueInput[]),
      journeyOperations: ensureOperationIds(variableAction.journeyOperations as VariableOperationFormValueInput[]),
      globalOperations: ensureOperationIds(variableAction.globalOperations as VariableOperationFormValueInput[]),
    };
  }
  return undefined;
}

/**
 * Extract crmAction field from node data
 */
export function extractCrmAction(node: JourneyNode): CrmActionFormValue | undefined {
  if ("crmAction" in node.data && node.data.crmAction && typeof node.data.crmAction === "object") {
    const crmAction = node.data.crmAction as CrmActionFormValue;
    return {
      pipelineId: crmAction.pipelineId,
      stageId: crmAction.stageId,
      notes: crmAction.notes,
    };
  }
  return undefined;
}

/**
 * Extract common fields shared by all node types.
 * Note: tagAction, variableAction, crmAction are now handled by fieldRegistry.extractAll()
 */
export function extractCommonFields(node: JourneyNode) {
  const nodeWithMetadata = node as JourneyNodeWithMetadata;
  return {
    label: node.data.label,
    tags: (node.data as { tags?: string[] }).tags || [],
    notes: nodeWithMetadata.metadata?.notes || "",
    customJson: nodeWithMetadata.metadata?.custom ? JSON.stringify(nodeWithMetadata.metadata.custom, null, 2) : "",
  };
}

// ============================================================================
// Message Node Extractors
// ============================================================================

/**
 * Extract timer fields from message node data
 */
export function extractTimerFields(node: JourneyNode) {
  return extractDurationWithPrefix(node, "timer", "timer");
}

/**
 * Extract timeout fields from node data.
 * Supports both questionnaire nodes (targetNodeId) and agent nodes (timeoutMessage).
 * Includes DHMS fields plus optional targetNodeId and timeoutMessage.
 */
export function extractTimeoutFields(node: JourneyNode) {
  const durationFields = extractDurationWithPrefix(node, "timeout", "timeout");

  let targetNodeId: string | undefined;
  let timeoutMessage: string | undefined;

  if ("timeout" in node.data && typeof node.data.timeout === "object" && node.data.timeout !== null) {
    const timeout = node.data.timeout as { targetNodeId?: string; timeoutMessage?: string };
    targetNodeId = timeout.targetNodeId;
    timeoutMessage = timeout.timeoutMessage;
  }

  return {
    ...durationFields,
    timeoutTargetNodeId: targetNodeId,
    timeoutMessage: timeoutMessage,
  };
}

/**
 * Extract response type from node data
 */
export function extractResponseType(node: JourneyNode): ResponseType | undefined {
  if ("responseType" in node.data && node.data.responseType) {
    return node.data.responseType as ResponseType;
  }
  return undefined;
}

/**
 * Extract media field from node data
 * Returns the media object or null if not set
 */
export function extractMediaField(node: JourneyNode): { type: "image" | "video"; url: string; filename?: string; mediaId?: string } | null {
  if ("media" in node.data && node.data.media && typeof node.data.media === "object") {
    const media = node.data.media as { type?: string; url?: string; filename?: string; mediaId?: string };
    if (media.type && media.url && (media.type === "image" || media.type === "video")) {
      return {
        type: media.type,
        url: media.url,
        // Only include filename if it has a value (matches builder behavior)
        ...(media.filename && { filename: media.filename }),
        ...(media.mediaId && { mediaId: media.mediaId }),
      };
    }
  }
  return null;
}

/**
 * Check if node has media configured (for collapsible section state)
 */
export function hasMediaSet(node: JourneyNode): boolean {
  if (!("media" in node.data) || !node.data.media) return false;
  const media = node.data.media;
  if (typeof media !== "object") return false;
  return "url" in media && typeof media.url === "string" && media.url.length > 0;
}

/**
 * Check if node has a timer configured (for collapsible section state)
 */
export function hasTimerSet(node: JourneyNode): boolean {
  if (!("timer" in node.data) || !node.data.timer) return false;
  const timer = node.data.timer;
  if (typeof timer !== "object") return false;
  return "seconds" in timer && typeof timer.seconds === "number" && timer.seconds > 0;
}

/**
 * Extract all message node specific fields.
 * Uses fieldRegistry.extractAll() for common pluggable fields.
 */
export function extractMessageFields(node: JourneyNode) {
  const nodeWithMetadata = node as JourneyNodeWithMetadata;

  // Get all registry-managed fields (timer, media, buttons, tagAction, variableAction, crmAction)
  const registryFields = fieldRegistry.extractAll(node);

  return {
    ...extractCommonFields(node), // label, notes, customJson
    type: node.data.type,
    content: "content" in node.data ? String(node.data.content || "") : "",
    responseType: extractResponseType(node),
    storeResponseAs: "storeResponseAs" in node.data ? String(node.data.storeResponseAs || "") : "",
    delay: "delay" in node.data && typeof node.data.delay === "number" ? node.data.delay : undefined,
    // Note: voiceMode is only supported on agent nodes (not message nodes)
    status: nodeWithMetadata.metadata?.status || "draft",
    // Registry-managed fields (timer, media, buttons, tagAction, variableAction, crmAction)
    ...registryFields,
  };
}

// ============================================================================
// Condition Node Extractors
// ============================================================================

/**
 * Extract condition rules from node data
 */
export function extractConditionRules(node: JourneyNode): ConditionRule[] {
  if ("rules" in node.data && Array.isArray(node.data.rules)) {
    return node.data.rules as ConditionRule[];
  }
  return [];
}

/**
 * Extract rules operator
 */
export function extractRulesOperator(node: JourneyNode): "and" | "or" {
  if ("rulesOperator" in node.data && node.data.rulesOperator) {
    return node.data.rulesOperator as "and" | "or";
  }
  return "and";
}

/**
 * Extract all condition node specific fields.
 * Uses fieldRegistry.extractAll() for common pluggable fields.
 */
export function extractConditionFields(node: JourneyNode) {
  const nodeWithMetadata = node as JourneyNodeWithMetadata;

  // Get all registry-managed fields (tagAction, variableAction, crmAction)
  const registryFields = fieldRegistry.extractAll(node);

  return {
    ...extractCommonFields(node), // label, notes, customJson
    type: node.data.type,
    expression: "expression" in node.data ? String(node.data.expression || "") : "",
    status: nodeWithMetadata.metadata?.status || "draft",
    rules: extractConditionRules(node),
    rulesOperator: extractRulesOperator(node),
    // Registry-managed fields
    ...registryFields,
  };
}

// ============================================================================
// Wait Node Extractors
// ============================================================================

/**
 * Extract duration fields from wait node data
 */
export function extractDurationFields(node: JourneyNode) {
  return extractDurationWithPrefix(node, "duration", "duration");
}

/**
 * Extract all wait node specific fields.
 * Uses fieldRegistry.extractAll() for common pluggable fields.
 */
export function extractWaitFields(node: JourneyNode) {
  // Get all registry-managed fields (duration, tagAction, variableAction, crmAction)
  const registryFields = fieldRegistry.extractAll(node);

  return {
    ...extractCommonFields(node), // label, notes, customJson
    reason: "reason" in node.data ? String(node.data.reason || "") : "",
    // Registry-managed fields (includes duration)
    ...registryFields,
  };
}

// ============================================================================
// Webhook Node Extractors
// ============================================================================

type AuthType = "none" | "bearer" | "basic" | "apiKey";

/**
 * Extract headers from webhook node data as array of {key, value}
 */
export function extractHeaders(node: JourneyNode): Array<{ key: string; value: string }> {
  if ("headers" in node.data && node.data.headers && typeof node.data.headers === "object") {
    return Object.entries(node.data.headers as Record<string, string>).map(([key, value]) => ({
      key,
      value,
    }));
  }
  return [];
}

/**
 * Extract auth fields from webhook node data
 */
export function extractAuthFields(node: JourneyNode) {
  if ("auth" in node.data && node.data.auth && typeof node.data.auth === "object") {
    const auth = node.data.auth as {
      type?: string;
      token?: string;
      username?: string;
      password?: string;
      headerName?: string;
      apiKey?: string;
    };
    return {
      authType: (auth.type as AuthType) || "none",
      authToken: auth.token || "",
      authUsername: auth.username || "",
      authPassword: auth.password || "",
      authHeaderName: auth.headerName || "",
      authApiKey: auth.apiKey || "",
    };
  }
  return {
    authType: "none" as const,
    authToken: "",
    authUsername: "",
    authPassword: "",
    authHeaderName: "",
    authApiKey: "",
  };
}

/**
 * Extract mock response fields from webhook node data
 */
export function extractMockFields(node: JourneyNode) {
  if ("mockResponse" in node.data && node.data.mockResponse && typeof node.data.mockResponse === "object") {
    const mock = node.data.mockResponse as {
      enabled?: boolean;
      statusCode?: number;
      body?: unknown;
      delay?: number;
    };
    // Handle body as string or object (JSON stringify objects for editor)
    let mockBody = "";
    if (mock.body != null) {
      mockBody = typeof mock.body === "string" ? mock.body : JSON.stringify(mock.body, null, 2);
    }
    return {
      mockEnabled: mock.enabled ?? false,
      mockStatusCode: mock.statusCode ?? 200,
      mockBody,
      mockDelay: mock.delay ?? 0,
    };
  }
  return {
    mockEnabled: false,
    mockStatusCode: 200,
    mockBody: "",
    mockDelay: 0,
  };
}

/**
 * Extract all webhook node specific fields.
 * Uses fieldRegistry.extractAll() for common pluggable fields.
 */
export function extractWebhookFields(node: JourneyNode) {
  const authFields = extractAuthFields(node);
  const mockFields = extractMockFields(node);

  // Get all registry-managed fields (tagAction, variableAction, crmAction)
  const registryFields = fieldRegistry.extractAll(node);

  return {
    ...extractCommonFields(node), // label, notes, customJson
    url: "url" in node.data ? String(node.data.url || "") : "",
    method: ("method" in node.data ? (node.data.method as HttpMethod) : "POST") || "POST",
    headers: extractHeaders(node),
    body: "body" in node.data ? String(node.data.body || "") : "",
    ...authFields,
    successPath: "successPath" in node.data ? String(node.data.successPath || "") : "",
    storeAs: "storeAs" in node.data ? String(node.data.storeAs || "") : "",
    errorHandling: ("errorHandling" in node.data ? (node.data.errorHandling as ErrorHandling) : "continue") || "continue",
    retryCount: "retryCount" in node.data ? ((node.data.retryCount as number) ?? 0) : 0,
    timeoutMs: "timeoutMs" in node.data ? ((node.data.timeoutMs as number) ?? 30000) : 30000,
    ...mockFields,
    // Registry-managed fields
    ...registryFields,
  };
}

// ============================================================================
// Simple Node Extractors (end)
// ============================================================================

/**
 * Extract fields for simple nodes (end).
 * Uses fieldRegistry.extractAll() for common pluggable fields.
 */
export function extractSimpleFields(node: JourneyNode) {
  const nodeWithMetadata = node as JourneyNodeWithMetadata;

  // Get all registry-managed fields (tagAction, variableAction, crmAction)
  const registryFields = fieldRegistry.extractAll(node);

  return {
    ...extractCommonFields(node), // label, notes, customJson
    type: node.data.type,
    status: nodeWithMetadata.metadata?.status || "draft",
    // Registry-managed fields
    ...registryFields,
  };
}

// ============================================================================
// Start Node Extractors
// ============================================================================

/**
 * Extract fields for start nodes (includes content and media).
 * Uses fieldRegistry.extractAll() for common pluggable fields.
 */
export function extractStartFields(node: JourneyNode) {
  const nodeWithMetadata = node as JourneyNodeWithMetadata;

  // Get all registry-managed fields (media, tagAction, variableAction, crmAction)
  const registryFields = fieldRegistry.extractAll(node);

  return {
    ...extractCommonFields(node), // label, notes, customJson
    type: node.data.type,
    content: "content" in node.data ? String(node.data.content || "") : "",
    status: nodeWithMetadata.metadata?.status || "draft",
    // Registry-managed fields (includes media)
    ...registryFields,
  };
}

// ============================================================================
// Questionnaire Node Extractors
// ============================================================================

/**
 * Extract fields for questionnaire nodes.
 * Uses fieldRegistry.extractAll() for common pluggable fields.
 */
export function extractQuestionnaireFields(node: JourneyNode) {
  const nodeWithMetadata = node as JourneyNodeWithMetadata;

  // Get all registry-managed fields (timeout, questions, tagAction, variableAction)
  const registryFields = fieldRegistry.extractAll(node);

  // Extract introduction
  const introduction =
    "introduction" in node.data && node.data.introduction && typeof node.data.introduction === "object"
      ? {
          content: (node.data.introduction as { content?: string }).content || "",
        }
      : undefined;

  // Extract completion
  const completion =
    "completion" in node.data && node.data.completion && typeof node.data.completion === "object"
      ? {
          content: (node.data.completion as { content?: string; delayBeforeTransition?: number }).content || "",
          delayBeforeTransition: (node.data.completion as { delayBeforeTransition?: number }).delayBeforeTransition,
        }
      : undefined;

  return {
    ...extractCommonFields(node),
    type: node.data.type,
    introduction,
    completion,
    allowBack: "allowBack" in node.data ? Boolean(node.data.allowBack) : false,
    shuffle: "shuffle" in node.data ? Boolean(node.data.shuffle) : false,
    storeAllAs: "storeAllAs" in node.data ? String(node.data.storeAllAs || "") : "",
    next: "next" in node.data ? String(node.data.next || "") : "",
    status: nodeWithMetadata.metadata?.status || "draft",
    // Registry-managed fields (includes timeout, questions, tagAction, variableAction)
    ...registryFields,
  };
}

// ============================================================================
// CRM Node Extractors
// ============================================================================

/**
 * Extract fields for CRM nodes.
 * Uses fieldRegistry.extractAll() for common pluggable fields.
 */
export function extractCrmFields(node: JourneyNode) {
  const nodeWithMetadata = node as JourneyNodeWithMetadata;

  // Get all registry-managed fields (tagAction, variableAction)
  // Note: CRM nodes don't use crmAction since they ARE the CRM action
  const registryFields = fieldRegistry.extractAll(node);

  return {
    ...extractCommonFields(node), // label, notes, customJson
    type: node.data.type,
    pipelineId: "pipelineId" in node.data ? (node.data.pipelineId as string | undefined) : undefined,
    stageId: "stageId" in node.data ? (node.data.stageId as string | undefined) : undefined,
    crmNotes: "notes" in node.data ? String(node.data.notes || "") : "",
    status: nodeWithMetadata.metadata?.status || "draft",
    // Registry-managed fields
    ...registryFields,
  };
}

// ============================================================================
// Agent Workflow Node Extractors (Workflow-only mode)
// ============================================================================

/**
 * Extract fields for Agent Workflow nodes (workflow-only mode).
 * Uses fieldRegistry.extractAll() for common pluggable fields.
 */
export function extractAgentFields(node: JourneyNode) {
  const nodeWithMetadata = node as JourneyNodeWithMetadata;
  const data = node.data;

  // Get all registry-managed fields (tagAction, variableAction, crmAction)
  const registryFields = fieldRegistry.extractAll(node);

  // Extract execution mode
  const executionMode = "executionMode" in data ? (data.executionMode as string) : undefined;

  // Extract welcome configuration
  const welcome =
    "welcome" in data && data.welcome && typeof data.welcome === "object"
      ? { message: (data.welcome as { message?: string }).message }
      : undefined;

  // Extract initial prompt configuration
  const initialPrompt =
    "initialPrompt" in data && data.initialPrompt && typeof data.initialPrompt === "object"
      ? {
          template: (data.initialPrompt as { template?: string }).template,
        }
      : undefined;

  // NOTE: Timeout is handled by timeoutField via fieldRegistry.extractAll()
  // which converts timeout.seconds to flat DHMS fields (timeoutDays, etc.)

  // Extract aiContext if present
  const aiContext =
    "aiContext" in data && data.aiContext && typeof data.aiContext === "object"
      ? (data.aiContext as AIContextSettings)
      : undefined;

  return {
    ...extractCommonFields(node), // label, notes, customJson
    type: data.type,
    workflowKey: "workflowKey" in data ? String(data.workflowKey || "") : "",
    executionMode,
    welcome,
    initialPrompt,
    voiceMode: "voiceMode" in data ? (data.voiceMode as string) : undefined,
    voiceProfile: "voiceProfile" in data ? (data.voiceProfile as string) : undefined,
    voiceProvider: "voiceProvider" in data ? (data.voiceProvider as string) : undefined,
    elevenLabsModel: "elevenLabsModel" in data ? (data.elevenLabsModel as string) : undefined,
    aiContext,
    typingIndicatorEnabled:
      "typingIndicatorEnabled" in data ? (data.typingIndicatorEnabled as boolean) : true,
    status: nodeWithMetadata.metadata?.status || "draft",
    // Registry-managed fields (includes timeout DHMS fields and timeoutMessage)
    ...registryFields,
  };
}

// ============================================================================
// Teleport Node Extractors
// ============================================================================

/**
 * Extract fields for teleport nodes.
 * Uses fieldRegistry.extractAll() for common pluggable fields.
 */
export function extractTeleportFields(node: JourneyNode) {
  const nodeWithMetadata = node as JourneyNodeWithMetadata;

  // Get all registry-managed fields (tagAction, variableAction, crmAction)
  const registryFields = fieldRegistry.extractAll(node);

  return {
    ...extractCommonFields(node), // label, notes, customJson
    type: node.data.type,
    targetJourneyId: "targetJourneyId" in node.data ? String(node.data.targetJourneyId || "") : "",
    targetNodeId: "targetNodeId" in node.data ? String(node.data.targetNodeId || "") : undefined,
    preserveContext: "preserveContext" in node.data ? Boolean(node.data.preserveContext) : true,
    status: nodeWithMetadata.metadata?.status || "draft",
    // Registry-managed fields
    ...registryFields,
  };
}
