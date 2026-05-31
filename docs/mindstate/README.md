# Mindstate Package

`@journey/mindstate` is the ECS-style analysis pipeline that turns user messages into structured state updates, agent insights, and a main-agent response. The package is pure (no DB) and relies on callers to supply context and persist results.

## What It Does

- Ingests a user message into a normalized `Message` record.
- Builds a conversation context string from provided history.
- Assigns state parameters to system agents.
- Runs agent batch analysis via `@journey/llm` (structured output).
- Aggregates updates and applies hysteresis-aware state changes.
- Generates `AgentInsight` records from agent analyses.
- Generates a main-agent response using the updated state snapshot.
- Returns metrics, applied changes, and partial-success info.

## Core Concepts

- **MindstateDefinition**: org-level template (agents + parameters). Defined in `@journey/schemas`.
- **ClientMindstate**: runtime instance per client (state values + insights).
- **StateParameter**: trackable component (numeric/categorical/boolean) with `updatePolicy` and `detectionHints`.
- **SystemAgent**: specialized agents that analyze subsets of parameters.
- **MainAgent**: produces the user-facing response informed by the full state snapshot.

## Package Structure

```
packages/mindstate/src/
├── index.ts
├── types.ts               # Pipeline types + Message model
├── llm/
│   ├── agent-service.ts   # LLM calls + mock mode
│   └── prompts.ts         # Prompt builders
├── pipeline/
│   ├── orchestrator.ts    # createPipeline + executePipeline
│   └── steps/             # 8 pipeline steps
└── utils/
    ├── id.ts              # UUID helpers
    └── type-coercion.ts   # Numeric/boolean/categorical coercion
```

## Pipeline Steps (Current Order)

1. **ingest** (`ingestMessage`) - normalizes the user message.
2. **context** (`prepareContext`) - builds a context string from `context.messages`.
3. **workload** (`assignWorkload`) - maps `StateParameter` entries to agents.
4. **dispatch** (`dispatchAgents`) - runs system agents in parallel via LLM calls.
5. **aggregate** (`aggregateResults`) - flattens updates (no conflict resolution).
6. **state-update** (`applyStateUpdates`) - applies updates + hysteresis + history.
7. **insights** (`generateInsights`) - derives `AgentInsight` records from agent analysis.
8. **response** (`generateResponse`) - main-agent response using state snapshot.

### Notes

- The pipeline does **not** load conversation history; callers must provide `context.messages`.
- Hysteresis (`updatePolicy.hysteresis`) is enforced for **numeric** parameters only.
- Conflicts are detected when multiple agents update the same parameter; uses last-wins strategy.
- `dispatchAgents` uses `Promise.allSettled`, allowing partial success when an agent fails.

## Usage

```typescript
import { executePipeline, createPipeline, type PipelineContext } from "@journey/mindstate";

const pipeline = createPipeline({
  contextMessageLimit: 20,
  insightsLimit: 50,
  fallbackAgentId: "general_agent",
});

const context: PipelineContext = {
  userState: stateParameters,
  systemAgents,
  mainAgent,
  messages: messageHistory,
};

const result = await pipeline.execute({
  userMessage: "I feel overwhelmed today",
  context,
});
```

## LLM Integration

- **System agents** use `generateStructuredOutput` with `AgentBatchResponseSchema`.
- **Main agent** uses `generateChatResponse` with a state-aware system prompt.
- **Mock mode** triggers when a model is missing or `FORCE_MOCK_LLM=true`.

## Outputs

`PipelineResult` returns:

- `updatedState`: updated parameters with history entries added
- `changes`: applied updates (post-hysteresis)
- `newInsights`: one insight per agent batch
- `assistantMessage`: main-agent response
- `metrics`: duration + counts + token usage (includes `perAgentUsage` for cost tracking)
- `conflicts`: list of multi-agent conflicts detected during aggregation
- `mainAgentError`: error from main agent if response generation failed
- `failedAgents` and `partialSuccess` when a subset of agents fails

Use `isPipelineError` to type-guard pipeline failures.

## Integration Points

### API Service

- `apps/api/src/modules/mindstates/services/analysis-service.ts`
- `analyzeMessage` persists state updates and appends `mindstate_analysis_log`.
- `previewAnalyzeMessage` runs the pipeline without DB writes for the builder.

### Engine Integration

- `packages/engine/src/mindstate/mindstate-analyzer.ts`
- Applies `JourneyMindstateConfig` (`analysisMode`, `startCondition`, `nodeTypeRules`).
- Calls the injected `mindstateService` if configured.

### Schemas + DB

- Schemas: `packages/schemas/src/mindstate.ts`
- Tables: `packages/db/src/schema/mindstate.ts`

## Tests

- `packages/mindstate/src/pipeline/__tests__/orchestrator.test.ts`
- `packages/mindstate/src/utils/__tests__/type-coercion.test.ts`

## Related Docs

- `docs/dev/architecture/mindstate.md`
- `docs/dev/architecture/data-flows.md`
- `docs/dev/architecture/diagrams/mindstate-pipeline.md`
- `docs/api/routes.md`
- `docs/db/README.md`
- `docs/schemas/README.md`
