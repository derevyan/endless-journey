# @journey/llm

LLM service integration with multi-provider support (OpenAI, Anthropic, Google/Gemini, Groq, Cerebras), agent execution engine, middleware system, and MCP tool integration.

## Documentation

Full documentation lives in `docs/llm/` at the repo root:

- **Overview**: `docs/llm/README.md`
- **Architecture**: `docs/llm/architecture.md` - Provider resolution, adapters, caching, cost calculation
- **Services**: `docs/llm/services.md` - Audio, embedding, guard, analysis services
- **Middleware**: `docs/llm/middleware.md` - Model fallback, usage tracking, middleware composition
- **Tools**: `docs/llm/tools.md` - Tool registry, MCP integration, system/utility tools
- **Workflow**: `docs/llm/workflow.md` - Node executors, orchestration
- **Model registry**: `docs/llm/model-registry.md` - Provider detection, model metadata, pricing
- **MCP**: `docs/llm/mcp-architecture.md` - MCP server integration, tool calling

## Migration Guide (January 2026 Architecture Refresh)

### Breaking Changes

#### 1. Model Adapters Consolidated
```typescript
// BEFORE (no longer available)
import { StaticModelAdapter } from "@journey/llm/adapters";
import { FileSystemModelAdapter } from "@journey/llm/server/adapters";

// AFTER (use unified adapter)
import { EssentialModelAdapter } from "@journey/llm/adapters";
const adapter = new EssentialModelAdapter();
setModelRegistryAdapter(adapter);
```

#### 2. Usage Tracking via Context
```typescript
// BEFORE (direct service import)
import { usageTrackingService } from "@journey/llm/services";
usageTrackingService.recordUsage(...);

// AFTER (adapter pattern - portable)
import { getUsageTrackingAdapter } from "@journey/llm/adapters";
const adapter = getUsageTrackingAdapter();
if (adapter.isReady?.()) {
  adapter.recordUsage(...);
}
```

#### 3. Portable Core Exports
```typescript
// BEFORE (core had server dependencies)
import { runAgent } from "@journey/llm/core"; // Had DB dependencies

// AFTER (truly portable)
import { runAgent } from "@journey/llm/core"; // No dependencies
import { createUsageTrackingMiddleware } from "@journey/llm/server"; // Server-only
```

#### 4. Agent Config Split
```typescript
// BEFORE (all features in one interface)
const config: AgentEngineConfig = {
  model: "gpt-4o",
  fallbackModels: [...], // ← not used by engine!
  tools: [...],
};

// AFTER (split types clarify usage)
const config: AgentEngineConfig = {
  model: "gpt-4o",
  tools: [...],
};

const serviceConfig: AgentServiceConfig = {
  ...config,
  fallbackModels: [...], // ← now properly documented as server feature
};
```

### Performance Improvements

- **Runtime consolidation**: 750 lines of duplicate code removed
- **Cache key fix**: All sampling parameters (topP, frequencyPenalty, presencePenalty) now included
- **Cost tracking**: Proper per-iteration accumulation (fixes multi-model billing)
- **MCP optimization**: Batch tool fetching with 5s cache (50% fewer network calls)

### Bug Fixes (2026 Q1 Refresh)

| ID | Severity | Issue | Fix |
|---|----------|-------|-----|
| F1 | HIGH | Core boundary leak (DB dependency) | Adapter pattern with contexts |
| F2 | HIGH | Cache key missing sampling params | Include all params in key |
| F3 | HIGH | Cost recalculated per-iteration | Accumulate per-model |
| F4 | MEDIUM | Fallback stuck on provider | Clear provider on fallback |
| F5-F6 | MEDIUM | Code duplication | Consolidate to `/runtime` |
| F7 | MEDIUM | N getTools() calls per tool | Batch with 5s cache |
| F8 | MEDIUM | Unused fields in AgentEngineConfig | Split to AgentServiceConfig |

## Server Initialization

Required in API/server startup code:

```typescript
import { initializeServerServices } from "@journey/llm/server";

// During app initialization
initializeServerServices();
// Sets up: usage tracking, model registry, logging
```
