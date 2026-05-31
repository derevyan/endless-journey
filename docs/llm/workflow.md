# Workflow Engine

DAG-based workflow runtime used by agent workflows. The engine executes nodes, tracks variables, and emits lifecycle events.

## Quick Start

```typescript
import { runWorkflow, resumeWorkflow, registerBuiltinExecutors } from "@journey/llm/workflow";

registerBuiltinExecutors();

// Run a workflow
const result = await runWorkflow(workflow, { message: "Hello" }, context);

// Resume a paused workflow
if (result.paused && result._pauseState) {
  const resumed = await resumeWorkflow(
    workflow,
    {
      nodeId: result._pauseState.currentNodeId,
      executionState: result._pauseState.nodeInput,
      approved: true,
      pausedAtMs: Date.now(),
    },
    context
  );
}
```

## Core Concepts

### Node Input

```typescript
interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: Date;
}

interface NodeInput {
  message: string;
  conversationHistory: Message[];
  variables: Record<string, unknown>;
  previousNodeOutputs: Map<string, NodeOutput>;
}
```

### Node Output

```typescript
interface NodeOutput {
  outHandle?: string;
  data?: Record<string, unknown>;
  response?: string;
  toolCalls?: Array<{ id: string; name: string; args: Record<string, unknown>; result?: unknown }>;
  blocked?: boolean;
  blockedMessage?: string;
  paused?: boolean;
  pauseReason?: "user_approval";
  pauseState?: PauseState;
  executionTimeMs: number;
  metadata?: Record<string, unknown>;
}

interface PauseState {
  nodeId: string;
  approvalMessage: string;
  timeoutSeconds?: number;
  timeoutAction?: "approve" | "reject" | "skip";
  allowedRoles?: string[];
}
```

### Workflow Context

```typescript
interface WorkflowContext {
  orgId: string;
  sessionId: string;
  user: { id: string; firstName?: string; lastName?: string; email?: string; metadata?: Record<string, unknown> };
  journey?: { journeyId: string; currentNodeId: string; variables: Record<string, unknown>; tags?: string[] };
  clientData?: { id?: string; platform?: string; firstName?: string; lastName?: string; username?: string };
  log: WorkflowLogger;
  abortSignal?: AbortSignal;
  settings: { maxExecutionTimeMs: number; nodeTimeoutMs: number };
  currentNodeId?: string;
  workflowRunId?: string;
  services?: SharedServiceContext;
  emit?: (event: WorkflowEvent) => void;
}
```

## Built-in Executors

| Category | Executors |
| --- | --- |
| Core | `start`, `end`, `agent` |
| Logic | `if_else`, `user_approval` |
| Data | `set_state`, `transform` |
| Tools | `context`, `mcp`, `guard`, `question_understanding` |

Register built-ins once on startup:

```typescript
import { registerBuiltinExecutors } from "@journey/llm/workflow";

registerBuiltinExecutors();
```

### Executor Notes

- `agent`: resolves `UnifiedToolsConfig` via `unifiedToolRegistry` and executes tools (parallel by default).
- `guard`: uses `evaluateGuards()` with default workers and honors `terminateOnBlock`.
- `mcp`: calls MCP service tools with per-node timeout support; supports `onError` (`fail`/`continue`/`retry`) and template params.
- `context`: **experimental** - currently throws `NotImplementedError` for memory/knowledge_base/rag sources.
- `if_else`: supports two condition types:
  - Expression: SAFE structured evaluation (no eval!) for field/operator/value conditions
  - Intent: LLM-based classification using `classifyIntent()` with Groq gpt-oss-120b for fast, cheap inference
- `question_understanding`: uses `executeQuestionUnderstanding()` for map-reduce synthesis.

## Agent Node Tooling

Agent nodes use `unifiedTools` config from `AgentNodeConfig`. Tools are resolved via the unified registry, so you can enable:

- `system:` tools (built-ins)
- `utility:` tools (embedded)
- `mcp:` tools (external MCP)

## Pause and Resume (user_approval)

When a `user_approval` node is reached, the workflow returns a paused result with `_pauseState`.

```typescript
const result = await runWorkflow(workflow, input, context);

if (result.paused && result._pauseState) {
  const pausedAtMs = Date.now();
  // Persist result._pauseState + pausedAtMs and wait for approval
}
```

Resume using `resumeWorkflow`:

```typescript
import { resumeWorkflow } from "@journey/llm/workflow";

const resumed = await resumeWorkflow(
  workflow,
  {
    nodeId: storedPauseState.currentNodeId,
    executionState: storedPauseState.nodeInput,
    approved: true,
    pausedAtMs: storedPausedAtMs,
  },
  context
);
```

Note: `_pauseState.pauseData` contains the approval message and timeout settings for UI workflows.

## Workflow Result

```typescript
interface WorkflowResult {
  success: boolean;
  blocked?: boolean;
  blockedMessage?: string;
  response?: string;
  toolCalls?: ToolCall[];
  trace: NodeTrace[];
  totalDurationMs: number;
  variables: Record<string, unknown>;
  paused?: boolean;
  pauseReason?: "user_approval";
  approvalId?: string;
  _pauseState?: WorkflowPauseState;
}
```

## Workflow Events

When `context.emit` is provided, the runner emits events (see `WorkflowEventTypes` in `@journey/schemas`):

- `workflow.started`, `workflow.completed`, `workflow.error`
- `workflow.step.started`, `workflow.step.completed`, `workflow.step.error`
- `workflow.paused`, `workflow.resumed`
- `workflow.guard.blocked`
