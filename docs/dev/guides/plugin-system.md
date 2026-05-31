# Plugin System Architecture

The plugin system enables composable, extensible behavior attached to journey nodes. Plugins are **embedded directly in node data** as an array (`node.data.plugins[]`), providing a clean separation of concerns.

## Overview

Plugins are embedded configurations that extend node behavior:
- **Follow-up Plugin**: Sends timed follow-up messages after the parent node executes
- Future plugins: Analytics, Rate Limiting, A/B Testing, Scheduling

```
┌───────────────────────────────────────┐
│ Message Node                          │
│ ├── content: "Hello!"                 │
│ └── plugins: [                        │
│       { pluginType: "followup", ... } │  ← Embedded, not separate node
│     ]                                 │
└───────────────────────────────────────┘
```

**Key architectural decision:** Plugins are rendered as **addons inside parent nodes** on the canvas, not as separate React Flow nodes. This provides O(1) lookup and simpler mental model.

## Architecture Layers

### 1. Schema Layer (`@journey/schemas`)

```
packages/schemas/src/plugins/
├── base.ts          # BasePluginDataSchema
├── follow-up.ts     # FollowUpPluginDataSchema, PluginDataSchema
├── edge.ts          # PluginEdgeId utilities, PluginEdgeTypes
├── node.ts          # PluginNodeSchema, PluginTypes
└── index.ts         # Public exports
```

**Key Types:**
- `PluginData` - Discriminated union by `pluginType` (stored in `node.data.plugins[]`)
- `PluginNode` - Synthetic wrapper type for backward compatibility (created by `useNodePlugins` hook)
- `PluginEdgeId` - Deterministic edge ID utilities

### 2. Engine Layer (`@journey/engine`)

```
packages/engine/src/plugins/
├── types.ts         # PluginHandler interface
├── registry.ts      # PluginHandlerRegistry
├── follow-up-plugin-handler.ts
└── index.ts
```

**Handler Interface:**
```typescript
interface PluginHandler<T extends PluginData> {
  readonly pluginType: PluginType;
  onParentExecute(pluginData: T, parentNodeId: string, pluginIndex: number, ctx: PluginExecutionContext): Promise<PluginExecuteResult>;
  onTimeout?(timerId: string, ctx: PluginExecutionContext): Promise<PluginTimeoutResult>;
  onUserResponse?(pluginData: T, parentNodeId: string, pluginIndex: number, ctx: PluginExecutionContext): Promise<void>;
}
```

Note: Handlers receive plugin data directly (from `node.data.plugins[index]`), not a wrapped PluginNode.

### 3. Frontend Layer (`apps/web`)

```
apps/web/src/features/nodes/journey/
├── plugins/                         # Plugin registry system
│   ├── types.ts                     # PluginDefinition interface
│   ├── registry.ts                  # PluginRegistry class
│   └── definitions/                 # Self-registering definitions
│       ├── follow-up.ts
│       └── index.ts
├── components/addons/
│   ├── plugin-addon-container.tsx   # Uses registry for dispatch
│   ├── plugin-addon.tsx             # Base addon shell
│   └── follow-up-addon.tsx          # Follow-up specific UI
├── editors/
│   ├── plugin-node-editor.tsx       # Uses registry for routing
│   └── plugin-editors/              # Type-specific editors
├── hooks/
│   └── use-node-plugins.ts          # Plugin data hook
└── utils/
    └── plugin-edge-identity.ts      # Web-specific edge utilities
```

**Frontend Plugin Registry:**

The frontend uses a self-registration pattern similar to the node registry. Each plugin defines its complete configuration (icon, colors, components, behavior) in a single definition file that self-registers on import.

```typescript
// apps/web/src/features/nodes/journey/plugins/definitions/follow-up.ts
export const followUpPluginDefinition: PluginDefinition<FollowUpPluginData> = {
  type: "followup",
  label: "Follow-Up",
  icon: MessageCircle,
  colors: { /* ... */ },
  isType: isFollowUpPluginData,
  createDefaultData: () => ({ /* ... */ }),
  Editor: FollowUpPluginEditor,
  Addon: FollowUpAddon,
  getHandles: (data) => [/* ... */],
  getExpectedEdges: (pluginId, data) => [/* ... */],
};

pluginRegistry.register(followUpPluginDefinition);
```

Consumer components use the registry instead of switch statements:

```typescript
// plugin-node-editor.tsx - no switch needed!
const definition = pluginRegistry.get(pluginData.pluginType);
if (definition && definition.isType(pluginData)) {
  return <definition.Editor pluginId={pluginId} pluginData={pluginData} ... />;
}
```

## Adding a New Plugin Type

See **[Adding a New Plugin](./adding-new-plugin.md)** for the complete step-by-step guide.

**Quick summary** - files to create:

| File | Purpose |
|------|---------|
| `packages/schemas/src/plugins/{type}.ts` | Schema + type guard |
| `packages/engine/src/plugins/{type}-plugin-handler.ts` | Runtime handler |
| `apps/web/.../plugins/definitions/{type}.ts` | Frontend definition |

**No modifications needed to:**
- `plugin-addon-container.tsx` (uses registry)
- `plugin-node-editor.tsx` (uses registry)

## Edge ID Format

Plugin edges use deterministic IDs for reliable parsing:

| Edge Type | Format | Example |
|-----------|--------|---------|
| Connection | `plugin::{parentId}::{pluginId}` | `plugin::msg-1::plugin-fu-1` |
| Button | `plugin-btn::{pluginId}::{stepIdx}::{buttonId}` | `plugin-btn::plugin-fu-1::0::btn-watch` |
| Exit | `plugin-exit::{pluginId}` | `plugin-exit::plugin-fu-1` |

**Parsing:**
```typescript
import { PluginEdgeId } from "@journey/schemas";

const parsed = PluginEdgeId.parseButton("plugin-btn::plugin-fu-1::0::btn-1");
// { pluginId: "plugin-fu-1", stepIndex: 0, buttonId: "btn-1" }
```

## Store Integration

Plugins are embedded directly in node data (`node.data.plugins[]`):

```typescript
// Plugins accessed via node.data.plugins
node.data = {
  type: "message",
  content: "Hello!",
  plugins: [
    { pluginType: "followup", enabled: true, steps: [...] }
  ]
}

// Store methods for plugin management
journeyNodesActions.addPlugin(parentNodeId, pluginType)    // Returns synthetic PluginNode
journeyNodesActions.updatePlugin(pluginId, updates)        // pluginId = "{parentNodeId}-plugin-{index}"
journeyNodesActions.deletePlugin(pluginId)                 // Cleans up plugin edges too
```

**Events emitted:**
- `plugin:added` - When plugin is attached to a node
- `plugin:updated` - When plugin data changes
- `plugin:deleted` - When plugin is removed

**Cascade delete:**
When a parent node is deleted, all attached plugins are automatically removed and `plugin:deleted` events are emitted for each.

## Validation

Plugin references are validated in `journey-validator.ts`:

```typescript
validatePluginReferences(journey: JourneyConfig): ValidationError[]
```

Checks:
- `parentNodeId` references existing node
- `exitPath.nodeId` references existing node (not self)
- Button `targetNodeId` references existing nodes

## Testing

See `packages/engine/src/__tests__/follow-up-plugin.integration.test.ts` for handler testing patterns.

Key scenarios to test:
1. Plugin scheduling on parent execute
2. Timer timeout handling
3. User response cancellation
4. Exit path transitions
5. Button routing

## Simulator Integration

For plugins with runtime state (timers, pending actions), implement a `PluginDebugStateProvider` to expose state to the simulator UI:

```typescript
// packages/engine/src/plugins/types.ts
interface PluginDebugStateProvider<TSessionState, TDebugState> {
  pluginType: string;
  sessionStateKey: keyof EnhancedUserJourney;
  extractDebugState(sessionState: TSessionState): TDebugState;
}
```

The debug state flows through:
1. **Engine** → Session state updates (`session.pendingPluginFollowUps`)
2. **Registry** → `PluginDebugStateRegistry.extractAll()` collects all plugin states
3. **SSE** → SimulatorAdapter publishes `_debug.pluginStates` in events
4. **Frontend** → `useBackendSimulator` consumes `pluginStates.{pluginType}`

See **[Adding a New Plugin - Simulator Integration](./adding-new-plugin.md#simulator-integration)** for detailed implementation guide.

## Related Documentation

- **[Adding a New Plugin](./adding-new-plugin.md)** - Complete step-by-step guide
- [Adding New Node Type](./adding-new-node-type.md) - Similar pattern for nodes
- [Pluggable Section Registry](./pluggable-section-registry.md) - Section registration pattern
