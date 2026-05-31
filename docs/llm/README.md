# @journey/llm

Production-grade LLM integration package for Journey Builder. Provides model access, agents, middleware, unified tools, workflow runtime, and model metadata/costing.

## At a Glance

- Multi-provider LLM via LangChain (openai, anthropic, google-genai, groq) with provider resolution via model registry + prefix fallback
- Core chat + structured output services (fallback models supported; streaming available)
- Unified agent engine (`runAgent`) with built-in middleware support
- Built-in middleware: guard, fallback, PII, summarization, HITL, todo, usage tracking
- Unified tool registry for system/utility/MCP tools (system + journey + embedded auto-register)
- Workflow DAG runtime with built-in executors (agent, guard, MCP, approvals, data/logic)
- Usage tracking with pluggable adapters (DB-backed default)
- OpenAI-only audio (STT/TTS) and embedding helpers
- Provider-aware error classification + mock provider for tests

## Quick Start

### Chat Completion

```typescript
import { createLogger } from "@journey/logger";
import { generateChatResponse } from "@journey/llm";

const log = createLogger("llm:readme");

const response = await generateChatResponse(
  "You are a helpful assistant.",
  [{ role: "user", content: "Hello!" }],
  { model: "gpt-4o" }
);

log.info({ content: response.result }, "llm:chat:complete");
```

### Structured Output (Zod)

```typescript
import { createLogger } from "@journey/logger";
import { generateStructuredOutput } from "@journey/llm";
import { z } from "zod";

const log = createLogger("llm:readme");

const schema = z.object({
  name: z.string(),
  age: z.number(),
  interests: z.array(z.string()),
});

const result = await generateStructuredOutput(
  "Extract user info",
  "John is 25, likes coding and music",
  schema,
  { model: "gpt-4o" }
);

log.info({ data: result.result }, "llm:structured:complete");
```

### Agent with Tools

```typescript
import { runAgent } from "@journey/llm";
import { z } from "zod";

const tools = [
  {
    name: "get_weather",
    description: "Get current weather for a location",
    schema: z.object({ location: z.string() }),
    execute: async ({ location }) => ({ location, temperature: 22, condition: "sunny" }),
  },
];

const result = await runAgent(
  "You are a weather assistant.",
  [{ role: "user", content: "Weather in London?" }],
  {
    model: "gpt-4o",
    tools,
    maxIterations: 5,
  }
);
```

### Agent with Middleware

```typescript
import {
  runAgent,
  createModelFallbackMiddleware,
  createModelCallLimitMiddleware,
  createPIIMiddleware,
} from "@journey/llm";

const result = await runAgent(
  "You are a helpful assistant.",
  [{ role: "user", content: "Email me at demo@example.com" }],
  {
    model: "gpt-4o",
    tools: [],
    middleware: [
      createModelFallbackMiddleware("gpt-4o-mini"),
      createModelCallLimitMiddleware({ runLimit: 10 }),
      createPIIMiddleware("email", { strategy: "redact" }),
    ],
  }
);
```

### Unified Tool Registry

```typescript
import { unifiedToolRegistry } from "@journey/llm/tools/unified";

const definitions = await unifiedToolRegistry.getAllDefinitions();

const tools = await unifiedToolRegistry.resolveTools(
  ["system:save_memory", "utility:current_time"],
  context
);
```

### Workflow Engine

```typescript
import { runWorkflow, registerBuiltinExecutors } from "@journey/llm/workflow";

registerBuiltinExecutors();

const result = await runWorkflow(workflow, { message: "Hello" }, context);
```

## Documentation

| Document | Description |
| --- | --- |
| `docs/llm/architecture.md` | Design patterns, data flows, architecture notes |
| `docs/llm/services.md` | LLM, agent, audio, embedding, guard, usage, question understanding |
| `docs/llm/middleware.md` | Middleware pipeline and built-ins |
| `docs/llm/tools.md` | Unified tools, system tools, utility tools, MCP |
| `docs/llm/workflow.md` | Workflow engine and node executors |
| `docs/llm/mcp-architecture.md` | MCP service and tool loading |
| `docs/llm/model-registry.md` | Model registry data and cost calculation |

## Package Structure

```
packages/llm/src/
├── agent/                       # Unified agent engine + model runtime
├── services/                    # LLM, agent, audio, embedding, guards
├── middleware/                  # Pipeline + built-ins
├── tools/                       # Unified tool system
│   ├── tool.ts                  # Utility tool helper
│   ├── types.ts                 # MCP type re-exports
│   ├── embedded/                # Utility tools (auto-registered)
│   │   ├── tavily.tool.ts
│   │   └── current-time.tool.ts
│   ├── builtin/                 # Context-aware system tools
│   └── unified/                 # Unified registry + registrations
├── workflow/                    # DAG workflow engine + executors
├── errors/                      # Error classification
├── providers/                   # Mock provider
├── clients/                     # OpenAI client
├── config/                      # Defaults + generator scripts
├── utils/                       # Shared helpers
└── index.ts                     # Public API
```

## Package Boundaries

The package is split into entry points for portability:

- **`@journey/llm`** (main) - All functionality, server initialization required
- **`@journey/llm/core`** - Browser-safe core (no Node.js dependencies)
- **`@journey/llm/server`** - Server-only adapters and services

**Browser/Edge usage**:
```typescript
import { runAgent, generateChatResponse } from "@journey/llm/core";
// No file I/O, no database access - pure computation
```

**Server usage** (APIs, workers, backend):
```typescript
import { FileSystemModelAdapter, setModelRegistryAdapter } from "@journey/llm/server";

// Initialize adapters on startup
const adapter = new FileSystemModelAdapter();
await adapter.initialize();
setModelRegistryAdapter(adapter);
```

## Sampling Parameters

The `LLMConfig` now supports advanced sampling control:

```typescript
const result = await runAgent(
  "You are a helpful assistant.",
  [{ role: "user", content: "Answer creatively" }],
  {
    model: "gpt-4o",
    temperature: 0.9,      // Higher randomness
    topP: 0.95,            // Nucleus sampling - focus on top 95%
    frequencyPenalty: 0.5, // Reduce repetition
    presencePenalty: 0.3,  // Encourage new topics
    tools: [],
  }
);
```

These parameters are:
- **Included in model cache key** - different configs create distinct model instances
- **Preserved in fallback** - when primary model fails, sampling config stays the same
- **Provider-aware** - some providers may not support all parameters

## Adapter Pattern

The model registry uses a pluggable adapter pattern:

```typescript
interface ModelRegistryAdapter {
  getModel(modelId: string): ModelMetadata | undefined;
  getModels(): ModelMetadata[];
  calculateCost(modelId: string, inputTokens: number, outputTokens: number): number;
  initialize?(): Promise<void>;
  isReady?(): boolean;
}
```

**Implementations**:
- `FileSystemModelAdapter` - Full registry from `essential-models.ts` (server-only)
- `StaticModelAdapter` - ~12 bundled essential models (portable)
- `NoopModelAdapter` - Fallback when registry unavailable

This enables testing without file I/O and browser usage without Node.js.

## Runtime Notes

- **Adapter initialization** (server only): `const adapter = new FileSystemModelAdapter(); await adapter.initialize(); setModelRegistryAdapter(adapter);`
- Usage tracking uses `@journey/db`; call `usageTrackingService.initialize()` in server runtimes.
- You can replace DB tracking with a custom adapter via `usageTrackingService.setAdapter()`.
- `@journey/llm/tools/unified` requires explicit `registerBuiltinTools()` call (async) on startup.
- MCP tools require `initMCPServiceClient()` to be called on startup; registry caches MCP definitions for ~5s.
- `LLMConfig.timeout` is in seconds (converted to ms internally); `reasoningEffort` overrides temperature.
- `GEMINI_API_KEY` is supported as an alternative to `GOOGLE_API_KEY` for google-genai.
- `generateChatResponse`/`generateStructuredOutput` throw in mock mode (`FORCE_MOCK_LLM=true` or `model: "mock"`). Use `MockProvider` for tests.
- Audio + embedding helpers require `OPENAI_API_KEY`.

## Related Packages

- `packages/mcp` - MCP client + types
- `packages/engine` - Journey execution engine
- `packages/schemas` - Shared type definitions
