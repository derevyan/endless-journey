# Project Structure & Organization

Single source of truth for folder structure, naming conventions, and code organization in the Journey Builder web application.

## Quick Reference

```
apps/web/src/
├── data/             # Static journey templates
├── features/         # Feature-first modules (main code)
│   ├── agent-workflows/ # Agent workflow builder
│   ├── auth/         # Auth flows and session wiring
│   ├── crm/          # CRM & client management
│   ├── dashboard/    # Dashboard shell & navigation
│   ├── developers/   # Developer tools & events
│   ├── journey/      # ★ Unified journey feature (builder, nodes, simulator)
│   ├── mindstate/    # MindState/agent builder
│   ├── settings/     # Application settings
│   └── users/        # User management
├── hooks/            # Shared application-wide query hooks
├── providers/        # Context providers (events, journey data, theme)
├── routes/           # TanStack Router pages
├── routeTree.gen.ts  # Generated TanStack Router tree
├── shared/           # Shared utilities, components, API client
│   ├── components/   # Shared components (ui primitives + shared domain components)
│   ├── hooks/        # Shared utility hooks (debounce, SSE, dialogs)
│   └── lib/          # Core utilities (API, events, variables, ui)
├── stores/           # TanStack Store (centralized)
└── test/             # Test setup
```

---

## Directory Details

### `features/` - Feature-First Architecture

**This is where most application code lives.** Each feature is self-contained with its own components, hooks, utilities, and optionally a store.

```
features/
├── agent-workflows/ # Agent workflow builder & approvals
│   ├── components/  # Builder layout, panels, selectors
│   ├── hooks/       # Workflow hooks
│   ├── stores/      # Agent workflow store
│   └── pages/       # Feature pages
├── auth/            # Auth flows and session wiring
├── journey/          # ★ Unified journey feature (largest)
│   ├── builder/      # Journey canvas & editing UI
│   ├── nodes/        # React Flow node plugin system
│   ├── simulator/    # Journey testing & simulation
│   └── hooks/        # Journey-specific navigation hooks
├── crm/              # CRM & client management
│   ├── components/   # Pipeline, client-detail, messaging
│   └── hooks/        # CRM-specific hooks & queries
├── dashboard/        # Dashboard shell & navigation
│   ├── components/   # Sidebar, navigation
│   └── store/        # journey-header-store
├── developers/       # Developer tools & events
│   ├── components/   # Events viewer
│   └── hooks/        # Events hooks
├── mindstate/        # MindState/agent builder
│   ├── components/   # Builder, viewer, common
│   ├── hooks/        # MindState queries
│   ├── lib/          # MindState utilities
│   └── stores/       # MindState stores (plural)
├── settings/         # Application settings
│   └── components/   # Settings sections
└── users/            # User management
    └── components/   # User list, detail views
```

#### Feature Module Structure

Each feature follows this structure (create only what you need):

```
features/{feature}/
├── components/           # Feature UI components
│   ├── {component}.tsx
│   └── index.ts          # Barrel export
├── hooks/                # Feature hooks
│   ├── queries/          # TanStack Query hooks
│   ├── use-{hook}.ts
│   └── index.ts          # Barrel export
├── lib/                  # Feature utilities
│   └── index.ts          # Barrel export
├── store/                # Feature store (single-consumer only)
│   ├── {feature}-store.ts
│   └── index.ts          # Barrel export
└── index.ts              # Feature public API
```

**Example - `features/journey/` (Unified Journey Feature):**

```
features/journey/
├── builder/              # Canvas & editing UI
│   ├── components/
│   │   └── layout/       # Canvas layout components
│   ├── config/           # Builder configuration
│   ├── context/          # Editor actions context (DI)
│   ├── hooks/
│   │   ├── queries/      # Journey data queries
│   │   ├── selectors/    # Store selectors
│   │   └── __tests__/    # Hook tests
│   ├── lib/
│   │   └── journey/      # Journey utilities
│   ├── store/            # custom-journey-store
│   └── index.ts
├── nodes/                # React Flow node plugin system
│   ├── components/       # Node visuals (base-node, message-node, etc.)
│   │   └── previews/     # Node preview components
│   ├── config/           # Node configuration
│   ├── definitions/      # Node type configs (auto-register)
│   ├── edges/            # Custom edge components
│   ├── editors/          # Node editor panels
│   │   └── sections/     # Editor section components
│   ├── forms/            # Form builders & extractors
│   ├── hooks/            # Node editor hooks
│   │   ├── forms/        # Form-specific hooks
│   │   └── __tests__/    # Hook tests
│   ├── logic/            # Node execution utilities
│   ├── registry/         # Auto-registration system
│   ├── utils/            # Node utilities
│   │   └── __tests__/    # Utility tests
│   └── types.ts          # React Flow type extensions
├── simulator/            # Testing & simulation
│   ├── components/
│   │   ├── chat/         # Chat UI
│   │   │   └── system-events/  # System event renderers
│   │   ├── console/      # Event console
│   │   └── controls/     # Simulator controls
│   ├── context/          # Simulator context
│   ├── hooks/            # Simulator hooks
│   ├── lib/              # Simulator utilities
│   │   └── __tests__/    # Lib tests
│   ├── store/            # simulator-store
│   └── types/            # Simulator types
├── hooks/                # Journey-specific navigation hooks
│   └── navigation/
│       ├── use-journey-crud.ts
│       └── use-journey-selection.ts
└── index.ts              # Unified feature export
```

---

### `features/nodes/journey/` - Node Plugin System

Self-contained node type system with auto-registration. **Located at `features/nodes/journey/`**.

**Current node types:**

| Node Type       | Descriptor File                  | Description                    |
| --------------- | -------------------------------- | ------------------------------ |
| `start`         | `types/start/descriptor.ts`      | Journey entry point            |
| `message`       | `types/message/descriptor.ts`    | Send messages to users         |
| `condition`     | `types/condition/descriptor.ts`  | Branching logic                |
| `agent`         | `types/agent/descriptor.ts`      | AI agent interactions          |
| `crm`           | `types/crm/descriptor.ts`        | CRM operations                 |
| `wait`          | `types/wait/descriptor.ts`       | Delay/timer nodes              |
| `webhook`       | `types/webhook/descriptor.ts`    | External webhook calls         |
| `questionnaire` | `types/questionnaire/descriptor.ts` | Multi-question forms        |
| `teleport`      | `types/teleport/descriptor.ts`   | Jump to another node/journey   |
| `end`           | `types/end/descriptor.ts`        | Journey termination            |

**Adding a new node type:**

1. Create folder in `features/nodes/journey/types/{type}/` with `descriptor.ts`, `component.tsx`, `editor.tsx`, and `form.ts`
2. Add the descriptor import to `features/nodes/journey/types/index.ts` for auto-registration
3. Update form builders/extractors if needed

See [Adding New Node Type Guide](../guides/adding-new-node-type.md) for details.

---

### `stores/` - State Management

TanStack Store for client-side state. Stores are either centralized (multi-consumer) or feature-specific (single-consumer).

```
stores/
├── journey-nodes-store.ts    # Nodes/edges + undo/redo (~20KB)
├── ui-store.ts               # Edit mode, selections, dialogs (~16KB)
├── user-store.ts             # Authenticated user state (~3KB)
├── version-store.ts          # Version history management (~6KB)
├── store-event-bus.ts        # Cross-store type-safe events (~7KB)
├── store-actions.ts          # Multi-store coordination (~30KB)
└── index.ts                  # Barrel export + feature store re-exports
```

#### Store Location Rules

| Store           | Location              | Reason                 |
| --------------- | --------------------- | ---------------------- |
| Multi-consumer  | `stores/`             | Used by 2+ features    |
| Core data       | `stores/`             | Foundational app state |
| Single-consumer | `features/{f}/store/` | Used by 1 feature only |

**Current store distribution:**

| Store                  | Location                            | Consumers                            |
| ---------------------- | ----------------------------------- | ------------------------------------ |
| `journey-nodes-store`  | `stores/`                           | journey/builder, nodes/journey       |
| `ui-store`             | `stores/`                           | journey/builder, settings, dashboard |
| `user-store`           | `stores/`                           | Global authentication                |
| `version-store`        | `stores/`                           | journey/builder (coupled to nodes)   |
| `store-event-bus`      | `stores/`                           | Cross-store communication            |
| `store-actions`        | `stores/`                           | Multi-store coordination             |
| `custom-journey-store` | `features/journey/builder/store/`   | journey/builder only                 |
| `agent-workflow-store` | `features/agent-workflows/stores/`  | agent-workflows only                 |
| `agent-test-store`     | `features/agent-workflows/stores/`  | agent-workflows testing tools        |
| `journey-header-store` | `features/dashboard/store/`         | dashboard only                       |
| `simulator-store`      | `features/journey/simulator/store/` | journey/simulator only               |
| `builder-store`        | `features/mindstate/stores/`        | mindstate builder UI                 |

---

### `hooks/` - Shared Application-Wide Hooks

Only hooks used across multiple features belong here. Journey-specific hooks now live in `features/journey/`.

```
hooks/
├── queries/                      # TanStack Query - shared data fetching
│   ├── use-active-sessions-count.ts  # Active session metrics
│   ├── use-channels.ts               # Channel configuration
│   ├── use-events.ts                 # Event streaming
│   ├── use-journey-config.ts         # Journey configuration
│   ├── use-journey-list-manifest.ts  # Journey list metadata
│   ├── use-media-gallery.ts          # Media management
│   ├── use-models.ts                 # LLM model selection
│   ├── use-tags.ts                   # Tag management
│   ├── use-upload.ts                 # File upload
│   ├── use-user-activity.ts          # User activity tracking
│   ├── use-variables.ts              # Variable management
│   └── index.ts
└── index.ts
```

**Feature-specific hooks locations:**

| Feature Hook        | Location                                    |
| ------------------- | ------------------------------------------- |
| Journey queries     | `features/journey/builder/hooks/queries/`   |
| Editor hooks        | `features/journey/builder/hooks/`           |
| Editor selectors    | `features/journey/builder/hooks/selectors/` |
| Simulator hooks     | `features/journey/simulator/hooks/`         |
| Node editor hooks   | `features/nodes/journey/hooks/`             |
| Node form hooks     | `features/nodes/journey/hooks/forms/`       |
| Journey navigation  | `features/journey/hooks/navigation/`        |
| Agent workflows     | `features/agent-workflows/hooks/`           |
| CRM queries         | `features/crm/hooks/queries/`               |
| MindState queries   | `features/mindstate/hooks/queries/`         |
| Developer hooks     | `features/developers/hooks/`                |

**Note:** Feature-specific hooks go in `features/{feature}/hooks/`.

---

### `shared/` - Shared Utilities & Components

Cross-cutting utilities, the API client, and reusable components.

```
shared/
├── components/              # Shared components (ui primitives + shared domain components)
│   ├── ui/                  # ★ shadcn/ui primitives (button, dialog, etc.)
│   ├── chat/                # Chat components (shared between simulator & CRM)
│   ├── common/              # Error boundary, loading, etc.
│   ├── errors/              # Error pages (401, 403, 404, 503)
│   ├── layout/              # Layout primitives
│   ├── editor-panel.tsx     # Shared panel components
│   ├── save-version-dialog.tsx
│   └── index.ts
├── hooks/                   # Shared utility hooks
│   ├── audio/               # Audio recording/playback
│   ├── use-debounce.ts      # Debounce hook
│   ├── use-dialog-state.ts  # Dialog state management
│   ├── use-duration-field.ts # Duration field helper (TanStack Form)
│   ├── use-mobile.ts        # Mobile detection
│   ├── use-sse-connection.ts # SSE connection management
│   ├── use-store-event.ts   # Store event bus hook
│   └── index.ts
├── lib/                     # Core utilities (see below)
└── index.ts
```

#### `shared/lib/` - Core Utilities

Infrastructure and utilities that don't belong to a specific feature.

```
shared/lib/
├── api/                     # API client modules
│   ├── base.ts              # Base API client
│   ├── types.ts             # API types
│   ├── audio.ts             # Audio TTS/STT
│   ├── channels.ts          # Channel management
│   ├── crm.ts               # CRM operations
│   ├── events.ts            # Event streaming
│   ├── journeys.ts          # Journey CRUD
│   ├── media.ts             # Media upload/download
│   ├── mindstate.ts         # MindState operations
│   ├── sessions.ts          # Session management
│   ├── tags.ts              # Tag management
│   ├── users.ts             # User management
│   ├── variables.ts         # Variable operations
│   ├── versions.ts          # Version management
│   ├── workflows.ts         # Agent workflow operations
│   ├── workflow-versions.ts # Agent workflow versioning
│   └── index.ts
├── events/                  # Event system
│   ├── dispatcher.ts
│   ├── handlers/
│   ├── registry.ts
│   └── types.ts
├── ui/                      # UI utilities
│   ├── notify.tsx           # Toast notifications
│   ├── layout.ts            # Dagre layout
│   └── __tests__/
├── utils/                   # General utilities
├── variables/               # Variable resolution
│   └── variable-resolver.ts
├── activity-filters.ts      # Activity filtering
├── app-config.ts            # Application configuration (~7KB)
├── audio-utils.ts           # Audio utilities (~5KB)
├── auth-client.ts           # Better Auth client
├── create-mutation.ts       # TanStack Query mutation helper
├── query-keys.ts            # React Query key factory (~4KB)
└── index.ts
```

---

### `providers/` - Context Providers

Application-wide context providers.

```
providers/
├── event-provider.tsx       # Real-time event subscription (~4KB)
├── journey-data-provider.tsx # Journey data context (~5KB)
├── theme-provider.tsx       # Theme management
└── index.ts
```

---

### `routes/` - File-Based Routing

TanStack Router file-based routes. Each file is a route.

```
routes/
├── __root.tsx                           # Root layout
├── _dashboard.tsx                       # Dashboard layout (shared)
├── _dashboard.index.tsx                 # Dashboard home
├── _dashboard.journeys.tsx              # Journey list
├── _dashboard.journeys.$journeySlug.tsx # Journey builder
├── _dashboard.agents.tsx                # Agent workflows layout
├── _dashboard.agents.index.tsx          # Agent workflows list
├── _dashboard.agents.$agentKey.tsx      # Agent workflow builder
├── _dashboard.crm.tsx                   # CRM layout
├── _dashboard.crm.index.tsx             # CRM main (pipeline view)
├── _dashboard.crm.users.$userId.tsx     # CRM user detail
├── _dashboard.mindstate.tsx             # MindState layout
├── _dashboard.mindstate.index.tsx       # MindState list
├── _dashboard.mindstate.$definitionId.tsx # MindState builder
├── _dashboard.settings.tsx              # Settings layout
├── _dashboard.settings.index.tsx        # Settings index
├── _dashboard.settings.profile.tsx      # Profile settings
├── _dashboard.settings.organisation.tsx # Organization settings
├── _dashboard.settings.channels.tsx     # Channel configuration
├── _dashboard.settings.variables.tsx    # Variable management
├── _dashboard.settings.tags.tsx         # Tag management
├── _dashboard.settings.appearance.tsx   # Appearance settings
├── _dashboard.settings.import-export.tsx # Import/export
├── _dashboard.settings.journey-pipelines.tsx # Journey pipelines
├── _dashboard.settings.journey-mindstate.tsx # Journey MindState config
├── _dashboard.users.tsx                 # Users page
├── _dashboard.developers.events.tsx     # Developer events viewer
├── 401.tsx                              # Unauthorized
├── 403.tsx                              # Forbidden
├── 404.tsx                              # Not found
├── 503.tsx                              # Service unavailable
└── error.tsx                            # Generic error
```

**Route naming conventions:**

- `__root.tsx` - Root layout (double underscore)
- `_dashboard.tsx` - Layout wrapper (underscore prefix = pathless)
- `_dashboard.feature.tsx` - Feature page
- `_dashboard.feature.sub.tsx` - Nested page
- `$param` - Dynamic parameter

---

## Naming Conventions

All files use **kebab-case** (lowercase with hyphens).

| Category       | Convention                 | Example                           |
| -------------- | -------------------------- | --------------------------------- |
| Files          | `kebab-case.ts`            | `use-simulator.ts`                |
| Components     | `{name}.tsx`               | `journey-canvas.tsx`              |
| Hooks          | `use-{action}.ts`          | `use-journey-config.ts`           |
| Stores         | `{domain}-store.ts`        | `ui-store.ts`                     |
| Routes         | `_layout.section.page.tsx` | `_dashboard.settings.profile.tsx` |
| Tests          | `{name}.test.ts`           | `ui-store.test.ts`                |
| Barrel exports | `index.ts`                 | Always `index.ts`                 |

**Exception:** `App.tsx` (React root) follows React convention.

---

## Decision Guide: Where Does This Code Go?

### Components

| Scenario            | Location                             |
| ------------------- | ------------------------------------ |
| shadcn/ui primitive | `shared/components/ui/`              |
| Used by 2+ features | `shared/components/`                 |
| Feature-specific    | `features/{feature}/components/`     |
| Node visual         | `features/nodes/journey/types/{type}/component.tsx` |
| Node editor panel   | `features/nodes/journey/types/{type}/editor.tsx`    |
| Auth-related        | `features/auth/components/`          |

### Hooks

| Scenario                 | Location                                  |
| ------------------------ | ----------------------------------------- |
| Shared data fetching     | `hooks/queries/`                          |
| Journey data queries     | `features/journey/builder/hooks/queries/` |
| Journey navigation       | `features/journey/hooks/navigation/`      |
| Feature-specific         | `features/{feature}/hooks/`               |
| Node editor logic        | `features/nodes/journey/hooks/`           |
| Utility (debounce, etc.) | `shared/hooks/`                           |

### Stores

| Scenario                | Location                    |
| ----------------------- | --------------------------- |
| Multi-feature consumer  | `stores/`                   |
| Core/foundational data  | `stores/`                   |
| Single-feature consumer | `features/{feature}/store/` |

### Utilities

| Scenario            | Location                   |
| ------------------- | -------------------------- |
| Core infrastructure | `shared/lib/`              |
| Feature-specific    | `features/{feature}/lib/`  |
| API client modules  | `shared/lib/api/`          |
| Query key factory   | `shared/lib/query-keys.ts` |
| App configuration   | `shared/lib/app-config.ts` |

---

## Import Rules

### Path Aliases

Always use the `@/` alias:

```typescript
// Good
import { Button } from "@/shared/components/ui/button";
import { useSimulator } from "@/features/journey/simulator";
import { journeyNodesStore } from "@/stores/journey-nodes-store";
import { JourneyNode } from "@/features/nodes/journey/react-flow-types";

// Bad - relative paths for cross-directory imports
import { Button } from "../../../shared/components/ui/button";
```

### Feature Internal Imports

Within a feature, use relative paths:

```typescript
// Inside features/journey/simulator/components/chat.tsx
import { useSimulator } from "../hooks/use-simulator";
import { formatMessage } from "../lib/formatter";
```

### Cross-Feature Imports

Import from feature's public API (index.ts):

```typescript
// Good - import from feature public API
import { SimulatorPanel } from "@/features/journey/simulator";

// Avoid - reaching into feature internals
import { SimulatorPanel } from "@/features/journey/simulator/components/simulator-panel";
```

### Store Imports

Prefer centralized imports for convenience:

```typescript
// Recommended - import from centralized stores (re-exports feature stores)
import { simulatorStore } from "@/stores";

// Also works - direct feature import
import { simulatorStore } from "@/features/journey/simulator/store";
```

### Context-Based Actions (Recommended for Editors)

For node editors and form components, use **dependency-injected actions** via context instead of direct store imports:

```typescript
// ✅ Recommended - context-based (testable, mockable)
import { useEditorActionsContext } from "@/features/journey/builder/context";

function MyNodeEditor({ node }: NodeEditorProps) {
  const { updateNode, deleteNode, notify } = useEditorActionsContext();
  // ...
}

// ❌ Avoid in editors - direct store imports (harder to test)
import { updateNodeWithSync } from "@/stores/store-actions";
```

**Benefits:**

- Components can be rendered in isolation (Storybook)
- Mock actions for unit tests via provider overrides
- Explicit dependencies instead of implicit imports

See [Web App README - Dependency Injection](../../web/README.md#dependency-injection-for-actions) for available actions.

---

## Barrel Exports

Every directory with multiple files should have an `index.ts` barrel export.

### Rules

1. **Export only public API** - Don't export internal implementation details
2. **Prefer named exports** - Use `export { Component }` over `export *`
3. **Use `export *` sparingly** - Only for type re-exports

### Example

```typescript
// features/journey/simulator/components/index.ts
export { JourneyChat } from "./chat";
export { SimulatorControls } from "./controls";
export { EventLogPanel } from "./console";
// Don't export internal components

// features/journey/simulator/index.ts (feature public API)
export { JourneyChat, SimulatorControls } from "./components";
export { useSimulator, useSimulatorMode } from "./hooks";
export { simulatorStore, simulatorActions } from "./store";
export type { PlaybackState } from "./store";
```

---

## Adding New Features

### 1. Create Feature Structure

```bash
mkdir -p features/{feature}/{components,hooks,lib}
```

### 2. Create Barrel Exports

```typescript
// features/{feature}/index.ts
export { FeatureComponent } from "./components";
export { useFeature } from "./hooks";
```

### 3. Create Route

```typescript
// routes/_dashboard.{feature}.tsx
import { createFileRoute } from "@tanstack/react-router";
import { FeaturePage } from "@/features/{feature}";

export const Route = createFileRoute("/_dashboard/{feature}")({
  component: FeaturePage,
});
```

### 4. Add to Navigation

Update `features/dashboard/components/sidebar-data.ts`.

---

## See Also

- [System Overview](./system-overview.md) - High-level architecture
- [Package Dependencies](./packages.md) - Monorepo package structure
- [Data Flows](./data-flows.md) - Key data flow diagrams
- [Component Organization Guide](../guides/component-organization.md)
- [Adding New Node Type](../guides/adding-new-node-type.md)
- [Adding Node Features](../guides/adding-node-features.md)
- [Web App README](../../web/README.md)
