# Simulator Frontend Module

Frontend implementation for the backend-powered journey simulator.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Hooks Reference](#hooks-reference)
- [Store Structure](#store-structure)
- [Event Handling](#event-handling)
- [File Index](#file-index)

---

## Overview

The simulator frontend provides:

- **Backend Integration** - Remote control for backend SessionEngine via REST + SSE
- **Real-time Updates** - SSE event streaming with debug state enrichment
- **Playback Mode** - Session replay with timeline scrubbing
- **Path Visualization** - Visited nodes/edges highlighting on canvas
- **Personas** - Reusable test clients with reset/cleanup tools

### Key Principles

1. **Single Source of Truth** - All state lives in `simulator-store`
2. **Event-Driven** - UI reacts to SSE events, not REST responses
3. **Race Condition Safety** - Events buffered until sessionId is known
4. **Production Parity** - Same engine behavior as production

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           COMPONENTS                                     │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────────────────┐ │
│  │ SimulatorPanel │  │   ChatWindow   │  │   ConsolePanel (Debug)     │ │
│  └───────┬────────┘  └───────┬────────┘  └────────────┬───────────────┘ │
│          │                   │                        │                  │
│          └───────────────────┼────────────────────────┘                  │
│                              │                                           │
│                              ↓                                           │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                    useBackendSimulator                             │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────────┐│  │
│  │  │ Session     │  │ User        │  │ Event Processing            ││  │
│  │  │ Lifecycle   │  │ Actions     │  │ (Handler Map)               ││  │
│  │  └─────────────┘  └─────────────┘  └─────────────────────────────┘│  │
│  └───────────────────────────┬───────────────────────────────────────┘  │
│                              │                                           │
│          ┌───────────────────┼───────────────────┐                      │
│          ↓                   ↓                   ↓                      │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────────────────┐   │
│  │ simulatorApi  │  │ SSE Connection│  │ simulatorStore            │   │
│  │ (REST client) │  │ (useSSEConnection) │  │ (TanStack Store)      │   │
│  └───────┬───────┘  └───────┬───────┘  └───────────────────────────┘   │
│          │                  │                                           │
└──────────│──────────────────│───────────────────────────────────────────┘
           │                  │
           ↓                  ↓
    ┌──────────────────────────────────┐
    │          BACKEND API             │
    │   REST: /api/simulator/*         │
    │   SSE:  /api/events/stream       │
    └──────────────────────────────────┘
```

---

## Quick Start

### Basic Usage

```tsx
import { useBackendSimulator } from "@/features/journey/simulator/hooks";

function SimulatorPanel({ journeyId }: { journeyId: string }) {
  const {
    // State
    isActive,
    messages,
    activeTimer,
    debugState,
    chatState,
    selectedPersonaId,
    setSelectedPersonaId,

    // Lifecycle
    startSession,
    stopSession,

    // Actions
    sendMessage,
    handleButtonClick,
    skipTimer,
  } = useBackendSimulator({
    journeyId,
    onError: (err) => notify.error(err.message),
  });

  // Start session
  const handleStart = () => startSession(undefined, selectedPersonaId ?? undefined);

  // Send user message
  const handleSend = (text: string) => sendMessage(text);

  // Handle button click
  const handleButton = (id: string, label?: string) => handleButtonClick(id, label);

  return (
    <div>
      {isActive ? (
        <>
          <PersonaSelector value={selectedPersonaId} onChange={setSelectedPersonaId} />
          <ChatMessages messages={messages} />
          {activeTimer && <TimerDisplay timer={activeTimer} onSkip={skipTimer} />}
          <ChatInput onSend={handleSend} />
        </>
      ) : (
        <button onClick={handleStart}>Start Simulator</button>
      )}
    </div>
  );
}
```

### Accessing Debug State

```tsx
import { createLogger } from "@journey/logger";

const log = createLogger("simulator-debug");
const { debugState } = useBackendSimulator({ journeyId });

log.debug(
  {
    currentNodeId: debugState.currentNodeId,
    pendingTimers: debugState.pendingTimers,
    variables: debugState.variables,
    tags: debugState.tags,
  },
  "simulator:debugState"
);
```

### Path Visualization

```tsx
import { useSimulatorPath } from "@/features/journey/simulator/hooks";

function JourneyCanvas() {
  const { visitedNodes, visitedEdgeIds } = useSimulatorPath(edges);

  return (
    <ReactFlow
      nodes={nodes.map((n) => ({
        ...n,
        className: visitedNodes.has(n.id) ? "visited" : "",
      }))} 
      edges={edges.map((e) => ({
        ...e,
        className: visitedEdgeIds.has(e.id) ? "visited" : "",
      }))}
    />
  );
}
```

---

## Hooks Reference

### useBackendSimulator

Main integration hook providing full simulator API.

```typescript
function useBackendSimulator(options: { journeyId: string; onError?: (error: Error) => void }): {
  // State from store
  isActive: boolean;
  messages: Array<{ id: string; message: JourneyMessage; timestamp: Date; from: "bot" | "user" }>;
  activeTimer: { id: string; durationMs: number; startTime: number } | null;
  currentSession: EnhancedUserJourney | null;
  eventLog: InteractionEvent[];
  chatState: ChatState;
  pendingFollowUps: PendingFollowUp[];
  playback: PlaybackState;
  selectedPersonaId: string | null;
  setSelectedPersonaId: (personaId: string | null) => void;

  // Backend-specific state
  sessionId: string | null;
  isConnected: boolean;
  isLoading: boolean;
  debugState: SimulatorDebugState;
  pendingTimers: PendingTimerInfo[];

  // Lifecycle
  startSession: (startNodeId?: string, personaId?: string) => Promise<void>;
  stopSession: () => Promise<void>;

  // Actions
  sendMessage: (text: string) => Promise<void>;
  handleButtonClick: (buttonId: string, buttonText?: string) => Promise<void>;
  skipTimer: () => void;
  skipTimerByEdgeId: (edgeId: string) => Promise<void>;

  // Playback
  playbackNext: () => void;
  playbackPrevious: () => void;
  setPlaybackIndex: (index: number) => void;
  togglePlayback: () => void;
  setPlaybackSpeed: (speed: number) => void;
  stopPlayback: () => void;
};
```

### useSSEConnection

Low-level SSE connection management with reconnection logic.

```typescript
function useSSEConnection(options: {
  url: string;
  onEvent: (event: MessageEvent) => void;
  onError?: (error: Error) => void;
  config: {
    connectTimeoutMs: number;
    maxReconnectAttempts: number;
    initialReconnectDelayMs: number;
  };
  withCredentials?: boolean;
}): {
  status: "disconnected" | "connecting" | "connected" | "reconnecting";
  isConnected: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
};
```

### useSimulatorMode

Get current simulator mode with convenience booleans.

```typescript
function useSimulatorMode(): {
  mode: "inactive" | "simulator" | "playback";
  isInactive: boolean;
  isSimulatorMode: boolean;
  isPlaybackMode: boolean;
  isActive: boolean;
};
```

### useSimulatorPath

Compute visited nodes and edges from event log.

```typescript
function useSimulatorPath(edges: JourneyEdge[]): {
  visitedNodes: Map<string, number>;
  visitedEdgeIds: Set<string>;
  visitedNodeIds: string[];
  pathKey: string;
};
```

### usePlaybackTimer

Automatic playback progression when playing.

```typescript
function usePlaybackTimer(): void;
// Uses store state internally, auto-advances playbackIndex
```

### Persona Hooks

CRUD helpers for simulator personas (test clients).

```typescript
const { data: personas } = usePersonas();
const createPersona = useCreatePersona();
const resetPersona = useResetPersona();
const cleanupAll = useCleanupAllTestData();
```

---

## Store Structure

### State Shape

```typescript
interface SimulatorState {
  /** Current mode: inactive, simulator, or playback */
  mode: SimulatorMode;

  /** Active session data */
  session: EnhancedUserJourney | null;

  /** Selected persona ID for simulator sessions */
  selectedPersonaId: string | null;

  /** Chat messages for display */
  messages: Array<{
    id: string;
    message: JourneyMessage;
    timestamp: Date;
    from: "bot" | "user";
  }>;

  /** Currently active timer (for skip button) */
  activeTimer: {
    id: string;
    durationMs: number;
    startTime: number;
  } | null;

  /** Pending follow-up timers */
  pendingFollowUps: PendingFollowUp[];

  /** Full interaction event log (for debug console) */
  eventLog: InteractionEvent[];

  /** Chat state for UI feedback */
  chatState: ChatState;

  /** Playback mode state */
  playback: PlaybackState;
}

type ChatState =
  | "idle" // Not active
  | "waiting_for_user" // Bot sent message, waiting for response
  | "processing" // Engine working
  | "timer_active" // Timer running
  | "completed"; // Journey ended

type SimulatorMode = "inactive" | "simulator" | "playback";
```

### Actions

```typescript
const simulatorActions = {
  // Personas
  setSelectedPersonaId: (personaId: string | null) => void;

  // Session lifecycle
  startSession: (session: EnhancedUserJourney) => void;
  stopSession: () => void;
  updateSession: (session: EnhancedUserJourney) => void;

  // Messages
  addMessage: (message: JourneyMessage, from: "bot" | "user") => void;

  // Timers
  setActiveTimer: (timer: TimerInfo | null) => void;
  addPendingFollowUp: (followUp: PendingFollowUp) => void;
  removePendingFollowUp: (timerId: string) => void;
  clearFollowUpsForNode: (nodeId: string) => void;
  clearAllFollowUps: () => void;

  // Events
  addEvent: (event: InteractionEvent) => void;
  addEventImmediate: (event: InteractionEvent) => void;
  clearEventLog: () => void;
  updateCurrentNode: (nodeId: string) => void;
  setChatState: (chatState: ChatState) => void;

  // Playback
  startPlayback: (params: PlaybackParams) => void;
  setPlaybackIndex: (index: number) => void;
  playbackNext: () => void;
  playbackPrevious: () => void;
  togglePlayback: () => void;
  setPlaybackSpeed: (speed: number) => void;
  stopPlayback: () => void;
  setIsPlaying: (isPlaying: boolean) => void;

  // Utility
  reset: () => void;
  flushPendingEvents: () => void;
};
```

### Event Batching

Events are batched for performance:

```typescript
// Batched (default) - uses requestAnimationFrame
simulatorActions.addEvent(event);

// Immediate - bypasses batching for sync visibility
simulatorActions.addEventImmediate(event);

// Flush pending - for tests
simulatorActions.flushPendingEvents();
```

---

## Event Handling

### Handler Map Pattern

Events are routed via a small handler map for special cases, with a default
logger for the rest:

```typescript
const SPECIAL_HANDLERS: Record<string, EventHandler> = {
  [SimulatorEventType.TIMER_SCHEDULED]: (event) => {
    simulatorActions.setActiveTimer({
      id: event.payload.edgeId,
      durationMs: event.payload.durationMs,
      startTime: Date.now(),
    });
  },
  [SimulatorEventType.TIMER_FIRED]: () => {
    simulatorActions.setActiveTimer(null);
  },
  [SimulatorEventType.TIMER_CANCELLED]: () => {
    simulatorActions.setActiveTimer(null);
  },
  [SystemEventType.MESSAGE]: (event) => {
    simulatorActions.addEvent(toInteractionEvent(event));
    if (event.payload.content || event.payload.buttons || event.payload.media) {
      simulatorActions.addMessage(event.payload, "bot");
    }
  },
};

const LOGGABLE_EVENT_PREFIXES = [
  "engine.",
  "session.",
  "timer.",
  "journey.",
  "mindstate.",
  "user.",
];
```

### Adding New Event Types

```typescript
// 1. Add handler to map
EVENT_HANDLERS["my.custom.event"] = (event) => {
  // Handle the event
  simulatorActions.someAction(event.payload);
};

// 2. (Optional) Add type guard in event-validators.ts
export function isMyCustomPayload(payload: unknown): payload is MyCustomPayload {
  return typeof payload === "object" && payload !== null && "requiredField" in payload;
}
```

---

## File Index

### Hooks

| File                             | Purpose                       |
| -------------------------------- | ----------------------------- |
| `hooks/use-backend-simulator.ts` | Main integration hook         |
| `hooks/use-personas.ts`          | Persona CRUD + cleanup hooks  |
| `hooks/use-simulator-mode.ts`    | Mode state selector           |
| `hooks/use-simulator-path.ts`    | Path visualization            |
| `hooks/use-playback-timer.ts`    | Playback auto-advance         |
| `hooks/use-impersonation.ts`     | User impersonation for replay |
| `hooks/simulator-selectors.ts`   | Store selectors               |

Shared dependency: `shared/hooks/use-sse-connection.ts` (SSE lifecycle + reconnection).

### Library

| File                          | Purpose                      |
| ----------------------------- | ---------------------------- |
| `lib/simulator-api-client.ts` | REST API client              |
| `lib/event-batcher.ts`        | Batched event log updates    |
| `lib/event-validators.ts`     | Type guards for payloads     |
| `lib/event-utils.ts`          | Event ID generation, merging |
| `lib/session-replay.ts`       | Playback message conversion  |
| `lib/telegram-markdown.ts`    | Markdown rendering           |

### Types

| File                 | Purpose                            |
| -------------------- | ---------------------------------- |
| `types/event-types.ts` | Simulator/system event type constants |

### Store

| File                       | Purpose                        |
| -------------------------- | ------------------------------ |
| `store/simulator-store.ts` | TanStack Store state + actions |
| `store/index.ts`           | Re-exports                     |

### Components

| File                             | Purpose                            |
| -------------------------------- | ---------------------------------- |
| `components/chat/`               | Chat UI (messages, input, buttons) |
| `components/console/`            | Debug console (event log)          |
| `components/controls/`           | Playback controls                  |
| `components/chat/system-events/` | System event rendering             |

### Context

| File               | Purpose                    |
| ------------------ | -------------------------- |
| `context/index.ts` | Simulator context provider |

---

## Related Documentation

- [API Overview](/docs/api/simulator/README.md)
- [SSE Events](/docs/api/simulator/sse-events.md)
- [Error Codes](/docs/api/simulator/error-codes.md)
