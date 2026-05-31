# Event Bridge

> Bridges backend SSE events to the frontend store event bus for real-time synchronization.

## Overview

The Event Bridge connects Server-Sent Events (SSE) from the backend to the frontend's store event bus. This enables real-time updates across the application when events occur on the server.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           EVENT FLOW                                         │
│                                                                              │
│   Backend                    Event Bridge                 Frontend Stores    │
│                                                                              │
│   ┌──────────┐    SSE     ┌─────────────┐   Store Bus   ┌──────────────┐   │
│   │ API      │ ────────► │EventDispatcher│ ──────────► │ journey-nodes │   │
│   │ Events   │            │             │               │    store      │   │
│   └──────────┘            │             │               └──────────────┘   │
│                           │ EventBridge │                                   │
│   ┌──────────┐            │             │               ┌──────────────┐   │
│   │ Session  │ ────────► │ Transform   │ ──────────► │  ui-store     │   │
│   │ Events   │            │             │               │              │   │
│   └──────────┘            └─────────────┘               └──────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Architecture

### Components

| Component       | Location                                       | Purpose                                   |
| --------------- | ---------------------------------------------- | ----------------------------------------- |
| EventDispatcher | `apps/web/src/shared/lib/events/dispatcher.ts` | Receives and routes SSE events            |
| EventBridge     | `apps/web/src/stores/event-bridge.ts`          | Transforms backend events to store events |
| StoreEventBus   | `apps/web/src/stores/store-event-bus.ts`       | Distributes events to stores              |

### Event Transformation

The bridge transforms backend event types to frontend store events:

| Backend Event     | Store Event            | Description            |
| ----------------- | ---------------------- | ---------------------- |
| `session.started` | `sync:session.started` | New session began      |
| `session.event`   | `sync:session.event`   | Session event occurred |
| `journey.created` | `sync:journey.saved`   | Journey was created    |
| `journey.updated` | `sync:journey.saved`   | Journey was saved      |
| `node.created`    | `node:added`           | Node added to canvas   |
| `node.updated`    | `node:updated`         | Node data changed      |
| `node.deleted`    | `node:deleted`         | Node removed           |
| `edge.created`    | `edge:added`           | Edge created           |
| `edge.deleted`    | `edge:deleted`         | Edge removed           |

---

## Usage

### Starting the Bridge

```typescript
import { eventBridge } from "@/stores/event-bridge";

// Start with default options
eventBridge.start();

// Start with debug logging
eventBridge.start({ debug: true });

// Start with event filtering
eventBridge.start({
  filter: (event) => event.type.startsWith("session."),
});
```

### Stopping the Bridge

```typescript
eventBridge.stop();
```

### Using the React Hook

```tsx
import { useEventBridge } from "@/stores/event-bridge";

function App() {
  // Automatically starts on mount, stops on unmount
  useEventBridge({ debug: process.env.NODE_ENV === "development" });

  return <AppContent />;
}
```

### Checking Metrics

```typescript
const metrics = eventBridge.getMetrics();
console.log(metrics);
// {
//   eventsReceived: 42,
//   eventsBridged: 38,
//   eventsFiltered: 3,
//   transformErrors: 1,
// }

// Reset metrics
eventBridge.resetMetrics();
```

---

## Store Event Types

All store events are defined in `@journey/schemas`:

### Sync Events

```typescript
// Session started
type SyncSessionStartedEvent = {
  type: "sync:session.started";
  payload: { sessionId: string; journeyId: string };
};

// Session event occurred
type SyncSessionEventEvent = {
  type: "sync:session.event";
  payload: { sessionId: string; eventType: string; data: unknown };
};

// Journey saved (by another user)
type SyncJourneySavedEvent = {
  type: "sync:journey.saved";
  payload: { journeyId: string; savedBy: string; timestamp: string };
};
```

### Canvas Events

```typescript
// Node added
type NodeAddedEvent = {
  type: "node:added";
  payload: { nodeId: string; nodeType: string; position?: XYPosition };
};

// Node updated
type NodeUpdatedEvent = {
  type: "node:updated";
  payload: { nodeId: string; updates: Record<string, unknown> };
};

// Node deleted
type NodeDeletedEvent = {
  type: "node:deleted";
  payload: { nodeId: string };
};

// Edge added
type EdgeAddedEvent = {
  type: "edge:added";
  payload: { edgeId: string; source: string; target: string };
};

// Edge deleted
type EdgeDeletedEvent = {
  type: "edge:deleted";
  payload: { edgeId: string };
};
```

---

## Subscribing to Events

Stores or components can subscribe to bridged events:

```typescript
import { storeEventBus } from "@/stores/store-event-bus";

// Subscribe to session started
const unsubscribe = storeEventBus.on("sync:session.started", (event) => {
  console.log(`Session ${event.payload.sessionId} started`);
});

// Subscribe to journey saved by others
storeEventBus.on("sync:journey.saved", (event) => {
  if (event.payload.savedBy !== currentUserId) {
    notify.info("Journey updated by another user");
    invalidateJourneyQuery();
  }
});

// Cleanup
unsubscribe();
```

---

## Configuration

### EventBridgeConfig

```typescript
interface EventBridgeConfig {
  /** Enable debug logging */
  debug?: boolean;

  /** Filter events before bridging */
  filter?: (event: FrontendEvent) => boolean;
}
```

### Filtering Examples

```typescript
// Only bridge session events
eventBridge.start({
  filter: (event) => event.type.startsWith("session."),
});

// Exclude certain event types
eventBridge.start({
  filter: (event) => !["node.updated"].includes(event.type),
});

// Filter by journey ID
const currentJourneyId = "journey-123";
eventBridge.start({
  filter: (event) => event.journeyId === currentJourneyId,
});
```

---

## Metrics

The bridge tracks operational metrics:

```typescript
interface EventBridgeMetrics {
  /** Total events received from dispatcher */
  eventsReceived: number;

  /** Events successfully bridged to store bus */
  eventsBridged: number;

  /** Events filtered out by filter function */
  eventsFiltered: number;

  /** Events that failed transformation */
  transformErrors: number;
}
```

---

## Implementation Details

### Transform Function

```typescript
function transformToStoreEvent(event: FrontendEvent): StoreEvent | null {
  switch (event.type) {
    case "session.started":
      return {
        type: "sync:session.started",
        payload: {
          sessionId: event.sessionId ?? "",
          journeyId: event.journeyId ?? "",
        },
      };

    case "journey.updated":
      return {
        type: "sync:journey.saved",
        payload: {
          journeyId: event.journeyId ?? "",
          savedBy: event.performedBy ?? "unknown",
          timestamp: event.timestamp,
        },
      };

    // ... more transformations

    default:
      return null; // Unknown events are not bridged
  }
}
```

### Error Handling

Transformation errors are caught and logged:

```typescript
try {
  const storeEvent = transformToStoreEvent(event);
  if (storeEvent) {
    storeEventBus.emit(storeEvent);
    metrics.eventsBridged++;
  }
} catch (error) {
  metrics.transformErrors++;
  log.error({ eventType: event.type, error }, "eventBridge:transformError");
}
```

---

## Testing

The event bridge has comprehensive tests:

```typescript
// apps/web/src/stores/__tests__/event-bridge.test.ts

describe("EventBridge", () => {
  it("should transform session.started to sync:session.started", () => {
    const storeListener = vi.fn();
    storeEventBus.on("sync:session.started", storeListener);

    eventBridge.start();
    mockHandler?.(
      createMockEvent("session.started", {
        sessionId: "sess-123",
        journeyId: "journey-456",
      })
    );

    expect(storeListener).toHaveBeenCalledWith({
      type: "sync:session.started",
      payload: { sessionId: "sess-123", journeyId: "journey-456" },
    });
  });
});
```

---

## Use Cases

### Real-Time Collaboration

When another user edits a journey:

```typescript
storeEventBus.on("sync:journey.saved", (event) => {
  if (event.payload.journeyId === currentJourneyId) {
    showConflictDialog({
      message: `${event.payload.savedBy} saved changes`,
      onReload: () => refetchJourney(),
      onIgnore: () => markAsStale(),
    });
  }
});
```

### Session Monitoring

Track active sessions in simulator:

```typescript
storeEventBus.on("sync:session.started", (event) => {
  addActiveSession(event.payload.sessionId);
});

storeEventBus.on("sync:session.event", (event) => {
  if (event.payload.eventType === "session.ended") {
    removeActiveSession(event.payload.sessionId);
  }
});
```

---

## See Also

- [Store Event Bus](../../guides/store-event-bus.md) - Event bus documentation
- [SSE Events](../../../api/simulator/sse-events.md) - Backend SSE documentation
- [SharedServiceContext](./README.md) - Architecture overview
