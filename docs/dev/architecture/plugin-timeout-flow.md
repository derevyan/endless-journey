# Plugin Timeout Flow

> How plugin timers fire and get processed through the engine.

---

## Overview

Plugin timeouts (specifically follow-up plugins) use the same BullMQ timer infrastructure as edge timers, but have a distinct processing path.

## Flow Diagram

```
Timer fires (BullMQ worker)
  │
  ▼
┌─────────────────────────────────────────┐
│ timer-handler.ts                         │
│ handleTimerCallback(data)                │
│   - Check if plugin timer (has pluginId) │
│   - Get cached session state             │
│   - Clear session engine cache           │
│   - Load session from DB                 │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│ Adapter.onTimeout(sessionId, edgeId)     │
│   - Load session from DB                 │
│   - Create engine with cached state      │
│   - Call engine.injectEvent()            │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│ SessionEngine.injectEvent()              │
│   - Push { type: "timeout" } to queue    │
│   - Process queued events                │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│ EventQueue.push()                        │
│   - Add event to internal queue          │
│   - Dequeue and process                  │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│ EventRouter.handle()                     │
│   - Route based on event.type            │
│   - For plugin timeout: onPluginTimeout  │
│   - For edge timeout: delegateToHandler  │
└────────────────┬────────────────────────┘
                 │
      ┌──────────┴──────────┐
      │                     │
 Plugin Timer          Edge Timer
      │                     │
      ▼                     ▼
┌─────────────────┐  ┌─────────────────┐
│ onPluginTimeout │  │ delegateToHndlr │
│ callback        │  │ (transition)    │
└────────┬────────┘  └────────┬────────┘
         │                    │
         ▼                    ▼
┌─────────────────────────────────────────┐
│ FollowUpPluginHandler.onTimeout()        │
│   - Get plugin follow-up context         │
│   - Execute next step in sequence        │
│   - Options:                             │
│     1. Send message + schedule next      │
│     2. Transition to exit edge           │
│     3. Complete sequence                 │
└─────────────────────────────────────────┘
```

## Key Components

### 1. Timer Handler (`timer-handler.ts`)

Entry point when a BullMQ job fires. Determines if it's a plugin timer or edge timer.

```typescript
// Check for plugin timer
const isPluginTimer = timerContext !== undefined; // Has pluginFollowUp context

if (isPluginTimer) {
  // Route to plugin handler
} else {
  // Route to edge transition
}
```

### 2. Event Router (`event-router.ts`)

Routes timeout events based on context:

```typescript
case "timeout":
  // Plugin timeout has pluginId in event metadata
  if (event.metadata?.pluginId) {
    await onPluginTimeout(event);
  } else {
    await delegateToHandler(event);
  }
```

### 3. Follow-Up Plugin Handler (`follow-up-plugin-handler.ts`)

Handles plugin timeout execution:

```typescript
async onTimeout(timerId: string, context: PluginExecutionContext) {
  // 1. Get follow-up context from timer service
  const followUpContext = context.pluginService.getPluginFollowUpContext(timerId);

  // 2. Get current step from sequence
  const step = followUpContext.sequence[followUpContext.stepIndex];

  // 3. Execute step action
  if (step.message) {
    await sendMessage(step.message);
  }

  // 4. Schedule next step or transition
  if (hasNextStep) {
    await scheduleNextStep();
  } else if (step.exitEdge) {
    return { action: "transition", targetNodeId: exitNode };
  }
}
```

## Timer Data Structures

### Edge Timer Data

```typescript
interface TimerJobData {
  sessionId: string;
  channelId: string | null;
  edgeId: string;
  scheduledAt: string;
  adapterType?: "telegram" | "simulator";
  timerId?: string; // BullMQ job ID
}
```

### Plugin Follow-Up Context

```typescript
interface PluginFollowUpTimerContext {
  pluginId: string; // "node-id:plugin-index"
  parentNodeId: string; // Node that owns the plugin
  pluginIndex: number; // Index within node's plugins array
  stepIndex: number; // Current step in sequence
  sequence: FollowUpStep[];
}
```

## State Tracking

Plugin timers are tracked in two places:

1. **Session State** (`session.pendingPluginFollowUps[]`)

   - Persisted to Redis cache
   - Recovered on session reconstruction

2. **Timer Service** (`pluginFollowUpMap`)
   - In-memory lookup during execution
   - Rebuilt from session state on restart

## Timeout Cancellation

Plugin timers are cancelled when:

1. **User responds** - Message interrupts the sequence
2. **Session completes** - All timers cancelled
3. **Journey republished** - All session caches cleared
4. **Explicit skip** - User skips via button

## Error Handling

If plugin timeout fails:

1. BullMQ retries up to 3 times
2. Exponential backoff (1s, 2s, 4s)
3. Failed jobs kept in queue for debugging
4. Error logged with session/plugin context
