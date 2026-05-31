# Event Pipeline Architecture

This document describes the event system in `apps/api` and how events are stored, streamed, and replayed.

## Overview

The API uses three event data stores with distinct purposes:

| System | Table | Purpose | Primary Endpoint |
| --- | --- | --- | --- |
| **Interactions** | `interactions` | Session-level timeline for the Events UI | `/api/events` |
| **Events** | `events` | Universal audit log + replay | `/api/events/replay` |
| **LLM Usage** | `llm_usage_events` | Token/cost tracking for LLM calls | `/api/events/llm` |

CRM activity is derived from the **events** table (`/api/events/crm`).

---

## Event Bus

**Location:** `apps/api/src/event-bus/event-bus.ts`

The event bus validates event payloads (via `@journey/schemas` registry), rate-limits per org, and routes events to registered consumers.

### Consumers

| Consumer | Purpose | Implementation |
| --- | --- | --- |
| `log` | Persist events | `event-bus/consumers/log-consumer.ts` |
| `sse` | Real-time streaming | `event-bus/consumers/sse-consumer.ts` |
| `automation` | Trigger automations | `event-bus/consumers/automation-consumer.ts` |

### Log Consumer Behavior

1. **All events → `events` table**
2. **Session events (with `sessionId`) → `interactions` table**

This keeps replay/audit separate from UI interaction timelines while preserving a complete history.

---

## Event Publishing

Most modules publish through domain-specific publishers:

```
import { publishers } from "../../event-bus/publishers";

await publishers.tag.assigned(ctx, { tagId, tagName });
```

For custom events, you can call `createEvent()` + `publishEvent()`.

---

## SSE Streaming

**Endpoint:** `GET /api/events/stream`

Flow:

```
Event Bus
  └─ sse-consumer → Redis pub/sub (events:{orgId}) → SSE stream
```

SSE events include `connected`, `event`, and `heartbeat` messages. The server sends a heartbeat every 30 seconds.

---

## Replay API

**Endpoints:**

- `GET /api/events/replay`
- `GET /api/events/replay/latest`

Supports filtering by:

- `sinceSequence`
- `types` (supports wildcards like `crm.*`)
- `sessionId`, `journeyId`, `clientId`
- `startDate`, `endDate`

---

## CRM Activity

CRM events are stored in the `events` table with CRM-specific types (e.g. `crm.stage.changed`).

The API derives activity summaries via:

- `GET /api/events/crm`
- `apps/api/src/modules/crm/description-generator.ts`

---

## LLM Usage Events

LLM calls are tracked in `llm_usage_events` for cost + token analytics.

Endpoints:

- `GET /api/events/llm`
- `GET /api/events/llm/stats`

---

## Tracing + Ordering

- **Correlation ID**: propagated via AsyncLocalStorage (`event-tracing.ts`).
- **Causality**: `causedBy` links related events.
- **Sequence**: per-org sequence generated via Redis INCR (fallback: timestamp).

These fields enable deterministic replay and debugging across API instances.

---

## Unknown Event Type Policy

The event bus uses a **warn and continue** policy for unknown event types:

1. When an event with an unregistered type is published, the bus logs a warning
2. The event is still routed to any consumers registered for that type
3. No error is thrown - this provides forward compatibility for new event types

```typescript
// event-bus.ts behavior
const registration = getEventRegistration(event.type);
if (!registration) {
  log.warn({ type: event.type }, "eventBus:unknownEventType");
  // Continue processing - route to empty consumer list
}
```

**Rationale**: This allows new event types to be added without requiring immediate consumer registration. Events may initially go unprocessed, but they won't cause runtime errors.

**Tradeoff**: New event types can silently drop if consumers aren't registered. Teams should ensure the `EVENT_REGISTRY` in `@journey/schemas` is updated when adding new event types.

---

## Configuration

Key env vars (see `apps/api/src/config/app-config.ts`):

```
RATE_LIMIT_EVENTS_MAX_TOKENS
RATE_LIMIT_EVENTS_REFILL_RATE
RATE_LIMIT_EVENTS_INTERVAL
RATE_LIMIT_SSE_MAX_CONNECTIONS
```

---

## Related Files

### Event Bus Infrastructure
- `apps/api/src/event-bus/event-bus.ts`
- `apps/api/src/event-bus/consumers/*`
- `apps/api/src/event-bus/publishers/*`

### Event API (Query & Streaming)
- `apps/api/src/modules/event-api/routes/index.ts`
- `apps/api/src/modules/event-api/routes/replay.ts`
- `apps/api/src/modules/event-api/services/event-service.ts`

### Schemas
- `packages/schemas/src/events/*`
