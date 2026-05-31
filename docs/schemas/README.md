# @journey/schemas

Single source of truth for Zod schemas, TypeScript types, and cross-package contracts used across the Journey platform.

## Overview

This package provides:

- **Zod schemas + inferred types** for all shared data structures
- **Runtime validation** at API/engine/web boundaries
- **Shared service contracts** (`SharedServiceContext` + service interfaces)
- **Unified event system** (registry, typed payloads, store events)
- **Permission model** for capability-based access control
- **Mindstate + user activity** schemas for analytics and AI context
- **Schema utilities** for content split/merge, IDs, pagination, and more

**Critical rule:** Never duplicate type definitions. Import from `@journey/schemas`.

## Entry Points

- `@journey/schemas` - full export surface (schemas, types, utilities)
- `@journey/schemas/api` - API input schemas only

## Module Map

| Area            | Location                                                   | What it covers                                       |
| --------------- | ---------------------------------------------------------- | ---------------------------------------------------- |
| Nodes           | `src/nodes/`                                               | Node data schemas, capabilities, buttons, follow-ups |
| Journeys        | `src/journey.ts`                                           | Journey config, edges, guards, versions              |
| Sessions        | `src/session.ts`                                           | Session snapshots, history, node outputs             |
| User activity   | `src/user-activity.ts`                                     | Activity timeline entries for UI and analytics       |
| Events          | `src/events/`                                              | Registry, typed events, payloads, store events       |
| Variables       | `src/variables/`                                           | Scopes, operations, namespaces, helpers              |
| Content         | `src/content.ts`                                           | Split/merge content from structure                   |
| Automation      | `src/automation.ts`                                        | Trigger configs, automation events                   |
| Services        | `src/services/`                                            | Service interfaces + shared context + no-op factory  |
| Permissions     | `src/permissions/`                                         | Subjects, resources, capabilities, checker, audit    |
| Agent workflows | `src/agents/workflow/`                                     | Workflow graph schemas, validation                   |
| CRM             | `src/crm/`                                                 | CRM domain models                                    |
| Mindstate       | `src/mindstate.ts`                                         | Mindstate definitions, analysis configs, defaults    |
| API schemas     | `src/api/`                                                 | Request/response validation                          |
| LLM             | `src/llm/`, `src/model-schemas.ts`, `src/config/`          | Providers, runtime config, usage, defaults           |
| Simulator       | `src/simulator.ts`                                         | Simulator events + input schemas                     |
| Errors          | `src/errors/`                                              | Domain error hierarchy                               |
| Utilities       | `src/utils.ts`, `src/branded-ids.ts`, `src/value-types.ts` | Common schemas/helpers                               |

---

## Node Schemas (`nodes/`)

**Node types (10 total):** `start`, `message`, `condition`, `wait`, `webhook`, `crm`, `teleport`, `end`, `questionnaire`, `agent`.

| Node          | File               | Purpose                                                       |
| ------------- | ------------------ | ------------------------------------------------------------- |
| Base          | `base.ts`          | Shared fields, actions (tags/variables/CRM), timers, metadata |
| Start         | `start.ts`         | Journey entry point                                           |
| Message       | `message.ts`       | Content, buttons, media, follow-ups, response modes           |
| Condition     | `condition.ts`     | Branching via rules and operators                             |
| Wait          | `wait.ts`          | Time delays                                                   |
| Webhook       | `webhook.ts`       | HTTP calls + retry/error handling                             |
| CRM           | `crm.ts`           | CRM actions                                                   |
| Teleport      | `teleport.ts`      | Jump to another journey                                       |
| Questionnaire | `questionnaire.ts` | Multi-question flow with validation                           |
| Agent         | `agent.ts`         | Workflow delegation node (workflowKey + optional timeout)     |
| End           | `end.ts`           | Terminal node                                                 |

**Agent node note:** `AgentNodeDataSchema` only stores `workflowKey` + optional `timeout`. LLM/tool config lives in agent workflow schemas under `src/agents/workflow/`.

**Node actions (shared):**

- `tagAction` (add/remove user tags)
- `variableAction` (set/delete/increment/decrement/push/pop/merge)
- `crmAction` (pipeline/stage updates)

**Capabilities (15 flags):**

`hasTextMessage`, `hasButtons`, `hasMedia`, `hasTimer`, `hasFollowUp`, `hasDuration`, `hasTimeout`, `hasConditions`, `hasVariableAssignment`, `hasTagAction`, `hasResponseCapture`, `hasWebhook`, `hasCrmAction`, `hasAI`, `hasQuestions`

**Follow-ups and buttons:**

- `ButtonsSchema` routes via `targetNodeId` (managed edges are generated for visualization).
- Button text is auto-truncated to 35 chars (Telegram safe), unless it is a `$content:` reference.
- `FollowUpSequenceSchema` embeds reminder sequences inside message nodes and uses `targetNodeId` for follow-up buttons.

---

## Journey Schemas (`journey.ts`)

**Core graph:**

```typescript
export const JourneyConfigSchema = z.object({
  nodes: z.array(JourneyNodeSchema),
  edges: z.array(JourneyEdgeSchema),
});
```

**Edges and guards:**

- Edge types: `success`, `default`, `retry`, `dropoff`, `exit`, `timer`
- Guards: `expression`, `variable`, `tag`
- Managed edges: `managed` + `managedBy` (auto-generated from buttons/follow-ups)
- `fallback: true` marks a safety edge when all other guards fail

**Journey record + versions:**

- `JourneyConfigRecordSchema` for DB records (includes `mindstateConfig` and `transferAllowlist`)
- `CreateJourneyInputSchema` / `UpdateJourneyInputSchema` (+ `deactivationMode`)
- `JourneyVersionSchema`, `SaveVersionInputSchema`, `VersionedJourneyDataSchema`
- `JourneyListQuerySchema`, `ManifestSchema`, `ScenarioSchema` for list/manifest/scenario support

---

## Session Schemas (`session.ts`)

- **EnhancedUserJourneySchema** (current snapshot + event history)
  - `status`: `active | completed | dropped | paused | error`
  - `pendingTimers` + `pendingFollowUps`
  - `activeButtons` for unified button routing (`source: node | plugin | questionnaire`)
  - `nodeOutputs` for cross-node references (keyed by node label)
  - `history` of `InteractionEvent`
- **UserJourneySchema** / **UserNodeStateSchema**: legacy/backward compatibility

---

## User Activity (`user-activity.ts`)

Unified activity timeline entries that combine lifecycle + interaction events:

- `UserActivityEntrySchema` (session/journey metadata, actor, timestamps)
- `UserActivityEventTypeSchema` (user, bot, system, CRM, mindstate, guard, HITL, etc.)
- `UserActivityActorSchema` (`user | bot | system`)

---

## Event System (`events/`)

Unified event definitions with registry + typed payloads:

- `BaseEventSchema` (metadata, sequencing, tracing)
- `InteractionEventSchema` for session history
- `EVENT_REGISTRY` for payload inference
- `TypedEvent`/`EventPayload` helpers
- `store-events.ts` for frontend store communication
- `EventTypes`, `EventCategorySchema`, `EventSourceSchema` for consistent type/category/source metadata

Event types live in `events/event-types.ts` (interaction, lifecycle, workflow, system).

---

## Variables (`variables/`)

Split into submodules for better organization:

| File             | Purpose                                                                         |
| ---------------- | ------------------------------------------------------------------------------- |
| `conversions.ts` | Type conversion utilities (`isEmpty`, `isTruthy`, `toNumber`, `toString`, etc.) |
| `operations.ts`  | Variable scope and operation schemas (`set`, `delete`, `increment`, etc.)       |
| `data.ts`        | Variable data schemas for API (`GlobalVariable`, `JourneyVariable`)             |
| `namespaces.ts`  | Template resolution context (`VariableNamespaces`, `buildVariableNamespaces`)   |

**Scopes:** `journey`, `global`, `user`

**Operations (7 types):** `set`, `delete`, `increment`, `decrement`, `push`, `pop`, `merge`

**Key exports:**

- `VariableValueSchema` (re-exported from `value-types.ts`)
- `ExecuteVariableOperationsRequestSchema`
- `VariableNamespaces` for template resolution
- `VariableActionSchema` (in `nodes/base.ts`) for node-side mutations

**Helpers:** `isEmpty`, `isTruthy`, `toNumber`, `toString`, `toExprEvalContext`, `prepareForCondition`, `buildVariableNamespaces`

---

## Content Split/Merge (`content.ts`)

Content and structure can be separated for AI editing workflows. Content utilities were merged into `content.ts`.

**Content file schema:**

- `JourneyContentSchema` + `ContentEntrySchema` (with optional `description`)
- Reference tokens: `$content:{path}`

**Reference helpers:**

- `createContentRef`, `parseContentRef`, `isContentRef`, `createEmptyContent`

**Split/merge utilities:**

- `splitJourneyContent` - Extract content from structure
- `mergeJourneyContent` - Restore content into structure
- `hasContentReferences` - Check if config uses content references
- `optimizeJourneyForExport` - Full export pipeline (normalize + split)
- `restoreJourneyFromExport` - Full import pipeline (merge + denormalize)

**Edge style normalization:**

- `normalizeEdgeStyles`, `denormalizeEdgeStyles`, `getEdgeStyle`
- Callers supply `EdgeStyleDefaults` (see `apps/web/src/features/nodes/journey/config/node-theme.ts`)

---

## Automation (`automation.ts`)

- Trigger configs: `user_message`, `tag_change`, `variable_condition`, `journey_completed`, `schedule`, `webhook`
- Automation events for queues: `tag.added`, `tag.removed`, `variable.changed`, `journey.started`, `journey.completed`, `schedule.fired`, `webhook.received`

---

## Services (`services/`)

Service interfaces are shared contracts across engine, workflows, tools, and API.

**Core services:**

- `IVariableService`
- `IMessengerService`
- `ITemplateService`

**Optional services:**

- `IMemoryService`, `ICrmService`, `ITagService`
- `IMindstateService`, `IDlqService`, `IExpressionService`, `IFollowUpService`
- `ICacheService`, `IJourneyService`

`SharedServiceContext` exposes these with `has()` checks. No-op builders live in `noop-factory.ts`:
`createNoOpServiceContext`, `createMinimalServiceContext`, `createPartialServiceContext`.

---

## Permission System (`permissions/`)

- Subjects: `PermissionSubject`, `createJourneyEngineSubject`, `createLlmToolSubject`, etc.
- Resources: variable scopes, system actions, external targets
- Capabilities: `CapabilityDeclaration`, `CapabilityProfiles`, `mergeCapabilities`
- Checker: `PermissionChecker`, `PermissionDeniedError`
- Guarded services: `createGuardedContext`
- Audit utilities: in-memory + callback audit loggers

---

## Agent Workflow Schemas (`agents/workflow/`)

Schemas for the visual workflow builder:

- Node type enums, base node + edge schemas
- Node groups: `core`, `logic`, `data`, `tools`
- Workflow configuration and settings (`WorkflowConfigurationSchema`, `WorkflowSettingsSchema`)
- Validation utilities
- `AgentDefinitionSchema` and version schemas

---

## CRM Schemas (`crm/`)

Core CRM domain models:

- Clients, pipelines, stages, fields, activities, messaging

---

## Mindstate (`mindstate.ts`)

Mindstate definitions and analysis configuration:

- `MindstateDefinitionSchema`, `ClientMindstateSchema`
- Agent definitions + defaults (`SystemAgentSchema`, `MainAgentSchema`)
- Analysis triggers, node rules, and journey config (`JourneyMindstateConfigSchema`)

---

## API Schemas (`api/`)

Zod schemas for API contracts:

- Channel configuration
- Tag management
- Mindstate configuration
- Variable operations

---

## LLM Schemas + Config (`llm/`, `model-schemas.ts`, `config/`)

- Canonical providers + runtime config (`LLMProviderSchema`, `LLMRuntimeConfigSchema`, `LLMModelConfigSchema`)
- Question understanding schemas
- Token usage and usage registry
- Agent tool types and capabilities (`agent-types.ts`)
- LLM model registry validation (`model-schemas.ts`)
- App defaults: `llmConfig` and `getGuardWorkers()`

---

## Simulator (`simulator.ts`)

Shared simulator types and API input schemas:

- SSE event types (`SIMULATOR_EVENTS`)
- Debug state enrichment (`SimulatorDebugStateSchema`)
- Execute input schemas (`SimulatorExecuteRequestSchema`)
- Session + persona request schemas
- Constants/helpers: `SIMULATOR_CONFIG`, `generateSimulatorClientId`

---

## Utilities

- `utils.ts`: `NonEmptyStringSchema`, `IsoTimestampSchema`, `FlexibleDateSchema`, pagination helpers, `ApiErrorSchema`, `generateSlug`
- `branded-ids.ts`: branded UUID/slug types + Zod schemas and constructors
- `value-types.ts`: supported variable value types
- `errors/index.ts`: shared error hierarchy

---

## Usage Examples

### Importing types

```typescript
import type { JourneyConfig, JourneyStepData } from "@journey/schemas";

const config: JourneyConfig = { nodes: [], edges: [] };
```

### Runtime validation

```typescript
import { JourneyConfigSchema } from "@journey/schemas";

const result = JourneyConfigSchema.safeParse(raw);
if (!result.success) {
  // handle result.error
}
```

### Working with events

```typescript
import type { TypedEvent } from "@journey/schemas";

const event: TypedEvent<"crm.stage.changed"> = {
  id: "...",
  type: "crm.stage.changed",
  timestamp: new Date().toISOString(),
  version: 1,
  organizationId: "org_123",
  source: "crm",
  sequence: 1,
  payload: {
    /* typed payload */
  },
};
```

---

## File Structure

```
packages/schemas/src/
├── index.ts                 # Main entry point (re-exports all modules)
├── journey.ts               # Journey config, edges, guards, versions
├── session.ts               # Session snapshots, history, node outputs
├── value-types.ts           # Base variable value types
├── automation.ts            # Trigger configs, automation events
├── user-activity.ts         # Activity timeline entries
├── content.ts               # Content split/merge + edge style utilities
├── branded-ids.ts           # Type-safe UUID/slug branded types
├── mindstate.ts             # Mindstate definitions, analysis configs
├── simulator.ts             # Simulator events + input schemas
├── utils.ts                 # Common schemas/helpers
├── __tests__/               # Unit tests
├── errors/                  # Domain error hierarchy
├── nodes/                   # Node type definitions + capabilities
├── variables/               # Variable system (5 submodules)
│   ├── index.ts            # Re-exports all variable schemas
│   ├── conversions.ts      # Type conversion utilities
│   ├── operations.ts       # Scope and operation schemas
│   ├── data.ts             # Variable data schemas for API
│   └── namespaces.ts       # Template resolution context
├── services/                # Service interfaces + no-op factories
├── permissions/             # Capability-based access control
├── agents/                  # Agent workflow schemas
│   └── workflow/           # Visual workflow builder schemas
├── crm/                     # CRM domain models
├── events/                  # Event registry, typed payloads
│   └── payloads/           # Event payload schemas by category
├── api/                     # API input validation schemas
├── llm/                     # LLM provider/runtime config
│   └── __tests__/          # LLM-specific tests
└── config/                  # App-level defaults
```

---

## Testing

```bash
pnpm --filter @journey/schemas test
pnpm --filter @journey/schemas test:questionnaire
```

---

## See Also

- `packages/schemas/README.md`
- `docs/dev/architecture/packages.md`
- `docs/dev/architecture/diagrams/package-dependencies.md`
- `docs/dev/architecture/diagrams/node-system.md`
- `docs/dev/guides/adding-new-node-type.md`
