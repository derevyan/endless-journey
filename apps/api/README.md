# Journey API

Hono-based REST API server for the Journey platform.

## What Lives Here

- HTTP app + auth middleware (`app.ts`)
- Route handlers for journeys, sessions, CRM, workflows, simulator, uploads, audio, events
- Event bus consumers (SSE, automation, log) and publishers
- Timer, automation, approval, and data-retention services
- Telegram + simulator adapters

## Documentation

- `docs/api/README.md` - API overview, auth, event system
- `docs/api/routes.md` - Canonical endpoint map
- `docs/dev/architecture/api-reference.md` - Dev-friendly API notes