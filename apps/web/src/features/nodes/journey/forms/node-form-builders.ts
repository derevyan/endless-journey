/**
 * Node Form Builders
 *
 * Type-specific functions to build node data from validated form values.
 * Used by the unified useNodeEditorForm hook.
 *
 * Note: Most field-specific building is now handled by fieldRegistry.buildAll()
 * which uses the field definitions in field-definitions.ts
 */

import type { AIContextSettings, ButtonConfig, CrmAction, Media, NodeType, TagAction, VoiceMode } from "@journey/schemas";

import { fieldRegistry } from "./field-registry";

// ============================================================================
// Type Definitions for Form Values
// Uses z.infer<> from @journey/schemas for single source of truth
// ============================================================================

/**
 * Tag operations form value - matches TagOperations in TagActionSchema
 */
export interface TagOperationsFormValue {
  add?: string[];
  remove?: string[];
}

/**
 * Tag action form value - uses TagAction from @journey/schemas
 */
export type TagActionFormValue = TagAction;

/**
 * Variable operation form value - form-friendly interface for UI components.
 * Note: VariableOperationSchema in @journey/schemas is a discriminated union
 * with different required fields per operation type. This form interface uses
 * optional fields for simpler form handling - the form builder validates and
 * transforms to the proper discriminated union before saving.
 */
export interface VariableOperationFormValue {
  /** UI-only stable ID for list rendering */
  id: string;
  op: "set" | "delete" | "increment" | "decrement" | "push" | "pop" | "merge";
  key: string;
  value?: unknown;
  amount?: number;
}

/**
 * Variable action form value - form-friendly wrapper for UI components.
 * Maps to VariableAction from @journey/schemas for storage.
 */
export interface VariableActionFormValue {
  userOperations?: VariableOperationFormValue[];
  journeyOperations?: VariableOperationFormValue[];
  globalOperations?: VariableOperationFormValue[];
}

/**
 * CRM action form value - uses CrmAction from @journey/schemas
 */
export type CrmActionFormValue = CrmAction;

/**
 * Media form value - uses Media from @journey/schemas
 */
export type MediaFormValue = Media;

export interface CommonFormValues {
  label: string;
  tags?: string[];
  tagAction?: TagActionFormValue;
  variableAction?: VariableActionFormValue;
  crmAction?: CrmActionFormValue;
  notes?: string;
  customJson?: string;
}

export interface MessageFormValues extends CommonFormValues {
  type: string;
  content?: string;
  media?: MediaFormValue | null;
  timerDays?: number;
  timerHours?: number;
  timerMinutes?: number;
  timerSeconds?: number;
  buttons?: ButtonConfig[];
  responseType?: string;
  storeResponseAs?: string;
  delay?: number;
  // Note: voiceMode is only supported on agent nodes (not message nodes)
  status?: string;
}

export interface ConditionFormValues extends CommonFormValues {
  type: string;
  expression?: string;
  status?: string;
  rules?: Array<{
    field: string;
    operator: string;
    value: string;
  }>;
  rulesOperator?: "and" | "or";
}

export interface WaitFormValues extends CommonFormValues {
  durationDays?: number;
  durationHours?: number;
  durationMinutes?: number;
  durationSeconds?: number;
  reason?: string;
}

export interface WebhookFormValues extends CommonFormValues {
  url: string;
  method: string;
  headers?: Array<{ key: string; value: string }>;
  body?: string;
  authType?: string;
  authToken?: string;
  authUsername?: string;
  authPassword?: string;
  authHeaderName?: string;
  authApiKey?: string;
  successPath?: string;
  storeAs?: string;
  errorHandling?: string;
  retryCount?: number;
  timeoutMs?: number;
  mockEnabled?: boolean;
  mockStatusCode?: number;
  mockBody?: string;
  mockDelay?: number;
}

export interface SimpleFormValues extends CommonFormValues {
  type: string;
  status?: string;
}

export interface StartFormValues extends CommonFormValues {
  type: string;
  content?: string;
  media?: MediaFormValue | null;
  status?: string;
}

export interface CrmFormValues extends CommonFormValues {
  type: string;
  pipelineId?: string;
  stageId?: string;
  crmNotes?: string; // Notes for CRM activity log (separate from metadata notes)
  status?: string;
}

export interface QuestionFormValue {
  id: string;
  content: string;
  responseType?: "buttons" | "text" | "any";
  buttons?: Array<{ id: string; text: string; targetNodeId?: string }>;
  validation?: {
    pattern?: string;
    minLength?: number;
    maxLength?: number;
    errorMessage?: string;
  };
  storeResponseAs?: string;
  hint?: string;
  skipIf?: string;
  required?: boolean;
}

export interface QuestionnaireFormValues extends CommonFormValues {
  type: string;
  questions: QuestionFormValue[];
  introduction?: { content: string };
  completion?: { content: string; delayBeforeTransition?: number };
  timeoutDays?: number;
  timeoutHours?: number;
  timeoutMinutes?: number;
  timeoutSeconds?: number;
  timeoutTargetNodeId?: string;
  allowBack?: boolean;
  shuffle?: boolean;
  storeAllAs?: string;
  next?: string;
  status?: string;
}

// ============================================================================
// Shared Helpers
// ============================================================================

/**
 * Filter out empty strings from array (trims whitespace before checking)
 */
function filterEmptyStrings(items: string[] | undefined): string[] {
  return (items || []).filter((item) => item.trim() !== "");
}

/**
 * Apply common fields to node data.
 * Note: tagAction, variableAction, crmAction are handled by fieldRegistry.buildAll().
 */
function applyCommonFields(nodeData: Record<string, unknown>, validated: CommonFormValues): void {
  const tags = filterEmptyStrings(validated.tags);
  if (tags.length > 0) {
    nodeData.tags = tags;
  } else if (validated.tags) {
    nodeData.tags = [];
  }
}

// ============================================================================
// Message Node Builder
// ============================================================================

/**
 * Build message node data from form values.
 * Uses fieldRegistry.buildAll() for common pluggable fields.
 */
export function buildMessageNodeData(validated: MessageFormValues): Record<string, unknown> {
  const nodeData: Record<string, unknown> = {
    label: validated.label,
    type: validated.type,
  };

  if (validated.content) nodeData.content = validated.content;
  applyCommonFields(nodeData, validated);
  if (validated.responseType) nodeData.responseType = validated.responseType;
  if (validated.storeResponseAs) nodeData.storeResponseAs = validated.storeResponseAs;
  if (validated.delay && validated.delay > 0) nodeData.delay = validated.delay;
  // Note: voiceMode is only supported on agent nodes (not message nodes)

  // Registry-managed fields (timer, media, buttons, tagAction, variableAction, crmAction)
  const registryData = fieldRegistry.buildAll("message" as NodeType, validated as unknown as Record<string, unknown>);

  return { ...nodeData, ...registryData };
}

// ============================================================================
// Condition Node Builder
// ============================================================================

/**
 * Build condition node data from form values.
 * Uses fieldRegistry.buildAll() for common pluggable fields.
 */
export function buildConditionNodeData(validated: ConditionFormValues): Record<string, unknown> {
  const nodeData: Record<string, unknown> = {
    label: validated.label,
    type: validated.type,
  };

  // Allow empty string to reset expression (check undefined, not truthiness)
  if (validated.expression !== undefined) {
    nodeData.expression = validated.expression;
  }
  applyCommonFields(nodeData, validated);

  // Add condition rules if present
  if (validated.rules && validated.rules.length > 0) {
    nodeData.rules = validated.rules;
    nodeData.rulesOperator = validated.rulesOperator || "and";
  }

  // Registry-managed fields (tagAction, variableAction, crmAction)
  const registryData = fieldRegistry.buildAll("condition" as NodeType, validated as unknown as Record<string, unknown>);

  return { ...nodeData, ...registryData };
}

// ============================================================================
// Wait Node Builder
// ============================================================================

/**
 * Build wait node data from form values.
 * Uses fieldRegistry.buildAll() for common pluggable fields.
 */
export function buildWaitNodeData(validated: WaitFormValues): Record<string, unknown> {
  const nodeData: Record<string, unknown> = {
    label: validated.label,
    type: "wait",
  };

  if (validated.reason) nodeData.reason = validated.reason;
  applyCommonFields(nodeData, validated);

  // Registry-managed fields (duration, tagAction, variableAction, crmAction)
  const registryData = fieldRegistry.buildAll("wait" as NodeType, validated as unknown as Record<string, unknown>);

  return { ...nodeData, ...registryData };
}

// ============================================================================
// Webhook Node Builder
// ============================================================================

/**
 * Build webhook node data from form values.
 * Uses fieldRegistry.buildAll() for common pluggable fields.
 */
export function buildWebhookNodeData(validated: WebhookFormValues): Record<string, unknown> {
  // Convert headers array back to object
  const headers: Record<string, string> = {};
  (validated.headers || []).forEach((h) => {
    if (h.key.trim()) {
      headers[h.key.trim()] = h.value;
    }
  });

  // Build auth object if not "none"
  let auth: Record<string, unknown> | undefined;
  if (validated.authType && validated.authType !== "none") {
    auth = { type: validated.authType };
    if (validated.authType === "bearer" && validated.authToken) {
      auth.token = validated.authToken;
    } else if (validated.authType === "basic") {
      if (validated.authUsername) auth.username = validated.authUsername;
      if (validated.authPassword) auth.password = validated.authPassword;
    } else if (validated.authType === "apiKey") {
      if (validated.authHeaderName) auth.headerName = validated.authHeaderName;
      if (validated.authApiKey) auth.apiKey = validated.authApiKey;
    }
  }

  // Build mock response if enabled
  let mockResponse: Record<string, unknown> | undefined;
  if (validated.mockEnabled) {
    mockResponse = {
      enabled: true,
      statusCode: validated.mockStatusCode ?? 200,
      body: validated.mockBody ?? "",
      delay: validated.mockDelay ?? 0,
    };
  }

  // Build node data
  const nodeData: Record<string, unknown> = {
    label: validated.label,
    type: "webhook",
    url: validated.url,
    method: validated.method,
  };

  if (Object.keys(headers).length > 0) nodeData.headers = headers;
  if (validated.body) nodeData.body = validated.body;
  if (auth) nodeData.auth = auth;
  if (validated.successPath) nodeData.successPath = validated.successPath;
  if (validated.storeAs) nodeData.storeAs = validated.storeAs;
  if (validated.errorHandling && validated.errorHandling !== "continue") {
    nodeData.errorHandling = validated.errorHandling;
  }
  if (validated.retryCount && validated.retryCount > 0) nodeData.retryCount = validated.retryCount;
  if (validated.timeoutMs && validated.timeoutMs !== 30000) nodeData.timeoutMs = validated.timeoutMs;
  if (mockResponse) nodeData.mockResponse = mockResponse;
  applyCommonFields(nodeData, validated);

  // Registry-managed fields (tagAction, variableAction, crmAction)
  const registryData = fieldRegistry.buildAll("webhook" as NodeType, validated as unknown as Record<string, unknown>);

  return { ...nodeData, ...registryData };
}

// ============================================================================
// Simple Node Builder (end)
// ============================================================================

/**
 * Build simple node data (end) from form values.
 * Uses fieldRegistry.buildAll() for common pluggable fields.
 */
export function buildSimpleNodeData(validated: SimpleFormValues): Record<string, unknown> {
  const nodeData: Record<string, unknown> = {
    label: validated.label,
    type: validated.type,
  };

  applyCommonFields(nodeData, validated);

  // Registry-managed fields (tagAction, variableAction, crmAction)
  const registryData = fieldRegistry.buildAll(validated.type as NodeType, validated as unknown as Record<string, unknown>);

  return { ...nodeData, ...registryData };
}

// ============================================================================
// Start Node Builder
// ============================================================================

/**
 * Build start node data from form values (includes content and media).
 * Uses fieldRegistry.buildAll() for common pluggable fields.
 */
export function buildStartNodeData(validated: StartFormValues): Record<string, unknown> {
  const nodeData: Record<string, unknown> = {
    label: validated.label,
    type: validated.type,
  };

  if (validated.content) nodeData.content = validated.content;
  applyCommonFields(nodeData, validated);

  // Registry-managed fields (media, tagAction, variableAction, crmAction)
  const registryData = fieldRegistry.buildAll("start" as NodeType, validated as unknown as Record<string, unknown>);

  return { ...nodeData, ...registryData };
}

// ============================================================================
// CRM Node Builder
// ============================================================================

/**
 * Build CRM node data from form values.
 * Uses fieldRegistry.buildAll() for common pluggable fields.
 * Note: CRM nodes have their own dedicated pipelineId/stageId fields.
 * The crmAction field on BaseNodeData is for inline CRM updates on OTHER node types.
 */
export function buildCrmNodeData(validated: CrmFormValues): Record<string, unknown> {
  const nodeData: Record<string, unknown> = {
    label: validated.label,
    type: "crm",
  };

  if (validated.pipelineId) nodeData.pipelineId = validated.pipelineId;
  if (validated.stageId) nodeData.stageId = validated.stageId;
  if (validated.crmNotes) nodeData.notes = validated.crmNotes; // Map crmNotes back to 'notes' in node data
  applyCommonFields(nodeData, validated);

  // Registry-managed fields (tagAction, variableAction)
  // Note: CRM nodes don't need crmAction since they ARE the CRM action
  const registryData = fieldRegistry.buildAll("crm" as NodeType, validated as unknown as Record<string, unknown>);

  return { ...nodeData, ...registryData };
}

// ============================================================================
// Questionnaire Node Builder
// ============================================================================

/**
 * Build questionnaire node data from form values.
 * Uses fieldRegistry.buildAll() for common pluggable fields.
 */
export function buildQuestionnaireNodeData(validated: QuestionnaireFormValues): Record<string, unknown> {
  const nodeData: Record<string, unknown> = {
    label: validated.label,
    type: "questionnaire",
  };

  // Add introduction if content is provided
  if (validated.introduction?.content) {
    nodeData.introduction = { content: validated.introduction.content };
  }

  // Add completion if content is provided
  if (validated.completion?.content) {
    nodeData.completion = {
      content: validated.completion.content,
      ...(validated.completion.delayBeforeTransition !== undefined && {
        delayBeforeTransition: validated.completion.delayBeforeTransition,
      }),
    };
  }

  // Add boolean flags (only if true to keep JSON clean)
  if (validated.allowBack) nodeData.allowBack = true;
  if (validated.shuffle) nodeData.shuffle = true;

  // Add storage options
  if (validated.storeAllAs) nodeData.storeAllAs = validated.storeAllAs;
  if (validated.next) nodeData.next = validated.next;

  applyCommonFields(nodeData, validated);

  // Registry-managed fields (timeout, questions, tagAction, variableAction, crmAction)
  const registryData = fieldRegistry.buildAll("questionnaire" as NodeType, validated as unknown as Record<string, unknown>);

  return { ...nodeData, ...registryData };
}

// ============================================================================
// Agent Workflow Node Builders (Workflow-only mode)
// ============================================================================

export interface AgentFormValues extends CommonFormValues {
  type: "agent";
  workflowKey: string;
  executionMode?: "welcome_first" | "immediate" | "wait_for_input";
  welcome?: {
    message?: string;
  };
  initialPrompt?: {
    template?: string;
  };
  timeout?: {
    seconds?: number;
    timeoutMessage?: string;
  };
  voiceMode?: VoiceMode;
  voiceProfile?: string;
  voiceProvider?: "openai" | "elevenlabs";
  elevenLabsModel?: "eleven_flash_v2_5" | "eleven_multilingual_v2" | "eleven_v3" | "eleven_turbo_v2_5";
  aiContext?: AIContextSettings;
  typingIndicatorEnabled?: boolean;
}

/**
 * Build Agent Workflow node data from validated form values (workflow-only mode).
 * Uses fieldRegistry.buildAll() for common pluggable fields.
 */
export function buildAgentNodeData(validated: AgentFormValues): Record<string, unknown> {
  const nodeData: Record<string, unknown> = {
    label: validated.label,
    type: "agent",
    workflowKey: validated.workflowKey,
  };

  // Add execution mode if configured
  if (validated.executionMode) {
    nodeData.executionMode = validated.executionMode;
  }

  // Add welcome config if message is set
  if (validated.welcome?.message) {
    nodeData.welcome = { message: validated.welcome.message };
  }

  // Add initial prompt if template is set
  if (validated.initialPrompt?.template) {
    nodeData.initialPrompt = { template: validated.initialPrompt.template };
  }

  // Add voice configuration if set
  if (validated.voiceMode) {
    nodeData.voiceMode = validated.voiceMode;
  }
  if (validated.voiceProfile) {
    nodeData.voiceProfile = validated.voiceProfile;
  }
  if (validated.voiceProvider) {
    nodeData.voiceProvider = validated.voiceProvider;
  }
  if (validated.elevenLabsModel) {
    nodeData.elevenLabsModel = validated.elevenLabsModel;
  }

  // Add AI context settings if configured
  if (validated.aiContext) {
    nodeData.aiContext = validated.aiContext;
  }

  // Add typing indicator setting if configured
  if (validated.typingIndicatorEnabled !== undefined) {
    nodeData.typingIndicatorEnabled = validated.typingIndicatorEnabled;
  }

  // NOTE: Timeout is handled by timeoutField via fieldRegistry.buildAll()
  // which builds timeout: { seconds, timeoutMessage } from flat DHMS fields

  applyCommonFields(nodeData, validated);

  // Registry-managed fields (tagAction, variableAction, crmAction, timeout)
  const registryData = fieldRegistry.buildAll("agent" as NodeType, validated as unknown as Record<string, unknown>);

  return { ...nodeData, ...registryData };
}

// ============================================================================
// Teleport Node Builder
// ============================================================================

export interface TeleportFormValues extends CommonFormValues {
  type: "teleport";
  targetJourneyId: string;
  targetNodeId?: string;
  preserveContext?: boolean;
  status?: string;
}

/**
 * Build teleport node data from form values.
 * Uses fieldRegistry.buildAll() for common pluggable fields.
 */
export function buildTeleportNodeData(validated: TeleportFormValues): Record<string, unknown> {
  const nodeData: Record<string, unknown> = {
    label: validated.label,
    type: "teleport",
    targetJourneyId: validated.targetJourneyId,
  };

  if (validated.targetNodeId) nodeData.targetNodeId = validated.targetNodeId;
  if (validated.preserveContext !== undefined) nodeData.preserveContext = validated.preserveContext;

  applyCommonFields(nodeData, validated);

  // Registry-managed fields (tagAction, variableAction)
  const registryData = fieldRegistry.buildAll("teleport" as NodeType, validated as unknown as Record<string, unknown>);

  return { ...nodeData, ...registryData };
}
