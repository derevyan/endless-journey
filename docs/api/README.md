# Journey API

Hono-based REST API server for the Journey platform.

## Overview

The API provides:

- **Journey management** - CRUD, versioning, activation/deactivation, session counts
- **Channels** - Telegram channel CRUD, webhook registration
- **Sessions + users** - session viewer, user activity, tag filters
- **Event system** - unified event bus, SSE streaming, replay, CRM + LLM logs
- **Automation + timers** - BullMQ-driven workflows, wait nodes, approvals
- **CRM** - pipelines, stages, fields, clients, direct messaging
- **Simulator** - engine-backed testing with personas and timer controls
- **Mindstates** - definitions, preview analysis, client history
- **Agent workflows** - workflow builder, approvals, validation, test execution
- **Media + audio** - uploads, avatars, STT/TTS
- **Agent tools** - system/utility/MCP tool discovery
- **LLM registry + usage** - dynamic model catalog + usage analytics

For the canonical endpoint list, see `docs/api/routes.md`.

---

## Architecture

### Module Structure

The API uses a vertical slice architecture where each domain owns its routes, services, and queries:

```
apps/api/src/modules/
├── journeys/      # Journey CRUD, versioning
├── sessions/      # Session viewer, history
├── users/         # Channel users, activity
├── events/        # Event logs, streaming
├── simulator/     # Engine-backed testing
├── crm/           # Pipelines, clients, messaging
├── workflows/     # Workflow builder, approvals
├── ...
└── router.ts      # Central route composition
```

See `docs/dev/architecture/api-module-map.md` for the full module map and guidelines.

### Tech Stack

- **Hono** - HTTP framework
- **Better Auth** - auth + organizations
- **Drizzle ORM** - PostgreSQL access
- **@journey/engine** - journey execution
- **BullMQ** - timers, automations, approvals, retention
- **Redis** - pub/sub, queues, rate limits
- **MinIO/S3** - media storage
- **@journey/llm** - model registry + usage tracking
- **MCP service** - external tool discovery (`apps/mcp`)

### Request Pipeline (Simplified)

1. CORS + body limits + rate limits (`app.ts`)
2. Request logging + request IDs (`lib/request-logger.ts`)
3. Request tracing (AsyncLocalStorage correlation IDs)
4. Auth + org context (Better Auth or mock user header)
5. Route handler (Zod validation)
6. Service layer + DB/engine integrations
7. Event publishing (if applicable)
8. Error handler formats structured responses

---

## Route Structure

```
/health
/health/detailed
/api/auth/*
/api/me
/api/journeys
/api/channels
/api/uploads
/api
/api/users
/api/variables
/api/tags              # tag definitions
/api/user-tags         # user tag assignments
/api/events
/api/crm/*
/api/mindstates
/api/audio
/api/simulator
/api/models            # public
/api/agent-tools
/api/workflows
/api/workflows/approvals
/webhook/telegram/:channelId
```

See `docs/api/routes.md` for full endpoint details.

---

## Authentication

### Better Auth Integration

The API uses Better Auth with the organization plugin. Sessions are stored in cookies.

```typescript
import { auth } from "./lib/auth";

const session = await auth.api.getSession({
  headers: c.req.raw.headers,
});
```

### /api/me

`GET /api/me` returns the current user + organization from context.

- Returns `{ user: null, organization: null }` if unauthenticated.
- Useful for bootstrapping the frontend auth state.

### Mock Users (Dev/Test)

When `ALLOW_MOCK_AUTH=true`, the API accepts:

```
X-Mock-User-Id: user-demo
```

Mock auth disables HTTP rate limiting and is never enabled in production.

---

## Organization Context & RBAC

All protected routes use `createProtectedRouter()` which enforces:

- **Authentication** - `user` is present in context (401 if missing)
- **Organization** - `organization` is present in context (400 if missing)
- **RBAC permissions** - Role-based access control via Better Auth
- **Resource ownership** - Verified via `protect()` middleware

Handlers access `authUser` and `authOrg` from context (guaranteed non-null).

### Route Protection Pattern

```typescript
import { createProtectedRouter, protect } from "../lib/protected-router";

const router = createProtectedRouter({
  defaultPermission: { resource: "journey", action: "read" },
});

// Per-route ownership verification
router.delete(
  "/:id",
  protect({
    permission: { resource: "journey", action: "delete" },
    resource: { type: "journey", extractor: { param: "id" } },
  }),
  async (c) => {
    const journeyId = c.get("verifiedResourceId")!; // Verified ownership
    // ...
  }
);
```

### Roles & Permissions

| Role | Access |
|------|--------|
| `owner` | Full access to all resources |
| `admin` | Full access except org deletion |
| `member` | Read + limited create/execute |

See `apps/api/src/lib/permissions.ts` for the complete RBAC matrix.

---

## Request Limits

Body limits (enforced in `app.ts`):

- `/api/*` - 1MB
- `/api/uploads/*` - 300MB
- `/webhook/*` - 1MB

Rate limits (configurable via env):

- Global API (per user/IP)
- Auth endpoints (per IP)
- Webhooks (per channel)
- SSE connections (per user)
- Event publishing tokens (per org)

## Request IDs

Every response includes `X-Request-Id`. Clients can also send `X-Request-Id` to propagate their own request IDs through logs and events.

---

## Event System

The API uses a unified event bus to route events to multiple consumers.

### Event Flow

```
Domain Action
   │
   ▼
createEvent + publishEvent
   │
   ├─ log-consumer  → events table (all events) + interactions (session events)
   ├─ sse-consumer  → Redis pub/sub → /api/events/stream
   └─ automation-consumer → BullMQ queue → automation handler
```

### Event Storage

- **events** table: universal log, audit, replay, CRM activity
- **interactions** table: session-specific timeline used by the Events UI
- **llm_usage_events** table: token + cost analytics

### SSE Endpoint

```
GET /api/events/stream
```

Sends `connected`, `event`, and `heartbeat` SSE events. Heartbeat interval is 30s.

### Replay Endpoint

```
GET /api/events/replay
GET /api/events/replay/latest
```

Supports filtering by sequence, types (wildcards), session, journey, client, and time range.

---

## Automation + Timers

- **Timer queue** (`journey-timers`) fires wait nodes.
- **Automation queue** (`journey-events`) processes event-driven automations.
- **Approval timeout queue** (`workflow-approval-timeouts`) handles user_approval nodes.

---

## Data Retention

A BullMQ worker (`data-retention` queue) deletes old data based on env settings:

- `events`
- `interactions`
- `sent_messages`
- `agent_conversations`
- `llm_usage_events`

Set retention days via environment variables (`*_RETENTION_DAYS`). Use `0` for "keep forever".

---

## Operational Tooling

- **Bull Board** (dev only): `http://localhost:3001/admin/queues`
- **Health checks**: `/health` and `/health/detailed`

---

## Environment Variables (Key)

```env
# Server
NODE_ENV=development
PORT=3001

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/journey

# Auth
BETTER_AUTH_SECRET=your-secret-key
FRONTEND_URL=http://localhost:3000
ALLOW_MOCK_AUTH=false

# Redis / BullMQ
REDIS_URL=redis://localhost:6379

# Storage (MinIO/S3)
MINIO_ENDPOINT=http://localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=journey-media

# MCP Service
MCP_SERVICE_URL=http://localhost:3002
MCP_SERVICE_TIMEOUT=30000

# Optional URLs
API_URL=http://localhost:3001
WEBHOOK_BASE_URL=https://your-public-webhook-url

# LLM providers (used by @journey/llm)
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
GOOGLE_API_KEY=...
GEMINI_API_KEY=...

# Rate limits
RATE_LIMIT_GLOBAL=100
RATE_LIMIT_AUTH=10
RATE_LIMIT_WEBHOOK=200
RATE_LIMIT_EVENTS_MAX_TOKENS=1000
RATE_LIMIT_EVENTS_REFILL_RATE=1000
RATE_LIMIT_EVENTS_INTERVAL=60
RATE_LIMIT_SSE_MAX_CONNECTIONS=10

# Retention (days; 0 = forever)
EVENT_RETENTION_DAYS=90
INTERACTIONS_RETENTION_DAYS=0
SENT_MESSAGES_RETENTION_DAYS=0
AGENT_CONVERSATIONS_RETENTION_DAYS=0
LLM_USAGE_RETENTION_DAYS=365
```

---

## Testing

Run API tests:

```bash
pnpm --filter @journey/api test
```

---

## See Also

- `docs/api/routes.md` - Canonical endpoint reference
- `docs/api/events/events-system.md` - Event bus internals
- `docs/db/README.md` - Database schema overview
- `docs/logger/README.md` - Structured logging
