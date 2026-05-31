# Simulator API

Backend-powered simulator for testing journeys with **100% production parity**. The simulator runs a real `SessionEngine` on the server with actual database callbacks and BullMQ timers, while the frontend acts as a remote control via REST API and SSE.

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Key Concepts](#key-concepts)
- [Connection Flow](#connection-flow)
- [Endpoints](#endpoints)
- [Related Documentation](#related-documentation)

---

## Overview

The simulator provides:

- **Production Parity** - Same engine, same database, same BullMQ timers as production
- **Debug Superpowers** - `_debug` state enrichment on every SSE event
- **Session Persistence** - Survives page refresh (sessions persist in PostgreSQL)
- **Time Travel** - Skip timers to test timeout flows without waiting
- **Personas** - Reusable test profiles with stored variables + tags
- **Bulk Cleanup** - Remove test data in one call

### Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND                                        │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  useBackendSimulator                                                    │ │
│  │    ├── Session lifecycle (start/stop)                                  │ │
│  │    ├── User actions (sendMessage, handleButtonClick)                   │ │
│  │    ├── Timer actions (skipTimer)                                       │ │
│  │    └── SSE event handling                                              │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                          ↑ SSE                    │ REST                     │
└──────────────────────────│────────────────────────│─────────────────────────┘
                           │                        ↓
┌──────────────────────────│────────────────────────────────────────────────────┐
│                          │           BACKEND                                  │
│  ┌───────────────────────│──────────────────────────────────────────────────┐ │
│  │  /api/events/stream   │      /api/simulator/*                            │ │
│  │  (SSE endpoint)       │      (REST endpoints)                            │ │
│  │         ↑             │             │                                    │ │
│  │         │             │             ↓                                    │ │
│  │    Redis Pub/Sub ←────│────── SimulatorAdapter ←── SessionEngine         │ │
│  │                       │             │                                    │ │
│  │                       │             ↓                                    │ │
│  │                       │        PostgreSQL + BullMQ                       │ │
│  └───────────────────────│──────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Quick Start

### 1. Start a Session

```bash
POST /api/simulator/sessions
Content-Type: application/json
Authorization: Bearer <token>

{
  "journeyId": "journey-uuid",
  "startNodeId": "optional-node-id",
  "personaId": "optional-persona-id",
  "clientProfile": {
    "firstName": "Simulator",
    "lastName": "User"
  }
}
```

### 2. Connect to SSE Stream

```typescript
const eventSource = new EventSource('/api/events/stream');
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // Filter by sessionId (SSE is org-level, not session-level)
  if (data.sessionId === mySessionId) {
    console.log('Event:', data.type, data.payload);
    console.log('Debug:', data._debug);
  }
};
```

### 3. Send User Input

```bash
POST /api/simulator/execute
Content-Type: application/json

{
  "sessionId": "session-uuid",
  "event": {
    "type": "text",
    "text": "Hello!"
  }
}
```

### 4. Skip a Timer (Time Travel)

```bash
POST /api/simulator/timers/edge-123/skip
Content-Type: application/json

{
  "sessionId": "session-uuid"
}
```

### 5. Cleanup Session

```bash
DELETE /api/simulator/sessions/session-uuid
```

---

## Key Concepts

### Session-Scoped Engine

Each simulator session runs an independent `SessionEngine` instance:

- **Test Client**: Created with `platform='simulator'`, `is_test=true`
- **Session Mode**: `mode='simulation'` distinguishes from production sessions
- **Real Infrastructure**: Uses actual PostgreSQL and BullMQ (not mocked)

### Personas

Personas are reusable test profiles tied to an organization:

- **personaId** in session creation reuses a consistent client
- **reset** endpoint clears persona-specific data
- **list/create/update/delete** endpoints support test fixture workflows

### SSE is Org-Level

The SSE stream (`/api/events/stream`) publishes to `events:{organizationId}`:

- All sessions in an organization share one SSE channel
- **Client-side filtering** by `sessionId` is required
- Connect SSE **before** creating session to avoid race conditions

### Debug State Enrichment

Every SSE event includes `_debug` field with engine state:

```typescript
{
  type: "system.message",
  sessionId: "...",
  timestamp: "2024-01-01T00:00:00.000Z",
  payload: { content: "Hello!", buttons: [...] },
  _debug: {
    currentNodeId: "node-123",
    pendingTimers: [{ edgeId: "edge-456", firesAt: "..." }],
    variables: { user: { name: "John" } },
    tags: ["vip", "active"]
  }
}
```

### Session Timeout

Sessions expire after **30 minutes** of inactivity:

- Timer resets on every API call (execute, skip timer)
- Expired sessions return 404 from all endpoints
- Session data remains in PostgreSQL for replay/debugging

---

## Connection Flow

Critical order of operations to avoid race conditions:

```
1. Connect SSE (org-level, doesn't need sessionId)
   └── Subscribe to events:{organizationId}

2. Create session (triggers engine.start())
   └── Backend publishes initial bot messages to Redis

3. Set sessionId (filter SSE events)
   └── Frontend now knows which events to process

4. Process buffered events
   └── Events that arrived before sessionId was set
```

**Why this order matters**: If session is created before SSE connects, initial messages are lost (Redis pub/sub has no persistence).

---

## Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/simulator/sessions` | Start a new simulation |
| POST | `/api/simulator/execute` | Send input to engine |
| GET | `/api/simulator/sessions/:id/timers` | List active timers |
| POST | `/api/simulator/timers/:edgeId/skip` | Skip a timer (time travel) |
| DELETE | `/api/simulator/sessions/:id` | Cleanup session |
| GET | `/api/simulator/personas` | List personas |
| POST | `/api/simulator/personas` | Create persona |
| GET | `/api/simulator/personas/:id` | Get persona |
| PUT | `/api/simulator/personas/:id` | Update persona |
| DELETE | `/api/simulator/personas/:id` | Delete persona |
| POST | `/api/simulator/personas/:id/reset` | Reset persona data |
| POST | `/api/simulator/cleanup` | Bulk cleanup test data |
| GET | `/api/simulator/health` | Health check |

---

## Related Documentation

- [API Reference](./api-reference.md) - Full endpoint specifications
- [SSE Events](./sse-events.md) - Event types and payloads
- [Error Codes](./error-codes.md) - Error handling guide
- [Events System](../events/events-system.md) - General event architecture

---

## Source Files

| File | Purpose |
|------|---------|
| `apps/api/src/modules/simulator/routes/index.ts` | REST API routes |
| `apps/api/src/modules/simulator/services/session-manager.ts` | Session lifecycle management |
| `apps/api/src/modules/simulator/services/persona-service.ts` | Persona CRUD |
| `apps/api/src/modules/simulator/services/cleanup-service.ts` | Bulk cleanup + resets |
| `apps/api/src/adapters/simulator.ts` | SSE event publishing |
| `packages/schemas/src/simulator.ts` | Event types and constants |
