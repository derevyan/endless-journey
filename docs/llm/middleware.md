# LLM Middleware System

LangChain-inspired middleware pipeline for composable agent execution. Hooks run around model calls, tool calls, and lifecycle events.

## Architecture Overview

```
Request
  |-> beforeAgent (once, forward order)
  |-> loop:
  |     beforeModel (forward)
  |     wrapModelCall (onion)
  |     afterModel (reverse)
  |     wrapToolCall (onion)
  |-> afterAgent (once, reverse order)
Response
```

## Core Types

```typescript
interface AgentState {
  messages: Array<{ role: "user" | "assistant" | "system" | "tool"; content: string; toolCallId?: string }>;
  systemPrompt: string;
  model: string;
  [key: string]: unknown; // middleware state fields
}

interface AgentRuntime {
  context: Record<string, unknown>;
  store?: unknown;
  nodeId?: string;
  sessionId?: string;
  orgId?: string;
}

interface HookReturn {
  messages?: AgentState["messages"];
  jumpTo?: "end" | "tools" | "model";
  [key: string]: unknown;
}
```

## Hook Signatures

```typescript
interface AgentMiddlewareHooks {
  beforeAgent?: (state: AgentState, runtime: AgentRuntime) => Promise<HookReturn> | HookReturn;
  beforeModel?: (state: AgentState, runtime: AgentRuntime) => Promise<HookReturn> | HookReturn;
  wrapModelCall?: (request: ModelRequest, handler: (req: ModelRequest) => Promise<ModelResponse>) => Promise<ModelResponse>;
  afterModel?: (state: AgentState, runtime: AgentRuntime, response: ModelResponse) => Promise<HookReturn> | HookReturn;
  wrapToolCall?: (request: ToolCallRequest, handler: (req: ToolCallRequest) => Promise<ToolCallResponse>) => Promise<ToolCallResponse>;
  afterAgent?: (state: AgentState, runtime: AgentRuntime) => Promise<HookReturn> | HookReturn;
}
```

### Middleware Pipeline Config

```typescript
interface MiddlewarePipelineConfig {
  middleware: AgentMiddleware[];
  stopOnError?: boolean;
  initialState?: Record<string, unknown>;
}
```

## Creating Custom Middleware

```typescript
import { createLogger } from "@journey/logger";
import { createMiddleware } from "@journey/llm/middleware";
import { z } from "zod";

const log = createLogger("llm:middleware:custom");

const loggingMiddleware = createMiddleware({
  name: "LoggingMiddleware",
  priority: 50,
  stateSchema: z.object({ requestId: z.string() }),
  hooks: {
    beforeAgent: () => ({ requestId: crypto.randomUUID() }),
    beforeModel: (state) => {
      log.info({ requestId: state.requestId }, "middleware:beforeModel");
    },
  },
});
```

## Using Middleware

```typescript
import { runAgent } from "@journey/llm";

const result = await runAgent(
  "You are helpful.",
  [{ role: "user", content: "Hello" }],
  {
    model: "gpt-4o",
    tools: [],
    middleware: [loggingMiddleware],
    runtime: { orgId: "org_123", sessionId: "sess_123" },
  }
);
```

Notes:
- Middleware is passed as an array directly to `runAgent`.
- Middleware is composed internally by priority order (lower runs first).

---

## Built-in Middleware (8)

### 1. Model Fallback

```typescript
import { createModelFallbackMiddleware } from "@journey/llm";

const fallback = createModelFallbackMiddleware("gpt-4o-mini", "claude-3-5-sonnet");
```

### 2. Model Call Limit

```typescript
import { createModelCallLimitMiddleware } from "@journey/llm";

const limit = createModelCallLimitMiddleware({
  runLimit: 10,
  threadLimit: 50,
  exitBehavior: "end",
  limitMessage: "Model call limit reached",
});
```

### 3. PII Detection

```typescript
import { createPIIMiddleware } from "@journey/llm";

const pii = createPIIMiddleware(["email", "phone"], {
  strategy: "redact",
  applyToInput: true,
  applyToOutput: false,
  maskChar: "X",
  maskKeepLast: 4,
});
```

### 4. Summarization

```typescript
import { createSummarizationMiddleware } from "@journey/llm";

const summarize = createSummarizationMiddleware({
  model: "gpt-4o-mini",
  trigger: { messages: 20 },
  keep: { messages: 6 },
  preserveSystemMessages: true,
});
```

### 5. Todo List

```typescript
import { createTodoListMiddleware } from "@journey/llm";

const todos = createTodoListMiddleware({
  systemPrompt: "Break tasks into steps.",
  maxTodos: 50,
  persist: true,
});
```

Note: This middleware injects a `write_todos` tool for managing the list.

### 6. Human-in-the-Loop

```typescript
import { createHumanInTheLoopMiddleware } from "@journey/llm";

const hitl = createHumanInTheLoopMiddleware({
  interruptOn: {
    send_message: { allowedDecisions: ["approve", "edit", "reject"] },
    delete_record: true,
  },
  requestDecision: async (request) => ({ decision: "approve" }),
});
```

Notes:
- Provide `requestDecision` for synchronous approvals, or `eventHandler` to emit events.
- Without a handler, tool calls default to `reject`.

### 7. Usage Tracking

```typescript
import { createUsageTrackingMiddleware } from "@journey/llm/middleware";

const tracking = createUsageTrackingMiddleware({
  service: "agent-handler",
  module: "routing",
  trackIndividualCalls: true,
});
```

Note: usage tracking requires `runtime.orgId`.

### 8. LLM Guard

```typescript
import { createLLMGuardMiddleware } from "@journey/llm";

const guard = createLLMGuardMiddleware({
  blockedMessage: "Cannot assist with that request.",
  spamBlockedMessage: "Please ask a genuine question.",
});
```

---

## Priority Ordering

Lower numbers run first (defaults shown):

- 3: LLM guard
- 5: Model fallback
- 10: PII detection
- 15: Summarization
- 20: Model call limit
- 25: Todo list
- 30: HITL
- 35: Usage tracking
- 40+: Custom middleware
