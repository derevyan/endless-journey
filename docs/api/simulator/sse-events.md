# Simulator SSE Events

Complete catalog of SSE events used by the simulator.

## Table of Contents

- [Overview](#overview)
- [Event Structure](#event-structure)
- [Debug State](#debug-state)
- [Event Types](#event-types)
  - [Simulator Events](#simulator-events)
  - [System Events](#system-events)
  - [User Events](#user-events)
- [Event Flow Examples](#event-flow-examples)
- [Frontend Handling](#frontend-handling)

---

## Overview

The simulator uses Server-Sent Events (SSE) for real-time communication:

- **Endpoint**: `GET /api/events/stream`
- **Channel**: `events:{organizationId}` (Redis pub/sub)
- **Scope**: Organization-level (filter by `sessionId` client-side)

### Key Characteristics

| Aspect | Value |
|--------|-------|
| Transport | Redis pub/sub → SSE |
| Persistence | None (events not stored in Redis) |
| Reconnection | Client responsibility (use exponential backoff) |
| Message format | JSON with `_debug` enrichment |

---

## Event Structure

### Base Event Envelope

Every SSE event follows this structure:

```typescript
interface SimulatorSSEEvent {
  /** Event type (e.g., "system.message", "simulator.timer_scheduled") */
  type: string;

  /** Session ID this event belongs to */
  sessionId: string;

  /** ISO 8601 timestamp when event was created */
  timestamp: string;

  /** Event-specific payload */
  payload: Record<string, unknown>;

  /** Debug state enrichment (engine state snapshot) */
  _debug?: SimulatorDebugState;
}
```

### Example Raw SSE Message

```
data: {"type":"system.message","sessionId":"abc-123","timestamp":"2024-01-01T12:00:00.000Z","payload":{"content":"Hello!","buttons":[{"id":"btn-1","label":"Yes"}],"nodeId":"node-welcome"},"_debug":{"currentNodeId":"node-welcome","pendingTimers":[],"variables":{"user":{"name":"John"}},"tags":["new"]}}
```

---

## Debug State

Every simulator event is enriched with `_debug` containing engine state:

```typescript
interface SimulatorDebugState {
  /** Current node ID in the journey */
  currentNodeId?: string;

  /** Active timers with their scheduled fire times */
  pendingTimers?: Array<{
    edgeId: string;
    firesAt: string;  // ISO 8601
  }>;

  /** Journey context variables (all scopes merged) */
  variables?: Record<string, unknown>;

  /** Client tags */
  tags?: string[];
}
```

### Example Debug State

```json
{
  "_debug": {
    "currentNodeId": "node-question",
    "pendingTimers": [
      { "edgeId": "edge-timeout", "firesAt": "2024-01-01T12:05:00.000Z" }
    ],
    "variables": {
      "user": { "name": "John", "score": 42 },
      "journey": { "step": 3 }
    },
    "tags": ["vip", "active", "newsletter"]
  }
}
```

### Debug State Updates

The adapter updates debug state from:

1. **Session sync**: After engine operations (node transitions, variable changes)
2. **Timer operations**: Timer map reflects pending timers
3. **Tag callbacks**: Tags updated via engine callbacks

---

## Event Types

### Simulator Events

Timer lifecycle events specific to the simulator.

#### simulator.timer_scheduled

Emitted when a timer is created (wait node, follow-up step).

```typescript
{
  type: "simulator.timer_scheduled",
  sessionId: "abc-123",
  timestamp: "2024-01-01T12:00:00.000Z",
  payload: {
    timerId: "bullmq-job-id",     // BullMQ job ID
    edgeId: "edge-timeout",       // Edge that will fire
    durationMs: 300000,           // 5 minutes
    firesAt: "2024-01-01T12:05:00.000Z"  // Scheduled fire time
  },
  _debug: { ... }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `timerId` | string | BullMQ job ID for cancellation |
| `edgeId` | string | Edge ID used by skip timer endpoint |
| `durationMs` | number | Timer duration in milliseconds |
| `firesAt` | string | ISO 8601 scheduled fire time |

#### simulator.timer_fired

Emitted when a timer completes (or is skipped).

```typescript
{
  type: "simulator.timer_fired",
  sessionId: "abc-123",
  timestamp: "2024-01-01T12:05:00.000Z",
  payload: {
    edgeId: "edge-timeout",
    scheduledAt: "2024-01-01T12:00:00.000Z"
  },
  _debug: { ... }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `edgeId` | string | Edge that fired |
| `scheduledAt` | string | Original scheduling time |

#### simulator.timer_cancelled

Emitted when a timer is cancelled (user responded before timeout).

```typescript
{
  type: "simulator.timer_cancelled",
  sessionId: "abc-123",
  timestamp: "2024-01-01T12:02:00.000Z",
  payload: {
    timerId: "bullmq-job-id",
    edgeId: "edge-timeout"
  },
  _debug: { ... }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `timerId` | string | BullMQ job ID that was cancelled |
| `edgeId` | string | Edge that was cancelled |

---

### System Events

Engine-generated events for bot actions.

#### system.message

Bot message sent to user.

```typescript
{
  type: "system.message",
  sessionId: "abc-123",
  timestamp: "2024-01-01T12:00:00.000Z",
  payload: {
    content: "Welcome! How can I help you?",
    buttons: [
      { id: "btn-help", label: "Get Help" },
      { id: "btn-faq", label: "View FAQ" }
    ],
    media: {
      type: "image",
      url: "https://example.com/welcome.jpg"
    },
    nodeId: "node-welcome"
  },
  _debug: { ... }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `content` | string | Message text content |
| `buttons` | array | Optional inline keyboard buttons |
| `buttons[].id` | string | Button ID for click handling |
| `buttons[].label` | string | Button display text |
| `media` | object | Optional media attachment |
| `media.type` | string | `"image"`, `"video"`, `"document"` |
| `media.url` | string | Media URL |
| `nodeId` | string | Source node ID |

#### system.transition

Engine moved user between nodes.

```typescript
{
  type: "system.transition",
  sessionId: "abc-123",
  timestamp: "2024-01-01T12:00:01.000Z",
  payload: {
    from: "node-welcome",
    to: "node-question",
    trigger: "auto"  // or "button_click", "message", "timeout"
  },
  _debug: { ... }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `from` | string | Source node ID |
| `to` | string | Destination node ID |
| `trigger` | string | What caused the transition |

**Trigger Values:**
- `auto` - Automatic transition (no user input required)
- `button_click` - User clicked a button
- `message` - User sent a text message
- `timeout` - Timer expired

#### system.timeout

Wait node timer expired.

```typescript
{
  type: "system.timeout",
  sessionId: "abc-123",
  timestamp: "2024-01-01T12:05:00.000Z",
  payload: {
    edgeId: "edge-timeout",
    nodeId: "node-wait"
  },
  _debug: { ... }
}
```

#### system.variables

Variables were modified during journey execution.

```typescript
{
  type: "system.variables",
  sessionId: "abc-123",
  timestamp: "2024-01-01T12:00:02.000Z",
  payload: {
    operations: [
      { op: "set", key: "score", scope: "user", value: 42 },
      { op: "increment", key: "visits", scope: "journey" }
    ],
    userOperationCount: 1,
    journeyOperationCount: 1,
    globalOperationCount: 0
  },
  _debug: { ... }
}
```

#### system.tags

Tags were modified during journey execution.

```typescript
{
  type: "system.tags",
  sessionId: "abc-123",
  timestamp: "2024-01-01T12:00:03.000Z",
  payload: {
    added: ["vip", "premium"],
    removed: ["trial"],
    nodeId: "node-upgrade"
  },
  _debug: { ... }
}
```

#### system.error

Error occurred during execution.

```typescript
{
  type: "system.error",
  sessionId: "abc-123",
  timestamp: "2024-01-01T12:00:04.000Z",
  payload: {
    message: "Failed to execute action",
    nodeId: "node-action",
    code: "ACTION_FAILED"
  },
  _debug: { ... }
}
```

---

### User Events

User actions captured by the engine.

#### user.message

User sent a text message.

```typescript
{
  type: "user.message",
  sessionId: "abc-123",
  timestamp: "2024-01-01T12:01:00.000Z",
  payload: {
    text: "I need help with my order",
    nodeId: "node-question"
  },
  _debug: { ... }
}
```

#### user.click

User clicked an inline button.

```typescript
{
  type: "user.click",
  sessionId: "abc-123",
  timestamp: "2024-01-01T12:01:30.000Z",
  payload: {
    buttonId: "btn-help",
    buttonLabel: "Get Help",
    nodeId: "node-welcome"
  },
  _debug: { ... }
}
```

---

## Event Flow Examples

### Session Start Flow

```
1. POST /api/simulator/sessions
   ↓
2. Engine calls start() → processes start node
   ↓
3. SSE: system.transition { from: "start", to: "node-welcome" }
   ↓
4. SSE: system.message { content: "Welcome!", buttons: [...] }
```

### User Input Flow

```
1. POST /api/simulator/execute { type: "text", text: "Hello" }
   ↓
2. SSE: user.message { text: "Hello" }
   ↓
3. Engine processes input → matches edge → transitions
   ↓
4. SSE: system.transition { from: "node-a", to: "node-b" }
   ↓
5. SSE: system.message { content: "Got it!" }
```

### Timer Flow (Natural)

```
1. Engine creates wait node timer
   ↓
2. SSE: simulator.timer_scheduled { edgeId: "edge-timeout", durationMs: 60000 }
   ↓
3. [60 seconds pass...]
   ↓
4. BullMQ fires timer → handleTimerFired()
   ↓
5. SSE: simulator.timer_fired { edgeId: "edge-timeout" }
   ↓
6. SSE: system.transition { trigger: "timeout" }
```

### Timer Flow (Skipped)

```
1. SSE: simulator.timer_scheduled { edgeId: "edge-timeout" }
   ↓
2. POST /api/simulator/timers/edge-timeout/skip
   ↓
3. BullMQ job cancelled
   ↓
4. SSE: simulator.timer_fired { edgeId: "edge-timeout" }
   ↓
5. SSE: system.transition { trigger: "timeout" }
```

### Timer Flow (Cancelled by User)

```
1. SSE: simulator.timer_scheduled { edgeId: "edge-timeout" }
   ↓
2. User clicks button before timeout
   ↓
3. SSE: user.click { buttonId: "btn-answer" }
   ↓
4. Engine cancels timer
   ↓
5. SSE: simulator.timer_cancelled { edgeId: "edge-timeout" }
   ↓
6. SSE: system.transition { trigger: "button_click" }
```

---

## Frontend Handling

### Event Handler Map Pattern

The frontend uses a handler map for O(1) event routing:

```typescript
const EVENT_HANDLERS: Record<string, (event: SimulatorEvent) => void> = {
  "simulator.timer_scheduled": (event) => {
    simulatorActions.setActiveTimer({
      id: event.payload.edgeId,
      durationMs: event.payload.durationMs,
      startTime: Date.now(),
    });
  },

  "simulator.timer_fired": () => {
    simulatorActions.setActiveTimer(null);
  },

  "system.message": (event) => {
    // Add to chat messages
    simulatorActions.addMessage(event.payload, "bot");
    // Add to event log
    simulatorActions.addEvent(event);
  },

  // ... more handlers
};

// Usage
const handler = EVENT_HANDLERS[event.type];
if (handler) {
  handler(event);
}
```

### Session Filtering

SSE is org-level, so filter by sessionId:

```typescript
sse.onmessage = (event) => {
  const data = JSON.parse(event.data);

  // Only process events for our session
  if (data.sessionId !== currentSessionId) {
    return;
  }

  // Update debug state from every event
  if (data._debug) {
    setDebugState(data._debug);
  }

  // Route to handler
  const handler = EVENT_HANDLERS[data.type];
  handler?.(data);
};
```

### Event Buffering (Race Condition)

Events may arrive before sessionId is known:

```typescript
const pendingEvents: SimulatorEvent[] = [];

function handleEvent(event: SimulatorEvent) {
  // Buffer if no sessionId yet
  if (!sessionId) {
    pendingEvents.push(event);
    return;
  }

  // Process if matches our session
  if (event.sessionId === sessionId) {
    processEvent(event);
  }
}

// After session is created:
function onSessionCreated(newSessionId: string) {
  sessionId = newSessionId;

  // Process buffered events
  pendingEvents
    .filter(e => e.sessionId === newSessionId)
    .forEach(processEvent);

  pendingEvents.length = 0;
}
```

---

## Source Files

| File | Purpose |
|------|---------|
| `packages/schemas/src/simulator.ts` | Event type definitions |
| `apps/api/src/adapters/simulator.ts` | Event publishing |
| `apps/web/src/features/journey/simulator/hooks/use-backend-simulator.ts` | Event handling |
| `apps/web/src/features/journey/simulator/lib/event-validators.ts` | Payload type guards |
