# Journey Web App

React-based web application for building and managing journeys.

## Overview

The web app provides:

- **Visual journey builder** with drag-and-drop nodes
- **Backend-powered simulator** with SSE events, playback, and personas
- **Agent workflow builder** for LLM flows and approvals
- **CRM pipelines** and client messaging
- **MindState builder** for definitions and previews
- **Settings** for channels, tags, variables, and appearance
- **Users & org management** plus developer event viewer

## Tech Stack

- **React** - UI framework
- **TanStack Router** - File-based routing
- **TanStack Query** - Server state management
- **TanStack Store** - Client state management
- **TanStack Form** - Editor form state + validation
- **React Flow** - Node-based visual editor
- **shadcn/ui** - UI component library
- **Tailwind CSS** - Styling (v4)
- **Vite** - Build tool

## Architecture

> For complete structure details, see [Project Structure](../dev/architecture/project-structure.md).

### Component Organization

The web app uses a **feature-first architecture**. Most code lives in `features/`.

```
src/
├── features/             # Feature modules (main code)
│   ├── journey/          # Journey builder, canvas, simulator
│   ├── agent-workflows/  # Agent workflow builder
│   ├── auth/             # Login and session wiring
│   ├── mindstate/        # Mindstate configuration
│   ├── dashboard/        # Dashboard shell & navigation
│   ├── settings/         # Application settings
│   ├── users/            # User management
│   ├── crm/              # CRM & clients
│   └── developers/       # Developer tools
├── shared/               # Shared utilities, components, API
├── hooks/                # App-wide query hooks
├── providers/            # App providers (theme, events, journey data)
└── stores/               # TanStack Store (centralized)
```

### Store Architecture

Core stores (centralized in `apps/web/src/stores/`):

| Store                 | Responsibility                         |
| --------------------- | -------------------------------------- |
| `journey-nodes-store` | Nodes/edges data with undo/redo        |
| `ui-store`            | Edit mode, selections, dialogs, panels |
| `version-store`       | Version history management             |
| `user-store`          | Current authenticated user state       |

Feature stores (scoped to a single feature):

| Store                  | Location                            | Responsibility                   |
| ---------------------- | ----------------------------------- | -------------------------------- |
| `custom-journey-store` | `features/journey/builder/store/`   | Cached journey config + metadata |
| `simulator-store`      | `features/journey/simulator/store/` | Simulator state + playback       |
| `journey-header-store` | `features/dashboard/store/`         | Header controls + save status    |
| `mindstate-header-store` | `features/dashboard/store/`       | MindState header controls        |
| `agent-workflow-store` | `features/agent-workflows/stores/`  | Agent workflow builder           |
| `agent-test-store`     | `features/agent-workflows/stores/`  | Agent workflow testing           |
| `builder-store`        | `features/mindstate/stores/`        | MindState builder UI state       |

**Store infrastructure:**

| File                 | Purpose                                            |
| -------------------- | -------------------------------------------------- |
| `store-actions.ts`   | Cross-store coordination actions                   |
| `store-event-bus.ts` | Type-safe event bus for store communication        |
| `event-bridge.ts`    | SSE → store event bridge for real-time sync        |
| `patterns/`          | Reusable store patterns (history, CRUD, selection) |

**Rules:**

- Single-store operations go in the store file itself
- Cross-store coordination goes through `store-actions.ts` and event bus
- Stores emit events via `store-event-bus.ts`, never import other stores
- Use `useStore(store, selector)` for reactive subscriptions

#### Dependency Injection for Actions

Editor components use **dependency injection** via React context instead of direct store imports. This enables:

- **Component isolation** - Editors can be rendered without stores
- **Testability** - Mock actions for unit tests and Storybook
- **Cleaner interfaces** - Explicit dependencies instead of implicit imports

```typescript
// In your node editor component
import { useEditorActionsContext } from "@/features/journey/builder/context";

function MyNodeEditor({ node }: NodeEditorProps) {
  const { updateNode, deleteNode, notify } = useEditorActionsContext();

  const handleSave = (data) => {
    updateNode(node.id, { data });
    notify.success("Saved!");
  };
}
```

**Available actions:**

| Action              | Description                                         |
| ------------------- | --------------------------------------------------- |
| `updateNode`        | Update node data and sync related state             |
| `deleteNode`        | Delete node and clear UI selection                  |
| `updateEdge`        | Update edge data                                    |
| `deleteEdge`        | Delete edge with sync (handles managed edges)       |
| `deleteEdgeRaw`     | Raw edge deletion without side effects              |
| `setButtonTarget`   | Set/clear button target node                        |
| `setPendingChanges` | Mark journey as having unsaved changes              |
| `clearSelection`    | Clear current selection                             |
| `notify`            | Toast notifications (success, error, warning, info) |

**When to use `deleteEdgeRaw`:** Use when your form manages button state and you need to delete the edge without triggering `clearButtonTargetNodeOnly()` which would reset your form state.

See [Adding New Node Type Guide](../dev/guides/adding-new-node-type.md) for implementation details.

### Hooks Organization

Hooks are split between app-wide and feature-specific:

```
src/hooks/                    # App-wide hooks (queries only)
├── queries/                  # TanStack Query - shared data fetching
│   ├── use-journey-config.ts
│   ├── use-journey-list-manifest.ts
│   ├── use-tags.ts
│   └── ...

src/features/{feature}/hooks/ # Feature-specific hooks
├── use-{feature}.ts
└── index.ts

src/shared/hooks/             # Cross-feature utility hooks
├── use-debounce.ts
├── use-sse-connection.ts
├── use-dialog-state.ts
└── ...
```

## Node Plugin System

Nodes are defined using a plugin architecture with auto-registration.

### Node Definition

```typescript
// src/features/nodes/journey/types/message/descriptor.ts
const messageFrontendDescriptor: FrontendNodeDescriptor<MessageNodeData> = {
  ...messageNodeDescriptor,
  icon: MessageSquare,
  colors: getNodeTheme("message"),
  component: MessageNode,
  editor: MessageNodeEditor,
  formHandlers: messageFormHandlers,
};

nodeRegistry.register(messageFrontendDescriptor);
```

### Node Component

```typescript
// src/features/nodes/journey/types/message/component.tsx
export const MessageNode = memo(function MessageNode({ data }: { data: MessageNodeData }) {
  return <BaseNode nodeType={NodeTypeEnum.MESSAGE} label={data.label} />;
});
```

### Node Editor

```typescript
// src/features/nodes/journey/types/message/editor.tsx
export function MessageNodeEditor({ node, onClose }: NodeEditorProps) {
  // Form for editing node properties
}
```

See [Adding New Node Type Guide](../dev/guides/adding-new-node-type.md) for details.

## Routes

File-based routing with TanStack Router:

```
src/routes/
├── __root.tsx                    # Root layout
├── _dashboard.tsx                 # Dashboard layout
├── _dashboard.index.tsx           # Dashboard home
├── _dashboard.journeys.tsx        # Journey list
├── _dashboard.journeys.$journeySlug.tsx # Journey builder
├── _dashboard.agents.tsx          # Agent workflows layout
├── _dashboard.agents.index.tsx    # Agent workflows list
├── _dashboard.agents.$agentKey.tsx # Agent workflow builder
├── _dashboard.crm.tsx             # CRM layout
├── _dashboard.crm.index.tsx       # CRM pipelines
├── _dashboard.crm.users.$userId.tsx # CRM user detail
├── _dashboard.mindstate.tsx       # MindState layout
├── _dashboard.mindstate.index.tsx # MindState list
├── _dashboard.mindstate.$definitionId.tsx # MindState builder
├── _dashboard.settings.tsx        # Settings layout
├── _dashboard.settings.profile.tsx
├── _dashboard.settings.organisation.tsx
├── _dashboard.settings.tags.tsx
├── _dashboard.settings.variables.tsx
├── _dashboard.settings.channels.tsx
├── _dashboard.settings.appearance.tsx
├── _dashboard.settings.import-export.tsx
├── _dashboard.settings.journey-pipelines.tsx
├── _dashboard.settings.journey-mindstate.tsx
├── _dashboard.users.tsx           # Users page
├── _dashboard.developers.events.tsx # Developer events viewer
├── 401.tsx                        # Unauthorized
├── 403.tsx                        # Forbidden
├── 404.tsx                        # Not found
├── 503.tsx                        # Service unavailable
└── ...
```

## Journey Builder

### Canvas

The journey canvas uses React Flow:

```typescript
import { ReactFlow } from "@xyflow/react";

<ReactFlow
  nodes={nodes}
  edges={edges}
  onNodesChange={handleNodesChange}
  onEdgesChange={handleEdgesChange}
  // ...
/>;
```

### Node Editor Panel

Side panel for editing selected node:

```typescript
<NodeEditorPanel>{selectedNode && <NodeEditor nodeId={selectedNode.id} />}</NodeEditorPanel>
```

### Undo/Redo

Provided by `journey-nodes-store`:

```typescript
const { undo, redo, canUndo, canRedo } = useJourneyNodesStore();
```

## Simulator

Real-time journey testing:

### Features

- **Event log** - All interaction events
- **Timer display** - Active timers
- **Playback controls** - Step through execution

### Usage

```typescript
import { useBackendSimulator } from "@/features/journey/simulator/hooks";

const { startSession, sendMessage, handleButtonClick, eventLog } = useBackendSimulator({
  journeyId,
});
```

## API Client

Centralized API client split into domain modules:

```typescript
// Import from shared lib
import { apiClient } from "@/shared/lib/api";

const journeys = await apiClient.getJourneys();
const journey = await apiClient.createJourney({ name, configuration });

// Or import domain-specific APIs
import { journeysApi, channelsApi, sessionsApi } from "@/shared/lib/api";
import { workflowsApi } from "@/shared/lib/api/workflows";
import { workflowVersionsApi } from "@/shared/lib/api/workflow-versions";
```

Domain modules: `journeys`, `channels`, `sessions`, `users`, `media`, `variables`, `tags`, `versions`, `events`, `crm`, `mindstate`, `audio`, `workflows`, `workflow-versions`.

## Authentication

Better Auth client:

```typescript
import { authClient } from "@/shared/lib/auth-client";

await authClient.signIn.email({ email, password });
await authClient.signOut();
const session = await authClient.getSession();
```

## Styling

### Tailwind CSS

Global styles in `src/index.css`:

- shadcn/ui base styles
- Custom journey builder styles
- Dark mode support

### Theme

Theme is handled by `ThemeProvider` (`next-themes`) in `src/providers/theme-provider.tsx`.

## File Structure

```
apps/web/src/
├── features/                 # Feature modules (main code)
│   ├── journey/              # Journey builder & simulator
│   │   ├── builder/          # Canvas, toolbar, header
│   │   ├── simulator/        # Simulator panel
│   │   └── nodes/            # Node plugin system
│   │       ├── components/   # React Flow node visuals
│   │       ├── definitions/  # Node type configs
│   │       └── editors/      # Node editor panels
│   ├── agent-workflows/      # Visual workflow builder
│   │   ├── components/       # Workflow canvas & nodes
│   │   └── stores/           # Workflow-specific state
│   ├── auth/                 # Login/session UI
│   ├── mindstate/            # Mindstate configuration
│   ├── dashboard/            # Dashboard shell
│   ├── settings/             # Application settings
│   ├── users/                # User management
│   ├── crm/                  # CRM & clients
│   └── developers/           # Developer tools
├── shared/                   # Shared utilities & API client
│   ├── components/           # Shared UI + domain components
│   ├── hooks/                # Shared utility hooks
│   └── lib/                  # Core utilities (API, events, config)
├── hooks/                    # App-wide query hooks
├── stores/                   # TanStack Store (centralized)
│   ├── patterns/             # Reusable store patterns
│   ├── journey-nodes-store.ts
│   ├── ui-store.ts
│   ├── user-store.ts
│   ├── version-store.ts
│   ├── store-event-bus.ts
│   ├── event-bridge.ts
│   └── store-actions.ts
├── providers/                # Context providers
├── routes/                   # TanStack Router routes
├── data/                     # Static journey templates
├── routeTree.gen.ts          # Router-generated route tree
└── main.tsx                  # Entry point
```

See [Project Structure](../dev/architecture/project-structure.md) for complete details.

## Environment Variables

```env
VITE_API_URL=http://localhost:3001
```

## Development

### Start Dev Server

```bash
pnpm --filter @journey/web dev
```

Runs on `http://localhost:3000`

### Build

```bash
pnpm --filter @journey/web build
```

### Test

```bash
pnpm --filter @journey/web test
```

## Testing

### Unit Tests

Vitest for component and hook testing:

```typescript
import { describe, it, expect } from "vitest";

describe("Component", () => {
  it("should render", () => {
    // ...
  });
});
```

### E2E Tests

Playwright for end-to-end testing:

```typescript
import { test, expect } from "@playwright/test";

test("journey builder", async ({ page }) => {
  await await page.goto("/journeys/saas-onboarding");
  // ...
});
```

## See Also

- [Project Structure](../dev/architecture/project-structure.md) - Complete structure reference
- [Component Organization Guide](../dev/guides/component-organization.md)
- [Adding New Node Type Guide](../dev/guides/adding-new-node-type.md)
- [Frontend Events System](./events-consumer.md)
- [TanStack Router](https://tanstack.com/router)
- [React Flow](https://reactflow.dev/)
