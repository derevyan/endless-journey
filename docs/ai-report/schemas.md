# AI Report Schema Reference

Complete reference for all Zod schemas and TypeScript types in the `@journey/ai-report` package.

## Table of Contents

- [Main Report](#main-report)
- [Journey Log](#journey-log)
- [Transitions](#transitions)
- [Messages](#messages)
- [Workflows](#workflows)
- [AI Conversations](#ai-conversations)
- [Variables](#variables)
- [Button Tracking](#button-tracking)
- [CRM Actions](#crm-actions)
- [HITL Decisions](#hitl-decisions)
- [Issues](#issues)
- [Report Options](#report-options)

---

## Main Report

### AIExecutionReport

The comprehensive report structure returned by `buildExecutionReport()`.

```typescript
interface AIExecutionReport {
  // === METADATA ===
  reportVersion: "1.0";
  generatedAt: string;  // ISO datetime
  reportType: "in_progress" | "completed";

  // === SESSION CONTEXT ===
  session: {
    id: string;  // UUID
    status: "active" | "completed" | "dropped" | "paused" | "error";
    mode?: "live" | "test" | "simulation";
    currentNodeId: string;
    startedAt: string;   // ISO datetime
    updatedAt: string;   // ISO datetime
    completedAt: string | null;
    totalDurationMs: number;
  };

  journey: {
    id: string;  // UUID
    name: string;
    slug?: string;
  };

  user: {
    id: string;
    platformUserId?: string;
    displayName: string;
    tags: string[];
  };

  // === JOURNEY DEFINITION ===
  journeyGraph?: JourneyGraph;

  // === EXECUTIVE SUMMARY ===
  summary: ReportSummary;

  // === DETAILED SECTIONS ===
  journeyLog: JourneyLogEntry[];
  transitions: TransitionDetail[];
  messages: MessageDetail[];
  errors: ErrorDetail[];
  workflowExecutions: WorkflowExecutionDetail[];
  aiConversations: AINodeConversation[];
  crmActions?: CRMActionDetail[];
  hitlDecisions?: HITLDecisionDetail[];
  variableChanges: VariableChangeDetail[];
  currentVariables: Record<string, unknown>;
  currentTags: string[];
  nodeOutputs: Record<string, { label?: string; data: unknown }>;
  buttonClicks: ButtonClickDetail[];
  unprocessedEvents: UnprocessedEvent[];

  // === ANALYSIS ===
  issues: DetectedIssue[];
  performanceAnalysis?: PerformanceAnalysis;
}
```

### JourneyGraph

Optional journey definition included in report.

```typescript
interface JourneyGraph {
  nodes: JourneyGraphNode[];
  edges: JourneyGraphEdge[];
  nodeTypeCounts: Record<string, number>;  // e.g., { "message": 5, "agent": 2 }
}

interface JourneyGraphNode {
  id: string;
  type: string;
  label?: string;
  data: unknown;  // Node-specific configuration
  position?: { x: number; y: number };
}

interface JourneyGraphEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
  data?: unknown;  // Edge-specific data (delays, guards)
}
```

### ReportSummary

Executive summary for quick AI scanning.

```typescript
interface ReportSummary {
  // Path visualization
  pathDescription: string;  // "Start → Welcome → Agent → End"
  nodesVisited: number;
  uniqueNodes: number;

  // Interaction counts
  totalMessages: number;
  userMessages: number;
  botMessages: number;
  buttonClicks: number;
  timeoutsTriggered: number;

  // Quality indicators
  errorsCount: number;
  warningsCount: number;

  // Performance
  totalDurationMs: number;
  avgResponseTimeMs?: number;

  // LLM usage (if any agent nodes)
  totalTokensUsed?: number;
  totalLlmCostUSD?: number;
  llmCallCount?: number;
}
```

### PerformanceAnalysis

Performance hotspots and bottleneck identification.

```typescript
interface PerformanceAnalysis {
  slowestNodes: SlowNode[];
  bottlenecks: string[];  // AI-readable descriptions
}

interface SlowNode {
  nodeId: string;
  nodeLabel?: string;
  avgDurationMs: number;
  executionCount: number;
}
```

---

## Journey Log

### JourneyLogEntry

Each chronological event in the journey log.

```typescript
interface JourneyLogEntry {
  id: string;  // UUID
  timestamp: string;  // ISO datetime

  // Event classification
  eventType: JourneyLogEventType;

  // Context
  nodeId: string;
  nodeType: string;
  nodeLabel?: string;

  // Event-specific data
  payload: unknown;

  // Human-readable description
  description: string;
}
```

### JourneyLogEventType

All possible event types in the journey log.

```typescript
type JourneyLogEventType =
  // User actions
  | "user_message"
  | "user_button_click"

  // Engine outputs
  | "bot_message"
  | "node_transition"
  | "node_error"

  // Timers & follow-ups
  | "timer_started"
  | "timer_expired"
  | "timer_cancelled"
  | "followup_scheduled"
  | "followup_executed"

  // State changes
  | "variables_changed"
  | "tags_changed"
  | "mindstate_change"

  // Workflow (agent nodes)
  | "workflow_started"
  | "workflow_step"
  | "workflow_completed"
  | "workflow_error"

  // Guards & approvals
  | "guard_passed"
  | "guard_blocked"
  | "guard_fallback"
  | "approval_requested"
  | "approval_response"

  // External integrations
  | "webhook_called"
  | "webhook_response"
  | "crm_action"
  | "teleport"
  | "journey_teleport"

  // Human-in-the-loop
  | "hitl_decision"

  // LLM-specific
  | "llm_call"
  | "llm_error"
  | "tool_execution";
```

---

## Transitions

### TransitionDetail

Details about why and how each node transition occurred.

```typescript
interface TransitionDetail {
  timestamp: string;  // ISO datetime

  // From node
  fromNodeId: string;
  fromNodeType: string;
  fromNodeLabel?: string;

  // To node
  toNodeId: string;
  toNodeType: string;
  toNodeLabel?: string;

  // Why transition happened
  trigger: TransitionTrigger;

  // Button context (if trigger is button_click)
  buttonId?: string;
  buttonLabel?: string;

  // Condition context (if trigger is condition_*)
  conditionExpression?: string;

  // Error context (if trigger is error)
  errorMessage?: string;

  // Timing
  durationAtPreviousNodeMs?: number;
}
```

### TransitionTrigger

All possible transition triggers.

```typescript
type TransitionTrigger =
  | "auto"            // Automatic (no user input)
  | "button_click"    // User clicked button
  | "timer_expired"   // Timer/timeout triggered
  | "condition_true"  // If/else evaluated true
  | "condition_false" // If/else evaluated false
  | "guard_passed"    // Guard condition passed
  | "guard_blocked"   // Guard condition blocked
  | "error"           // Error caused transition
  | "workflow_exit";  // Workflow/agent exited
```

---

## Messages

### MessageDetail

Complete message record with context.

```typescript
interface MessageDetail {
  timestamp: string;  // ISO datetime
  direction: "inbound" | "outbound";

  // Content
  content: string;
  contentType: "text" | "media" | "structured";

  // Context
  nodeId: string;
  nodeLabel?: string;

  // For outbound (bot) messages
  buttons?: MessageButton[];

  // For inbound (user) messages
  selectedButtonId?: string;
  selectedButtonLabel?: string;
  isTextInput?: boolean;

  // Processing info
  processedByNodeId?: string;
  processingDurationMs?: number;
}

interface MessageButton {
  id: string;
  label: string;
  wasClicked: boolean;
}
```

### ErrorDetail

Detailed error record for debugging.

```typescript
interface ErrorDetail {
  timestamp: string;  // ISO datetime
  nodeId: string;
  nodeType: string;
  nodeLabel?: string;

  errorType: ErrorType;
  message: string;
  stack?: string;

  // Recovery info
  wasRecovered: boolean;
  recoveryAction?: string;

  // Context
  inputData?: unknown;
  outputData?: unknown;
}

type ErrorType =
  | "node_execution"
  | "workflow_error"
  | "webhook_failure"
  | "guard_rejection"
  | "timeout"
  | "validation"
  | "llm_error"
  | "tool_error"
  | "unknown";
```

---

## Workflows

### WorkflowExecutionDetail

Detailed workflow/agent execution record.

```typescript
interface WorkflowExecutionDetail {
  workflowRunId: string;
  nodeId: string;
  startedAt: string;   // ISO datetime
  completedAt?: string;
  status: "running" | "completed" | "error" | "paused";

  // Execution details
  steps: WorkflowStep[];
  llmCalls: WorkflowLLMCall[];
  toolCalls: WorkflowToolCall[];

  // Output
  finalResponse?: string;
  outputVariables?: Record<string, unknown>;

  // Metrics
  totalDurationMs?: number;
  totalTokens?: number;
  totalCostUSD?: number;
}
```

### WorkflowLLMCall

Full LLM call details within a workflow.

```typescript
interface WorkflowLLMCall {
  config: WorkflowLLMConfig;
  systemPrompt?: string;
  systemPromptTruncated?: boolean;
  inputMessages?: WorkflowMessage[];
  response?: string;
  outputToolCalls?: Array<{
    id: string;
    name: string;
    args: unknown;
  }>;
  finishReason?: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUSD?: number;
  durationMs: number;
  errorMessage?: string;
}

interface WorkflowLLMConfig {
  model: string;
  provider: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
}

interface WorkflowMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  toolCallId?: string;
}
```

### WorkflowToolCall

Tool execution within a workflow.

```typescript
interface WorkflowToolCall {
  toolName: string;
  input: unknown;
  output?: unknown;
  durationMs: number;
  success: boolean;
  error?: string;
}
```

---

## AI Conversations

### AINodeConversation

Complete conversation history for an AI/agent node.

```typescript
interface AINodeConversation {
  nodeId: string;
  nodeLabel?: string;
  workflowKey: string;
  startedAt: string;
  lastTurnAt?: string;
  status: "active" | "completed" | "blocked" | "error";

  turns: AIConversationTurn[];
  metrics: ConversationMetrics;
  exitReason?: ConversationExitReason;
}
```

### AIConversationTurn

Single conversation turn with full LLM details.

```typescript
interface AIConversationTurn {
  turnNumber: number;
  timestamp: string;

  // User input
  userMessage?: string;
  userInputType?: "initial_prompt" | "text" | "button" | "file";

  // AI response
  assistantResponse: string;
  responseBlocked?: boolean;
  blockedReason?: string;

  // Tool calls
  toolCalls: ConversationToolCall[];

  // Full LLM call details
  llmCall?: LLMCallDetail;

  // Metrics
  tokensUsed?: number;
  costUSD?: number;
  durationMs?: number;
}

interface ConversationToolCall {
  id: string;
  name: string;
  args?: unknown;
  result?: unknown;
  success: boolean;
  error?: string;
}
```

### LLMCallDetail

Complete LLM call details for a conversation turn.

```typescript
interface LLMCallDetail {
  systemPrompt?: string;
  systemPromptTruncated?: boolean;
  inputMessages?: Array<{
    role: "user" | "assistant" | "system" | "tool";
    content: string;
    toolCallId?: string;
  }>;
  config: LLMConfigSnapshot;
  outputContent: string;
  outputToolCalls?: Array<{
    id: string;
    name: string;
    args: unknown;
    success?: boolean;
  }>;
  finishReason?: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUSD: number;
  durationMs: number;
  errorMessage?: string;
}

interface LLMConfigSnapshot {
  model: string;
  provider: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
}
```

### ConversationMetrics

Aggregated metrics for a conversation.

```typescript
interface ConversationMetrics {
  turnCount: number;
  totalMessages: number;
  totalTokens: number;
  totalCostUSD: number;
  averageTurnDurationMs?: number;
}

type ConversationExitReason =
  | "workflow_completed"
  | "user_exit"
  | "timeout"
  | "blocked"
  | "error"
  | "still_active";
```

---

## Variables

### VariableChangeDetail

Track variable changes with before/after values.

```typescript
interface VariableChangeDetail {
  timestamp: string;
  nodeId: string;
  nodeLabel?: string;
  changes: VariableChangeOperation[];
}

interface VariableChangeOperation {
  key: string;
  previousValue?: unknown;
  newValue?: unknown;
  operation: VariableOperation;
}

type VariableOperation =
  | "set"
  | "increment"
  | "decrement"
  | "append"
  | "remove"
  | "clear";
```

---

## Button Tracking

### ButtonClickDetail

Full button click tracking with outcomes.

```typescript
interface ButtonClickDetail {
  timestamp: string;
  clickId: string;  // From interaction event ID

  // What was clicked
  buttonId: string;
  buttonLabel?: string;

  // Context at time of click
  currentNodeId: string;
  currentNodeType: string;
  currentNodeLabel?: string;

  // Was button valid?
  buttonFound: boolean;
  activeButtonsAtClick?: ActiveButtonAtClick[];

  // What happened?
  outcome: ButtonClickOutcome;

  // If transition happened
  transitionedToNodeId?: string;
  transitionedToNodeLabel?: string;

  // If failed
  failureReason?: string;
  failureDetails?: Record<string, unknown>;
}

interface ActiveButtonAtClick {
  id: string;
  text: string;
  targetNodeId?: string;
  source: "node" | "questionnaire" | "plugin" | "agent";
}
```

### ButtonClickOutcome

All possible outcomes when a button is clicked.

```typescript
type ButtonClickOutcome =
  | "transition_success"  // Normal - transitioned to target
  | "agent_reexecute"     // AI quick-reply - agent re-executed
  | "button_not_found"    // Button ID not in active buttons
  | "edge_not_found"      // Button found but no edge
  | "guard_blocked"       // Guard blocked transition
  | "error"               // Error during processing
  | "no_handler";         // No handler registered
```

### UnprocessedEvent

Events that didn't result in expected action.

```typescript
interface UnprocessedEvent {
  timestamp: string;
  eventId: string;
  eventType: string;

  // Context
  currentNodeId: string;
  sessionStatus: "active" | "completed" | "dropped" | "paused" | "error";

  // What was expected vs actual
  expectedAction: string;
  actualOutcome: UnprocessedEventOutcome;

  // Debug info
  reason: string;
  debugContext?: Record<string, unknown>;
}

type UnprocessedEventOutcome =
  | "ignored"
  | "handler_not_found"
  | "invalid_state"
  | "missing_edge"
  | "button_mismatch"
  | "guard_blocked"
  | "error"
  | "unknown";
```

---

## CRM Actions

### CRMActionDetail

Track CRM operations during journey execution.

```typescript
interface CRMActionDetail {
  timestamp: string;
  nodeId: string;
  nodeLabel?: string;

  // Action details
  actionType: CRMActionType;
  actionName: string;  // e.g., "move_to_stage"

  // Pipeline/Stage context
  pipelineId?: string;
  pipelineName?: string;
  stageId?: string;
  stageName?: string;

  // Entity references
  dealId?: string;
  contactId?: string;

  // Result
  success: boolean;
  message?: string;
  errorMessage?: string;

  // Additional context
  metadata?: Record<string, unknown>;
}

type CRMActionType =
  | "pipeline_move"
  | "deal_create"
  | "deal_update"
  | "contact_create"
  | "contact_update"
  | "note_add"
  | "task_create"
  | "custom";
```

---

## HITL Decisions

### HITLDecisionDetail

Track human-in-the-loop approval decisions.

```typescript
interface HITLDecisionDetail {
  timestamp: string;
  nodeId: string;
  nodeLabel?: string;

  // Request info
  requestId: string;
  requestedAt?: string;

  // What was being approved
  toolName?: string;
  actionDescription?: string;

  // Decision result
  decision: HITLDecisionType;
  decidedBy?: string;  // User ID/name
  decisionReason?: string;

  // Edit tracking
  wasEdited: boolean;
  originalArgs?: unknown;
  editedArgs?: unknown;

  // Timing
  responseTimeMs?: number;

  // Additional context
  metadata?: Record<string, unknown>;
}

type HITLDecisionType =
  | "approved"
  | "rejected"
  | "edited"
  | "timeout"
  | "cancelled";
```

---

## Issues

### DetectedIssue

Problems detected during analysis.

```typescript
interface DetectedIssue {
  severity: IssueSeverity;
  category: IssueCategory;
  nodeId?: string;
  timestamp?: string;
  message: string;
  suggestion?: string;
  context?: Record<string, unknown>;
  relatedButtonClick?: string;
  relatedError?: string;
}

type IssueSeverity = "error" | "warning" | "info";

type IssueCategory =
  | "execution_error"
  | "timeout_no_response"
  | "guard_blocked"
  | "webhook_failure"
  | "slow_node"
  | "high_token_usage"
  | "repeated_node"
  | "variable_undefined"
  | "button_click_ignored"
  | "event_not_processed"
  | "edge_not_found"
  | "state_inconsistency";
```

---

## Report Options

### ReportOptions

Options for controlling report generation.

```typescript
interface ReportOptions {
  // Section inclusion (all default to true)
  includeGraph?: boolean;       // Include journey graph
  includeMessages?: boolean;    // Include message history
  includeWorkflows?: boolean;   // Include workflow details
  includeLLMDetails?: boolean;  // Include full LLM call details

  // LLM data truncation
  systemPromptMaxChars?: number;         // Truncate long prompts
  conversationHistoryMaxChars?: number;  // Truncate per turn
  includeInputMessages?: boolean;        // Include LLM inputs

  // Event filtering
  fromTimestamp?: string;   // ISO datetime start
  toTimestamp?: string;     // ISO datetime end
  eventTypes?: string[];    // Filter to specific types
  maxEvents?: number;       // Limit total events

  // Pagination
  offset?: number;
  limit?: number;
}
```

---

## See Also

- [README](./README.md) - Package overview
- [Architecture](./architecture.md) - System design
- [AI Agent Guide](./ai-agent-guide.md) - Guide for AI consumers
