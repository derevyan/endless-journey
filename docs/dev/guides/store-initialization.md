# Store Initialization Guide

This guide documents the store architecture and initialization sequence for the Journey Builder web application.

## Store Architecture Overview

The web app uses 7 specialized TanStack stores with clear boundaries:

| Store | Location | Responsibility |
|-------|----------|----------------|
| `journey-nodes-store` | `stores/` | Nodes/edges data with undo/redo |
| `ui-store` | `stores/` | Edit mode, selections, dialogs, panels |
| `version-store` | `stores/` | Version history management |
| `user-store` | `stores/` | Current authenticated user state |
| `custom-journey-store` | `features/journey/builder/store/` | Custom journey persistence |
| `simulator-store` | `features/journey/simulator/store/` | Simulator execution state |
| `journey-header-store` | `features/dashboard/store/` | Header control state |

## Initialization Sequence

### 1. QueryClient Setup

The React Query client must be registered with the store-actions layer during app bootstrap:

```typescript
// In routes/__root.tsx
import { setQueryClient } from "@/stores/store-actions";

export const Route = createRootRouteWithContext<RouterContext>()({
  beforeLoad: ({ context }) => {
    setQueryClient(context.queryClient);
  },
});
```

**Why**: `store-actions.ts` needs the queryClient to invalidate queries after store operations.

### 2. Event Bridge Initialization

The SSE event bridge connects server-side events to store updates:

```typescript
// Event bridge is initialized via useEventBridge() hook in a root provider
import { useEventBridge } from "@/stores/event-bridge";

function RootProvider({ children }) {
  useEventBridge(); // Starts SSE connection and routes events to stores
  return children;
}
```

**Why**: Real-time updates (e.g., session events) need to be reflected in stores.

### 3. Store Event Bus

Stores communicate via the event bus (`store-event-bus.ts`):

```typescript
// Emitting events (in a store action)
storeEventBus.emit({ type: 'node:updated', payload: { nodeId, updates } });

// Subscribing to events (in another store)
storeEventBus.on('node:updated', (event) => {
  // React to the change
});
```

**Why**: Decouples stores from each other, preventing circular dependencies.

## HMR (Hot Module Replacement) Handling

Stores should handle HMR to prevent state duplication during development.

### Pattern: ui-store.ts

```typescript
// Check for existing global store during HMR
declare global {
  var __uiStore: Store<UIStoreState> | undefined;
}

export const uiStore: Store<UIStoreState> =
  globalThis.__uiStore ?? new Store<UIStoreState>(initialState);

if (import.meta.hot) {
  globalThis.__uiStore = uiStore;

  // Cleanup subscriptions on HMR
  import.meta.hot.dispose(() => {
    cleanupSubscriptions();
  });
}
```

**Why**: Prevents creating duplicate stores on hot reload, which would cause memory leaks and inconsistent state.

## Store Reset Pattern

All stores should implement a `reset()` method for cleanup:

```typescript
export const storeActions = {
  // ... other actions

  reset: () => {
    store.setState(initialState);
  },
};
```

The global reset is coordinated via `store-actions.ts`:

```typescript
export function resetAllStores() {
  journeyNodesActions.reset();
  uiActions.reset();
  versionActions.reset();
  customJourneyActions.reset();
  // ... etc
}
```

**When to reset**: Route navigation, user logout, session cleanup.

## Cross-Store Coordination

Complex operations that span multiple stores should go through `store-actions.ts`:

```typescript
// store-actions.ts
export async function setJourneyData(journey: JourneyData) {
  // Coordinate multiple stores
  journeyNodesActions.setCurrentData(journey.nodes, journey.edges);
  uiActions.setPendingChanges(false);
  uiActions.clearSelection();

  // Emit event for other interested parties
  storeEventBus.emit({ type: 'journey:loaded', payload: { journeyId: journey.id } });
}
```

**Rule**: Stores never import each other directly. All coordination goes through:
1. Event bus (reactive, decoupled)
2. `store-actions.ts` (imperative, orchestrated)

## Debugging Tips

### Check listener counts
```typescript
import { storeEventBus } from "@/stores/store-event-bus";

console.log('Listeners:', storeEventBus.getListenerCount());
console.log('Event types:', storeEventBus.getEventTypeCount());
console.log('Total events:', storeEventBus.getTotalEventCount());
```

### Verify store state
```typescript
import { uiStore } from "@/stores/ui-store";
import { journeyNodesStore } from "@/stores/journey-nodes-store";

console.log('UI State:', uiStore.state);
console.log('Nodes:', journeyNodesStore.state.nodes.length);
```

## Common Issues

### "QueryClient not set"
**Cause**: `setQueryClient()` wasn't called during app bootstrap.
**Fix**: Ensure `setQueryClient()` is called in `__root.tsx` beforeLoad.

### Duplicate store instances
**Cause**: HMR created new store without checking for existing global.
**Fix**: Implement the HMR pattern shown above.

### Events not received
**Cause**: Subscription created after event was emitted.
**Fix**: Ensure subscriptions are set up in store initialization, not in component effects.

## Related Documentation

- [Store Architecture](/docs/dev/architecture/store-architecture.md)
- [Component Organization](/docs/dev/guides/component-organization.md)
