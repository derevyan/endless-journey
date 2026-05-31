# @journey/engine-integrations

DB- and LLM-backed implementations for `@journey/engine` interfaces. This package wires engine services to database tables and `@journey/llm` so the engine can run agent workflows and memory features in production.

## What It Provides

- `AgentWorkflowService` implementation backed by `agent_workflows` table
- `AgentConversationStore` implementation backed by `agent_conversations` table
- `MemoryService` implementation backed by `agent_memories` + embeddings
- `buildAgentMiddleware()` to turn node config into LLM middleware

## Default Bundle

```typescript
import { createEngineIntegrations } from "@journey/engine-integrations";

const integrations = createEngineIntegrations({
  clientId,
  organizationId,
});

const engine = new SessionEngine(session, journey, adapter, {
  agentWorkflowService: integrations.agentWorkflowService,
  agentConversationStore: integrations.agentConversationStore,
  memoryService: integrations.memoryService,
});
```

## Agent Workflow Service

Loads workflows from the database and executes them with the `@journey/llm/workflow` runtime. It registers built-in executors once per process.

```typescript
import { createAgentWorkflowService } from "@journey/engine-integrations";

const service = createAgentWorkflowService();
await service.initialize();

const workflow = await service.loadWorkflow({
  organizationId,
  workflowKey: "support-routing",
});

if (workflow) {
  const result = await service.runWorkflow({
    workflow,
    input: { message: "Hi" },
    context,
  });
}
```

Notes:
- `initialize()` is optional but recommended at startup to register built-in executors once.
- `runWorkflow()` also registers executors defensively if you skip `initialize()`.
- By default, only `active` workflows can be loaded. Use `options: { allowDrafts: true }` or `options: { allowArchived: true }` to load non-active workflows.

## Agent Conversation Store

Persists agent conversation messages in `agent_conversations` as JSONB arrays.

```typescript
import { createAgentConversationStore } from "@journey/engine-integrations";

const store = createAgentConversationStore();
await store.appendMessage({
  sessionId,
  nodeId,
  message: { role: "assistant", content: "Hello" },
});
```

Notes:
- Messages are appended to a `session_id` + `node_id` row.
- The store only supports append; read/trim logic lives outside this package.

## Memory Service

Stores and retrieves long-term memories using embeddings. This uses `agent_memories` with pgvector similarity.

```typescript
import { createMemoryService } from "@journey/engine-integrations";

const memory = createMemoryService({ clientId, organizationId });

await memory.save({
  key: "user_preference",
  content: "Prefers morning meetings",
  memoryType: "preference",
});

const results = await memory.search("meeting time", 5);
```

Notes:
- Memories are scoped per `clientId` + `organizationId`. Optionally provide `journeyId` to scope memories to a specific journey.
- When `journeyId` is provided, save/search/getRecent operations are isolated to that journey.
- When `journeyId` is omitted, operations work globally across all journeys.
- Uses `generateEmbedding()` from `@journey/llm` (OpenAI via `OPENAI_API_KEY`).
- Requires pgvector extension in PostgreSQL.

## buildAgentMiddleware

Converts `AgentMiddlewareConfig` from schemas into LLM middleware instances.

```typescript
import { buildAgentMiddleware } from "@journey/engine-integrations";

const middleware = buildAgentMiddleware(nodeData.middleware, {
  conversationHistory: nodeData.conversationHistory,
  nodeId,
  sessionId,
  eventLogger,
});
```

- Supports LLM guard, model fallback, PII detection, summarization, call limits, todo list, and HITL.
- HITL events are emitted via `EventLogger` when configured.
- Summarization middleware defaults to `llmConfig.summarization` when not overridden.

## Runtime Requirements

- Database access (`@journey/db`)
- LLM access for embeddings and summarization
- Server runtime (not browser-safe)
