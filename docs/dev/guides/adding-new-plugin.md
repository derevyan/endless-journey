# Adding a New Plugin Type

This guide explains how to add a new plugin type to the Journey Builder.

## Overview

Plugins are **embedded directly in node data** as an array:

```typescript
node.data = {
  type: "message",
  content: "Hello!",
  plugins: [
    { pluginType: "followup", enabled: true, steps: [...] },
    { pluginType: "analytics", enabled: true, eventName: "..." }
  ]
}
```

Each plugin type requires:

1. **Schema** - Define the plugin's data structure
2. **Handler** - Implement runtime execution logic
3. **Frontend** - Create addon + editor components

### Why Embedded Plugins?

| Aspect               | Embedded (`node.data.plugins`)    | Separate (`journey.pluginNodes`)     |
| -------------------- | --------------------------------- | ------------------------------------ |
| **Lookup**           | O(1) - direct access              | O(n) - filter by `parentNodeId`      |
| **Mental model**     | "Node has plugins"                | "Plugins attach to nodes"            |
| **Engine logic**     | Simple: `node.data.plugins ?? []` | Complex: `getPluginsForNode(nodeId)` |
| **Graph complexity** | Fewer entities to manage          | Additional node type in graph        |

### Store Methods for Plugins

The `journey-nodes-store` provides these methods for managing embedded plugins:

```typescript
// Add plugin to node (returns synthetic PluginNode wrapper)
addPlugin(parentNodeId: string, pluginType: "followup"): PluginNode | null

// Update plugin by synthetic ID
updatePlugin(pluginId: string, updates: Partial<PluginNode["data"]>): void

// Delete plugin by synthetic ID (cleans up edges too)
deletePlugin(pluginId: string): void
```

### Plugin Identification

Plugins use **synthetic IDs** that encode both parent and index:

- **Format:** `{parentNodeId}-plugin-{pluginIndex}`
- **Example:** `"node-abc123-plugin-0"` for the first plugin on node `node-abc123`

Use the utilities from `@journey/schemas`:

```typescript
import { generatePluginId, parsePluginId } from "@journey/schemas";

const pluginId = generatePluginId("node-123", 0); // "node-123-plugin-0"
const parsed = parsePluginId(pluginId); // { parentNodeId: "node-123", pluginIndex: 0 }
```

For timer and event contexts, use `nodeId + pluginIndex` or `nodeId + pluginType`.

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     Embedded Plugin Architecture                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  packages/schemas/            packages/engine/        apps/web/          │
│  ┌─────────────────┐         ┌─────────────────┐    ┌─────────────────┐ │
│  │ Schema Layer    │         │ Engine Layer    │    │ Frontend Layer  │ │
│  │                 │         │                 │    │                 │ │
│  │ • PluginConfig  │   ───►  │ • Handler       │    │ • Plugin        │ │
│  │   schemas       │         │ • Registry      │    │   Registry      │ │
│  │ • Type guards   │         │                 │    │ • Definition    │ │
│  │                 │         │                 │    │ • Addon + Editor│ │
│  └─────────────────┘         └─────────────────┘    └─────────────────┘ │
│                                                                          │
│  node.data.plugins → engine.getPluginsForNode(node) → handler.execute() │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Files to Create

Adding a new plugin type requires creating **3-4 files**:

| File                                                                                  | Purpose                                        |
| ------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `packages/schemas/src/plugins/{type}.ts`                                              | Schema + type guard                            |
| `packages/engine/src/plugins/{type}-plugin-handler.ts`                                | Runtime execution logic                        |
| `apps/web/src/features/nodes/journey/plugins/definitions/{type}.ts`                   | Frontend definition (icon, colors, components) |
| `apps/web/src/features/nodes/journey/components/addons/{type}-addon.tsx`              | Addon component                                |
| `apps/web/src/features/nodes/journey/editors/plugin-editors/{type}-plugin-editor.tsx` | Editor component                               |

**No modifications needed to core files** - just add your plugin files and register them.

**Register with 1 import line** in:

- `apps/web/src/features/nodes/journey/plugins/definitions/index.ts`
- `packages/engine/src/plugins/index.ts`

---

## Step-by-Step Guide

### Example: Analytics Plugin

We'll create an Analytics plugin that tracks events when users reach specific nodes.

---

### Step 1: Create the Schema

Define the plugin's data structure using Zod:

```typescript
// packages/schemas/src/plugins/analytics.ts

import { z } from "zod";
import { BasePluginDataSchema } from "./base";

/**
 * Analytics Plugin Data Schema
 *
 * Tracks custom events when the parent node executes.
 */
export const AnalyticsPluginDataSchema = BasePluginDataSchema.extend({
  /** Discriminator for plugin type */
  pluginType: z.literal("analytics"),
  /** Event name to track */
  eventName: z.string().min(1),
  /** Optional event properties */
  properties: z.record(z.string(), z.unknown()).optional(),
  /** Sample rate (0-1) for traffic sampling */
  sampleRate: z.number().min(0).max(1).default(1),
});

export type AnalyticsPluginData = z.infer<typeof AnalyticsPluginDataSchema>;
```

### Step 2: Create the Type Guard

Add a type guard for type-safe narrowing:

```typescript
// packages/schemas/src/plugins/type-guards.ts

// Add alongside existing guards:

import type { PluginConfig } from "./config";
import type { AnalyticsPluginData } from "./analytics";

/**
 * Type guard for AnalyticsPluginData.
 *
 * With embedded plugins, we work directly with plugin config objects:
 *   node.data.plugins.filter(isAnalyticsPluginData)
 */
export function isAnalyticsPluginData(config: PluginConfig): config is AnalyticsPluginData {
  return config.pluginType === "analytics";
}
```

### Step 3: Add to Discriminated Union

Register the new type in the PluginData union:

```typescript
// packages/schemas/src/plugins/follow-up.ts (or a new plugins/data.ts)

import { AnalyticsPluginDataSchema } from "./analytics";

export const PluginDataSchema = z.discriminatedUnion("pluginType", [
  FollowUpPluginDataSchema,
  AnalyticsPluginDataSchema, // Add new schema
]);

export type PluginData = z.infer<typeof PluginDataSchema>;
```

### Step 4: Register Type Constant

Add the plugin type to the constants:

```typescript
// packages/schemas/src/plugins/node.ts

export const PluginTypes = {
  FOLLOWUP: "followup",
  ANALYTICS: "analytics", // Add here
} as const;

export const PluginTypeValues = ["followup", "analytics"] as const;
```

### Step 5: Export from Schema Index

```typescript
// packages/schemas/src/plugins/index.ts

// Add exports
export { AnalyticsPluginDataSchema, type AnalyticsPluginData } from "./analytics";
export { isAnalyticsPluginData, isAnalyticsPlugin } from "./type-guards";
```

---

### Step 6: Create Engine Handler

Implement the runtime execution logic. Handlers receive the plugin config directly (not wrapped in a node):

```typescript
// packages/engine/src/plugins/analytics-plugin-handler.ts

import { createLogger } from "@journey/logger";
import { PluginTypes, type AnalyticsPluginData } from "@journey/schemas";
import type { PluginHandler, PluginExecuteResult, PluginExecutionContext } from "./types";

const log = createLogger("analytics-plugin-handler");

/**
 * Analytics Plugin Handler
 *
 * Tracks events when the parent node executes.
 * Simple plugin with no timer or response handling.
 */
export class AnalyticsPluginHandler implements PluginHandler<AnalyticsPluginData> {
  readonly pluginType = PluginTypes.ANALYTICS;

  async onParentExecute(
    plugin: AnalyticsPluginData, // Plugin config directly, not wrapped
    nodeId: string, // Parent node ID
    ctx: PluginExecutionContext
  ): Promise<PluginExecuteResult> {
    // Skip if disabled
    if (!plugin.enabled) {
      log.debug({ nodeId }, "analyticsPlugin:disabled");
      return { action: "noop" };
    }

    // Apply sample rate
    if (plugin.sampleRate < 1 && Math.random() > plugin.sampleRate) {
      log.debug({ nodeId, sampleRate: plugin.sampleRate }, "analyticsPlugin:sampled_out");
      return { action: "noop" };
    }

    // Track the event
    log.info(
      {
        nodeId,
        eventName: plugin.eventName,
        properties: plugin.properties,
        sessionId: ctx.session.sessionId,
      },
      "analyticsPlugin:eventTracked"
    );

    // In production, you'd call an analytics service here:
    // await ctx.services.analytics.track(plugin.eventName, {
    //   ...plugin.properties,
    //   sessionId: ctx.session.sessionId,
    //   nodeId,
    // });

    return { action: "noop" };
  }

  // Analytics plugin doesn't need timer or response handling
  // These methods are optional in the PluginHandler interface
}
```

### Step 7: Register Engine Handler

```typescript
// packages/engine/src/plugins/index.ts

import { AnalyticsPluginHandler } from "./analytics-plugin-handler";

// Add to handler registration
export function registerDefaultPluginHandlers(registry: PluginHandlerRegistry): void {
  registry.register(new FollowUpPluginHandler());
  registry.register(new AnalyticsPluginHandler()); // Add here
}
```

---

### Step 8: Create Addon Component

The addon is the compact view rendered on parent nodes:

```typescript
// apps/web/src/features/nodes/journey/components/addons/analytics-addon.tsx

import { BarChart3 } from "lucide-react";
import { memo } from "react";

import type { AnalyticsPluginData } from "@journey/schemas";
import { PluginAddon } from "./plugin-addon";

/**
 * Styling for analytics addon
 */
const ANALYTICS_STYLES = {
  icon: {
    wrapper: "p-1.5 rounded-md bg-blue-500/10",
    size: "w-3.5 h-3.5",
    color: "text-blue-600 dark:text-blue-400",
  },
  title: "text-xs font-semibold text-foreground tracking-tight",
  badge: "text-[10px] font-medium text-blue-600 dark:text-blue-400",
  disabled: "px-1.5 py-0.5 text-[9px] font-medium rounded bg-muted text-muted-foreground",
} as const;

interface AnalyticsAddonProps {
  data: AnalyticsPluginData;
  parentNodeId: string;
  pluginIndex: number; // Position in node.data.plugins array
  isEditMode: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
}

export const AnalyticsAddon = memo(function AnalyticsAddon({ data, parentNodeId, pluginIndex, isEditMode, isSelected = false, onSelect }: AnalyticsAddonProps) {
  const samplePercent = Math.round(data.sampleRate * 100);

  return (
    <PluginAddon
      parentNodeId={parentNodeId}
      pluginIndex={pluginIndex}
      isEditMode={isEditMode}
      isSelected={isSelected}
      handles={[]} // Analytics has no outgoing handles
      onClick={onSelect}
    >
      <div className="flex items-center gap-2">
        <div className={ANALYTICS_STYLES.icon.wrapper}>
          <BarChart3 className={`${ANALYTICS_STYLES.icon.size} ${ANALYTICS_STYLES.icon.color}`} />
        </div>
        <div className="flex flex-col min-w-0 flex-1">
          <span className={ANALYTICS_STYLES.title}>{data.label || "Analytics"}</span>
          <span className={ANALYTICS_STYLES.badge}>
            {data.eventName || "No event"} {samplePercent < 100 && `(${samplePercent}%)`}
          </span>
        </div>
        {!data.enabled && <span className={ANALYTICS_STYLES.disabled}>OFF</span>}
      </div>
    </PluginAddon>
  );
});
```

### Step 9: Create Editor Component

The editor is shown in the right panel when the plugin is selected:

```typescript
// apps/web/src/features/nodes/journey/editors/plugin-editors/analytics-plugin-editor.tsx

import { useCallback } from "react";
import { useForm } from "@tanstack/react-form";
import { zodValidator } from "@tanstack/zod-form-adapter";
import { BarChart3 } from "lucide-react";

import { AnalyticsPluginDataSchema, type AnalyticsPluginData } from "@journey/schemas";
import { EditorBase } from "../editor-base";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Switch } from "@/shared/components/ui/switch";
import { Slider } from "@/shared/components/ui/slider";
import { useJourneyNodesStore } from "@/features/journey/store/journey-nodes-store";
import type { PluginEditorComponentProps } from "../../plugins/types";
import { appConfig } from "@/shared/lib/app-config";

interface AnalyticsPluginEditorProps extends PluginEditorComponentProps<AnalyticsPluginData> {}

export function AnalyticsPluginEditor({ pluginData, parentNodeId, pluginIndex, onClose, onDelete, readOnly = false }: AnalyticsPluginEditorProps) {
  // Initialize form with plugin data
  const form = useForm({
    defaultValues: pluginData,
    validatorAdapter: zodValidator(),
    validators: {
      onChange: AnalyticsPluginDataSchema,
    },
    onSubmit: async ({ value }) => {
      // Update plugin directly in node.data.plugins array
      useJourneyNodesStore.getState().updateNodePluginData(parentNodeId, pluginIndex, value);
      onClose?.();
    },
  });

  // Handle delete - removes plugin from node.data.plugins array
  const handleDelete = useCallback(() => {
    useJourneyNodesStore.getState().removeNodePlugin(parentNodeId, pluginIndex);
    onDelete?.();
  }, [parentNodeId, pluginIndex, onDelete]);

  return (
    <EditorBase
      title={readOnly ? "Analytics Plugin Info" : "Edit Analytics Plugin"}
      onClose={onClose}
      onDelete={handleDelete}
      onSave={() => form.handleSubmit()}
      readOnly={readOnly}
      icon={BarChart3}
    >
      <div className={`space-y-4 ${appConfig.editor.padding.section}`}>
        {/* Enabled toggle */}
        <form.Field name="enabled">
          {(field) => (
            <div className="flex items-center justify-between">
              <Label htmlFor="analytics-enabled">Enabled</Label>
              <Switch id="analytics-enabled" checked={field.state.value} onCheckedChange={field.handleChange} disabled={readOnly} />
            </div>
          )}
        </form.Field>

        {/* Label */}
        <form.Field name="label">
          {(field) => (
            <div className="space-y-2">
              <Label htmlFor="analytics-label">Label</Label>
              <Input
                id="analytics-label"
                placeholder="Analytics"
                value={field.state.value ?? ""}
                onChange={(e) => field.handleChange(e.target.value)}
                disabled={readOnly}
              />
            </div>
          )}
        </form.Field>

        {/* Event Name */}
        <form.Field name="eventName">
          {(field) => (
            <div className="space-y-2">
              <Label htmlFor="analytics-event">Event Name</Label>
              <Input
                id="analytics-event"
                placeholder="node_reached"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                disabled={readOnly}
              />
              <p className="text-xs text-muted-foreground">The event name to track when this node executes.</p>
            </div>
          )}
        </form.Field>

        {/* Sample Rate */}
        <form.Field name="sampleRate">
          {(field) => (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="analytics-sample">Sample Rate</Label>
                <span className="text-xs text-muted-foreground">{Math.round((field.state.value ?? 1) * 100)}%</span>
              </div>
              <Slider
                id="analytics-sample"
                min={0}
                max={1}
                step={0.01}
                value={[field.state.value ?? 1]}
                onValueChange={([value]) => field.handleChange(value)}
                disabled={readOnly}
              />
              <p className="text-xs text-muted-foreground">Percentage of traffic to track. Use lower values for high-volume journeys.</p>
            </div>
          )}
        </form.Field>
      </div>
    </EditorBase>
  );
}
```

---

### Step 10: Create Plugin Definition

This is the **key file** that consolidates all frontend configuration:

```typescript
// apps/web/src/features/nodes/journey/plugins/definitions/analytics.ts

import { BarChart3 } from "lucide-react";

import { isAnalyticsPluginData, type AnalyticsPluginData } from "@journey/schemas";
import { AnalyticsPluginEditor } from "../../editors/plugin-editors/analytics-plugin-editor";
import { AnalyticsAddon } from "../../components/addons/analytics-addon";
import { pluginRegistry } from "../registry";
import type { PluginDefinition, PluginColorScheme } from "../types";

// =============================================================================
// COLOR SCHEME
// =============================================================================

/**
 * Blue color scheme for analytics plugin.
 */
const analyticsColors: PluginColorScheme = {
  icon: "text-blue-600 dark:text-blue-400",
  iconBg: "bg-blue-500/10",
  borderDefault: "border-blue-400/50 dark:border-blue-600/50",
  borderHover: "hover:border-blue-500",
  borderSelected: "border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.2)]",
  shadowSelected: "shadow-md shadow-blue-500/20",
  handle: "bg-blue-400",
};

// =============================================================================
// DEFAULT DATA
// =============================================================================

/**
 * Create default data for a new analytics plugin.
 */
function createDefaultAnalyticsData(): AnalyticsPluginData {
  return {
    pluginType: "analytics",
    label: "Analytics",
    enabled: true,
    eventName: "node_reached",
    sampleRate: 1,
  };
}

// =============================================================================
// PLUGIN DEFINITION
// =============================================================================

/**
 * Complete Analytics plugin definition.
 */
export const analyticsPluginDefinition: PluginDefinition<AnalyticsPluginData> = {
  // Identity
  type: "analytics",
  label: "Analytics",
  description: "Track events when users reach this node",

  // Visuals
  icon: BarChart3,
  colors: analyticsColors,

  // Type safety
  isType: isAnalyticsPluginData,

  // Factory
  createDefaultData: createDefaultAnalyticsData,

  // Components
  Editor: AnalyticsPluginEditor,
  Addon: AnalyticsAddon,

  // Behavior - Analytics has no handles or edges
  getHandles: () => [],
  getExpectedEdges: () => [],
};

// =============================================================================
// SELF-REGISTRATION
// =============================================================================

pluginRegistry.register(analyticsPluginDefinition);
```

### Step 11: Register the Definition

Add one import line to trigger self-registration:

```typescript
// apps/web/src/features/nodes/journey/plugins/definitions/index.ts

export { followUpPluginDefinition } from "./follow-up";
export { analyticsPluginDefinition } from "./analytics"; // Add this line
```

---

## Plugin Definition Reference

### PluginDefinition Interface

```typescript
interface PluginDefinition<T extends PluginConfig = PluginConfig> {
  // Identity
  type: T["pluginType"]; // Matches pluginType discriminator
  label: string; // Display name
  description: string; // Tooltip/docs description

  // Visuals
  icon: LucideIcon; // Lucide icon component
  colors: PluginColorScheme; // Color scheme

  // Type Safety
  isType: (config: PluginConfig) => config is T;

  // Factory
  createDefaultData: () => T;

  // Components - receive parentNodeId + pluginIndex, not pluginId
  Editor: ComponentType<PluginEditorComponentProps<T>>;
  Addon: ComponentType<PluginAddonProps<T>>;

  // Behavior (for plugins with outgoing connections)
  getHandles: (data: T) => PluginHandle[];
  getExpectedEdges: (parentNodeId: string, data: T, pluginIndex: number) => PluginEdgeSpec[];
}
```

### PluginColorScheme Interface

```typescript
interface PluginColorScheme {
  icon: string; // "text-blue-600 dark:text-blue-400"
  iconBg: string; // "bg-blue-500/10"
  borderDefault: string; // "border-blue-400/50 dark:border-blue-600/50"
  borderHover: string; // "hover:border-blue-500"
  borderSelected: string; // "border-blue-500 shadow-[...]"
  shadowSelected: string; // "shadow-md shadow-blue-500/20"
  handle: string; // "bg-blue-400"
}
```

### Color Recommendations

| Plugin Type | Primary Color | Use Case        |
| ----------- | ------------- | --------------- |
| Follow-up   | amber         | Timed sequences |
| Analytics   | blue          | Event tracking  |
| Rate Limit  | orange        | Traffic control |
| A/B Test    | violet        | Experiments     |
| Schedule    | green         | Time-based      |

---

## Plugins with Handles

If your plugin needs outgoing connections (like Follow-Up's buttons), implement `getHandles` and `getExpectedEdges`:

```typescript
// Example: A/B Test plugin with two output paths

getHandles(data: ABTestPluginData): PluginHandle[] {
  return [
    { type: "output", id: "variant-a", label: "Variant A" },
    { type: "output", id: "variant-b", label: "Variant B" },
  ];
},

// Edge IDs use parentNodeId + pluginIndex for uniqueness
getExpectedEdges(
  parentNodeId: string,
  data: ABTestPluginData,
  pluginIndex: number
): PluginEdgeSpec[] {
  const edges: PluginEdgeSpec[] = [];
  const pluginRef = `${parentNodeId}::plugin-${pluginIndex}`;

  if (data.variantATarget) {
    edges.push({
      id: `abtest-a::${pluginRef}`,
      source: parentNodeId,
      sourceHandle: `plugin-${pluginIndex}-variant-a`,
      target: data.variantATarget,
    });
  }

  if (data.variantBTarget) {
    edges.push({
      id: `abtest-b::${pluginRef}`,
      source: parentNodeId,
      sourceHandle: `plugin-${pluginIndex}-variant-b`,
      target: data.variantBTarget,
    });
  }

  return edges;
},
```

---

## Testing

### 1. TypeCheck

```bash
pnpm typecheck
```

### 2. Unit Tests

Create handler tests:

```typescript
// packages/engine/src/__tests__/analytics-plugin.integration.test.ts

describe("AnalyticsPluginHandler", () => {
  it("tracks event on parent execute", async () => {
    const handler = new AnalyticsPluginHandler();
    // Plugin config is passed directly (not wrapped in PluginNode)
    const pluginConfig: AnalyticsPluginData = {
      pluginType: "analytics",
      enabled: true,
      eventName: "test_event",
      sampleRate: 1,
    };

    const result = await handler.onParentExecute(pluginConfig, "parent-1", mockContext);

    expect(result.action).toBe("noop");
    // Assert analytics service was called
  });

  it("respects sample rate", async () => {
    const handler = new AnalyticsPluginHandler();
    const pluginConfig: AnalyticsPluginData = {
      pluginType: "analytics",
      enabled: true,
      eventName: "test_event",
      sampleRate: 0, // 0% sample = never track
    };

    const result = await handler.onParentExecute(pluginConfig, "parent-1", mockContext);

    expect(result.action).toBe("noop");
    // Assert analytics service was NOT called
  });
});
```

### 3. E2E Tests

```typescript
// apps/web/tests/analytics-plugin.spec.ts

test("can add analytics plugin to node", async ({ page }) => {
  await loginAndOpenJourney(page);

  // Select a message node
  await page.click('[data-testid="message-node-1"]');

  // Add plugin
  await page.click('[data-testid="add-plugin-button"]');
  await page.click('[data-testid="plugin-type-analytics"]');

  // Configure
  await page.fill('[id="analytics-event"]', "button_clicked");
  await page.click('[data-testid="save-button"]');

  // Verify addon appears
  await expect(page.locator(".analytics-addon")).toBeVisible();
});
```

---

## Troubleshooting

### Plugin doesn't appear

- Verify import line in `plugins/definitions/index.ts`
- Check for TypeScript errors in definition file
- Ensure `pluginRegistry.register()` is called

### Addon not rendering

- Verify `Addon` component is exported correctly
- Check props match `PluginAddonProps<T>` interface
- Ensure `isType` guard works correctly

### Editor not opening

- Verify `Editor` component is exported correctly
- Check props match `PluginEditorComponentProps<T>` interface
- Look for errors in browser console

### Type errors

- Ensure schema is added to `PluginDataSchema` discriminated union
- Verify type guard is exported from `type-guards.ts`
- Check all imports use `@journey/schemas`

---

## Checklist

Use this checklist when adding a new plugin:

### Schema Layer (`packages/schemas`)

- [ ] Create `plugins/{type}.ts` with Zod schema
- [ ] Add type guard to `plugins/type-guards.ts`
- [ ] Add to `PluginDataSchema` discriminated union
- [ ] Add to `PluginTypes` constants
- [ ] Export from `plugins/index.ts`

### Engine Layer (`packages/engine`)

- [ ] Create `plugins/{type}-plugin-handler.ts`
- [ ] Register in `plugins/index.ts`
- [ ] Add tests in `__tests__/{type}-plugin.integration.test.ts`

### Frontend Layer (`apps/web`)

- [ ] Create `components/addons/{type}-addon.tsx`
- [ ] Create `editors/plugin-editors/{type}-plugin-editor.tsx`
- [ ] Create `plugins/definitions/{type}.ts` with complete definition
- [ ] Add import to `plugins/definitions/index.ts`

### Verification

- [ ] `pnpm typecheck` passes
- [ ] `pnpm test:unit` passes
- [ ] Plugin appears in UI
- [ ] Editor opens and saves correctly
- [ ] Addon displays on parent node

---

## Simulator Integration

Plugins with runtime state (timers, pending actions) should expose debug state for the simulator UI. This enables real-time visibility into plugin behavior during testing.

### Debug State Provider Interface

The `PluginDebugStateProvider` interface extracts plugin-specific state from the session for SSE events:

```typescript
// packages/engine/src/plugins/types.ts

interface PluginDebugStateProvider<TSessionState, TDebugState> {
  /** The plugin type (e.g., "followup", "analytics") */
  readonly pluginType: string;

  /** Key in EnhancedUserJourney containing this plugin's state */
  readonly sessionStateKey: keyof EnhancedUserJourney;

  /** Transform session state into debug-friendly format for UI */
  extractDebugState(sessionState: TSessionState): TDebugState;
}
```

### Implementing a Debug State Provider

For plugins that maintain runtime state (like timers or pending actions), implement a debug provider:

```typescript
// packages/engine/src/plugins/analytics-plugin-handler.ts

import type { PluginDebugStateProvider } from "./types";
import type { EnhancedUserJourney } from "@journey/schemas";

/**
 * Debug state type for analytics plugin in simulator UI.
 */
export interface AnalyticsDebugState {
  eventName: string;
  nodeId: string;
  trackedAt: string;
}

/**
 * Debug state provider for analytics plugin.
 */
export const analyticsDebugStateProvider: PluginDebugStateProvider<
  EnhancedUserJourney["analyticsEvents"],
  AnalyticsDebugState[] | undefined
> = {
  pluginType: PluginTypes.ANALYTICS,
  sessionStateKey: "analyticsEvents",

  extractDebugState(sessionState) {
    if (!sessionState || sessionState.length === 0) {
      return undefined;
    }

    return sessionState.map((event) => ({
      eventName: event.eventName,
      nodeId: event.nodeId,
      trackedAt: event.timestamp,
    }));
  },
};
```

### Debug State Flow

The debug state flows through the system as follows:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Debug State Flow                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. Engine updates session state                                            │
│     └─► session.pendingPluginFollowUps.push({ ... })                        │
│                                                                              │
│  2. PluginDebugStateRegistry.extractAll() collects all plugin states        │
│     └─► Calls each registered provider's extractDebugState()                │
│                                                                              │
│  3. SimulatorAdapter publishes SSE event with _debug.pluginStates           │
│     └─► { type: "simulator.debug_update", _debug: { pluginStates: {...} }}  │
│                                                                              │
│  4. Frontend useBackendSimulator hook consumes pluginStates                 │
│     └─► debugState.pluginStates?.followup → pendingFollowUps array          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Registering Debug Providers

Export your debug provider from the plugin handler file and register it in the plugin index:

```typescript
// packages/engine/src/plugins/index.ts

import { analyticsDebugStateProvider } from "./analytics-plugin-handler";
import { followUpDebugStateProvider } from "./follow-up-plugin-handler";
import type { PluginDebugStateRegistry } from "./debug-state-registry";

export function registerPluginDebugProviders(registry: PluginDebugStateRegistry): void {
  registry.register(followUpDebugStateProvider);
  registry.register(analyticsDebugStateProvider); // Add new provider
}
```

---

## UI Integration

For plugins with runtime state, the simulator UI needs to display that state to users.

### Simulator Store Integration

The `simulator-store.ts` manages plugin state on the frontend. For the follow-up plugin, it tracks pending timers:

```typescript
// apps/web/src/features/journey/simulator/store/simulator-store.ts

export interface PendingFollowUp {
  timerId: string;
  nodeId: string;
  stepIndex: number;
  totalSteps: number;
  durationMs: number;
  startTime: number;
}

interface SimulatorState {
  // ... other state
  pendingFollowUps: PendingFollowUp[];
}

export const simulatorActions = {
  addPendingFollowUp: (followUp: PendingFollowUp) => { ... },
  removePendingFollowUp: (timerId: string) => { ... },
  clearFollowUpsForNode: (nodeId: string) => { ... },
};
```

### Consuming Debug State from SSE

The `useBackendSimulator` hook extracts plugin debug state from SSE events:

```typescript
// apps/web/src/features/journey/simulator/hooks/use-backend-simulator.ts

// Extract follow-up debug state from backend debug state
const followUpDebugState = (debugState.pluginStates?.followup ?? []) as Array<{
  timerId: string;
  parentNodeId: string;
  stepIndex: number;
  totalSteps: number;
  triggersAt: string;
}>;

// Transform to frontend format
const pendingFollowUps: PendingFollowUp[] = followUpDebugState.map((fu) => ({
  timerId: fu.timerId,
  nodeId: fu.parentNodeId,
  stepIndex: fu.stepIndex,
  totalSteps: fu.totalSteps,
  durationMs: Math.max(0, new Date(fu.triggersAt).getTime() - Date.now()),
  startTime: Date.now(),
}));
```

### Adding to EnhancedUserJourney

For plugins with runtime state, add a field to `EnhancedUserJourney` in schemas:

```typescript
// packages/schemas/src/session.ts

export const EnhancedUserJourneySchema = UserJourneySchema.extend({
  // ... other fields

  /** Pending analytics events (for analytics plugin) */
  analyticsEvents: z.array(AnalyticsEventSchema).optional(),
});
```

### Example: Follow-Up Plugin Debug Display

The follow-up plugin displays pending timers in the simulator:

```
┌─────────────────────────────────────────────────────────────────┐
│  Follow-Up Timer Active                                         │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Step 1/3  ━━━━━━━━━━━━━░░░░  75%                            ││
│  │ Fires in: 15s                                                ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---

## Advanced: Checklist for Stateful Plugins

For plugins with runtime state, extend the basic checklist:

### Additional Schema Layer Steps

- [ ] Add state field to `EnhancedUserJourney` (e.g., `analyticsEvents`)
- [ ] Create debug state type (e.g., `AnalyticsDebugState`)

### Additional Engine Layer Steps

- [ ] Implement `PluginDebugStateProvider` in handler file
- [ ] Export and register provider in `plugins/index.ts`
- [ ] Update session state in handler methods

### Additional Frontend Steps

- [ ] Add state type to `simulator-store.ts` if needed
- [ ] Consume from `pluginStates` in `use-backend-simulator.ts`
- [ ] Create UI components to display plugin state

---

## Related Documentation

- [Plugin System Architecture](./plugin-system.md) - System overview and edge ID formats
- [Adding New Node Type](./adding-new-node-type.md) - Similar pattern for nodes
- [Pluggable Section Registry](./pluggable-section-registry.md) - Section registration pattern
