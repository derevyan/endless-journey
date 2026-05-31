# API Reference (Developer Notes)

> Quick developer-oriented notes for `apps/api`. For the full endpoint map, see `docs/api/routes.md`.

## Base URLs

- API: `http://localhost:3001/api`
- Health: `http://localhost:3001/health`
- Webhook: `http://localhost:3001/webhook/*`

## Authentication & RBAC

- Uses Better Auth with organization plugin.
- Auth middleware sets `user` and `organization` on context for all `/api/*` routes.
- Protected routes use `createProtectedRouter()` which enforces:
  - `user` in context (401 if missing)
  - active `organization` in context (400 if missing)
  - RBAC permission checks (403 if denied)
  - Resource ownership via `protect()` middleware
- Handlers access `authUser` + `authOrg` from context (guaranteed non-null).
- `/api/me` returns `{ user, organization }` (or nulls when unauthenticated).

### Key Files

| File | Purpose |
|------|---------|
| `lib/protected-router.ts` | Router factory with RBAC + ownership |
| `lib/permissions.ts` | RBAC permission matrix |
| `lib/org-guards.ts` | Resource ownership verification |
| `lib/auth-audit.ts` | Security event logging |

### Mock Auth (Dev/Test)

When `ALLOW_MOCK_AUTH=true`, pass:

```
X-Mock-User-Id: user-demo
```

Mock auth disables HTTP rate limiting for local/test flows.

## Common Endpoints

| Purpose | Endpoint |
| --- | --- |
| Auth | `/api/auth/*` |
| Current user | `/api/me` |
| Journeys | `/api/journeys` |
| Sessions | `/api/journeys/:journeyId/sessions` |
| Events (SSE) | `/api/events/stream` |
| Simulator | `/api/simulator/sessions` |
| Workflows | `/api/workflows` |
| Channels | `/api/channels` |
| Uploads | `/api/uploads` |
| Agent tools | `/api/agent-tools` |
| Models (public) | `/api/models` |

## Event System Quick Notes

- Publish events via `apps/api/src/events` (publishers or `publishEvent`).
- Consumers:
  - `log-consumer` → `events` table + `interactions`
  - `sse-consumer` → Redis pub/sub → `/api/events/stream`
  - `automation-consumer` → BullMQ queue → automation handler

## Error Responses

All errors use the shared format in `apps/api/src/lib/errors.ts`:

```json
{
  "error": "Human-readable message",
  "code": "ERROR_CODE",
  "requestId": "trace-id",
  "details": {}
}
```

## Tracing

- Request tracing is initialized in `apps/api/src/lib/event-tracing.ts`.
- Pass `X-Correlation-Id` to connect events across services.
- `X-Request-Id` is generated or forwarded per request and returned on responses.

## Dev Debugging

- `/health/detailed` returns dependency status
- `/api/events/health` returns event system health
- Bull Board (dev only): `http://localhost:3001/admin/queues`

## Related Docs

- `docs/api/routes.md` - canonical endpoint list
- `docs/api/README.md` - API overview
- `docs/dev/architecture/event-pipeline.md` - event pipeline internals
