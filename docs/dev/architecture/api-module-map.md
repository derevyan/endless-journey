# API Module Map

This document describes the vertical slice module structure for `apps/api`. Each domain module owns its routes, services, and queries in a cohesive folder.

## Module Structure

```
apps/api/src/modules/
├── journeys/           # Journey CRUD, versioning, activation
│   ├── index.ts        # Public API exports
│   ├── routes/         # HTTP routes
│   └── services/       # Business logic
├── sessions/           # Session viewer, history, status
│   ├── index.ts
│   └── routes/
├── users/              # Channel users, activity, tags
│   ├── index.ts
│   ├── routes/
│   └── services/
├── uploads/            # Media uploads, gallery
│   ├── index.ts
│   ├── routes/
│   └── services/
├── event-api/          # Event logs, stats, streaming (HTTP API)
│   ├── routes/
│   ├── services/
│   └── index.ts
├── simulator/          # Engine-backed testing, timers
│   ├── routes/
│   └── services/
├── channels/           # Telegram channel CRUD, webhooks
│   ├── routes/
│   ├── services/
│   └── webhooks/
├── crm/                # Pipelines, stages, clients, messaging
│   ├── routes/
│   ├── services/
│   └── index.ts
├── mindstates/         # Definitions, preview, history
│   ├── routes/
│   └── services/
├── workflows/          # Workflow builder, approvals, execution
│   ├── routes/
│   ├── services/
│   └── index.ts
├── variables/          # Variable definitions and values
│   ├── routes/
│   └── services/
├── tags/               # Tag definitions and assignments
│   ├── routes/
│   └── services/
├── audio/              # STT/TTS endpoints
│   └── routes/
├── llm-registry/       # LLM model metadata, pricing (public API)
│   └── routes/
├── agent-tools/        # System/utility/MCP tool discovery
│   └── routes/
└── router.ts           # Central route composition
```

## Event Bus Infrastructure

The `event-bus/` directory sits alongside `modules/` at the top level of `src/`:

```
apps/api/src/
├── event-bus/          # Infrastructure - NOT a domain module
│   ├── automation/     # Automation event service (BullMQ)
│   ├── consumers/      # Event subscribers (log, SSE, automation)
│   ├── publishers/     # Event emitters (organized by domain)
│   ├── event-bus.ts    # Core pub/sub routing
│   └── ...
├── modules/
│   ├── event-api/      # HTTP API for querying events
│   └── ...
```

**Why separate from modules?**
- It's infrastructure that ALL modules depend on, not a domain module
- It doesn't expose HTTP routes (unlike everything in `modules/`)
- It's a cross-cutting concern (pub/sub machinery)

## Module Template

Each module follows this standard structure:

```
modules/{domain}/
├── index.ts       # Public API - routes + service class exports
├── routes/        # HTTP routes (thin layer, uses services)
│   └── index.ts
├── services/      # Business logic + DB access
│   ├── api-{domain}-service.ts
│   ├── service-context.ts
│   └── index.ts
├── queries/       # Optional: complex DB queries if needed
└── types.ts       # Optional: module-specific types (not in schemas)
```

### Guidelines

1. **Routes are thin** - HTTP concerns only (validation, response formatting)
2. **Services own logic** - Business rules, orchestration, DB access via injected `db`
3. **Queries are optional** - Only create for complex/reusable DB operations
4. **Index exports public API** - Routes + service classes, not standalone functions

## Module Ownership

| Module | Owner | Dependencies |
|--------|-------|--------------|
| `journeys` | Core | - |
| `sessions` | Core | journeys |
| `users` | Core | sessions, tags |
| `uploads` | Core | journeys |
| `event-api` | Core | event-bus infrastructure |
| `simulator` | Core | journeys, sessions, engine |
| `channels` | Core | journeys |
| `crm` | CRM | clients, sessions |
| `mindstates` | CRM | clients |
| `workflows` | Workflows | engine |
| `variables` | Config | - |
| `tags` | Config | - |
| `audio` | Media | - |
| `llm-registry` | LLM | - |
| `agent-tools` | LLM | MCP service |

## Data Access Boundaries

- **Routes**: No direct DB access (`db.*` imports) - use `createServicesFromContext(c)`
- **Services**: Business logic + DB access via injected `db`
- **Queries**: Direct DB operations, complex joins, aggregations

```typescript
// CORRECT: Route uses service container
router.get("/", async (c) => {
  const services = createServicesFromContext(c);
  const result = await services.event.listInteractionEvents(filters);
  return c.json({ success: true, data: result.events });
});

// INCORRECT: Route has DB access
router.get("/", async (c) => {
  const result = await db.select().from(interactions).where(...);
  return c.json({ success: true, data: result });
});
```

## Service Container Pattern

All API modules use the service container for dependency injection.

### Creating Services in Routes

```typescript
import { createServicesFromContext } from "../../../services";

router.get("/", async (c) => {
  const services = createServicesFromContext(c);
  const data = await services.variable.getGlobalVariables();
  return c.json({ success: true, data });
});
```

### Available Services

| Service    | Interface             | Description                  |
| ---------- | --------------------- | ---------------------------- |
| `variable` | `IApiVariableService` | Variable CRUD and operations |
| `tag`      | `IApiTagService`      | Tag management               |
| `crm`      | `IApiCrmService`      | CRM pipelines and clients    |
| `channel`  | `IApiChannelService`  | Channels, sessions, bots     |
| `journey`  | `IApiJourneyService`  | Journey CRUD and versioning  |
| `user`     | `IApiUserService`     | Users and activity           |
| `prompt`   | `IApiPromptService`   | Prompt repository            |
| `event`    | `IApiEventService`    | Event query APIs             |
| `upload`   | `IApiUploadService`   | Journey media                |
| `workflow` | `IApiWorkflowService` | Workflow CRUD and approvals  |
| `mindstate`| `IApiMindstateService`| Mindstate definitions        |
| `simulator`| `IApiSimulatorService`| Simulator sessions           |

### Testing with Mock Services

```typescript
import { createMockServices, createTestServices } from "../services/test-helpers";
// Adjust relative path to your test file.

const services = createTestServices();

const { services: mockServices, mocks } = createMockServices();
mocks.variable.getGlobalVariables.mockResolvedValue([{ key: "apiKey", value: "sk-123" }]);
```

## Central Router

The `router.ts` file composes all module routes:

```typescript
// apps/api/src/modules/router.ts
export function createApiRouter() {
  const router = new Hono<{ Variables: Variables }>();

  router.route("/journeys", journeysRoutes);
  router.route("/", sessionsRoutes);
  router.route("/users", usersRoutes);
  // ... etc

  return router;
}

export function createWebhookRouter() {
  const router = new Hono<{ Variables: Variables }>();
  router.route("/telegram", telegramWebhook);
  return router;
}
```

This replaces scattered route imports in `app.ts` with a single entry point.

## Migration Notes

### From Legacy Structure

| Legacy Location | New Location |
|-----------------|--------------|
| `routes/journeys.ts` | `modules/journeys/routes/index.ts` |
| `services/journey-service.ts` | `modules/journeys/services/journey-service.ts` |
| `routes/crm/*` | `modules/crm/routes/` |
| `services/crm/*` | `modules/crm/services/` |
| `routes/telegram-webhook.ts` | `modules/channels/webhooks/telegram.ts` |

### Already Organized

The migration co-locates all domain routes and services under `modules/`.

## Related Docs

- `docs/api/README.md` - API overview
- `docs/api/routes.md` - Endpoint reference
- `docs/dev/architecture/event-pipeline.md` - Event system
