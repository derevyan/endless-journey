# Component Organization Guide

How components are organized in the Journey Builder web application.

> For complete project structure details, see [Project Structure](../architecture/project-structure.md).

## Architecture Overview

The web app uses a **feature-first architecture**. Most code lives in `features/`, not root-level components.

```
apps/web/src/
├── features/         # Feature modules (main code lives here)
│   ├── agent-workflows/
│   ├── auth/
│   ├── crm/
│   ├── dashboard/
│   ├── developers/
│   ├── journey/
│   ├── mindstate/
│   ├── settings/
│   └── users/
├── shared/           # Shared utilities & components
│   └── components/   # Shared UI primitives + reusable domain components
└── routes/           # TanStack Router pages
```

---

## Feature Modules

Each feature is self-contained with its own components, hooks, and utilities.

### Structure

```
features/{feature}/
├── components/       # Feature UI components
│   ├── {component}.tsx
│   └── index.ts      # Barrel export
├── hooks/            # Feature hooks
│   ├── queries/      # TanStack Query hooks
│   └── index.ts
├── lib/              # Feature utilities
│   └── index.ts
├── store/            # Feature store (if needed)
│   └── index.ts
└── index.ts          # Public API
```

### Current Features

| Feature | Purpose |
|---------|---------|
| `journey` | Journey builder canvas, nodes, simulator |
| `agent-workflows` | Agent workflow builder and approvals |
| `mindstate` | Mindstate definition builder |
| `dashboard` | Shell, sidebar, navigation, header |
| `settings` | Application settings pages |
| `users` | User management table |
| `crm` | CRM, clients, pipelines |
| `developers` | Developer tools, event viewer |
| `auth` | Auth flows and session wiring |

---

## Component Categories

### 1. Feature Components (`features/{feature}/components/`)

Most components live here. Organized by feature.

**Examples:**
- `features/journey/builder/components/journey-canvas.tsx`
- `features/journey/simulator/components/chat/chat-window.tsx`
- `features/dashboard/components/app-sidebar.tsx`

**Rules:**
- Keep components with their feature
- Can import from `@/shared/components/ui` and `@/shared/components`
- Avoid importing from other features (use public API if needed)

### 2. Node Components (`features/nodes/journey/`)

Node-related components have their own directory due to the plugin architecture.

```
features/nodes/journey/
├── components/       # React Flow node visuals
│   ├── base-node.tsx
│   ├── message-node.tsx
│   └── ...
├── editors/          # Node editor panels
│   ├── message-node-editor.tsx
│   └── sections/     # Reusable editor sections
└── ...
```

### 3. UI Primitives (`shared/components/ui/`)

**shadcn/ui components ONLY.** No business logic.

**Examples:** `button.tsx`, `dialog.tsx`, `panel-surface.tsx`, `settings-dialog.tsx`, `table.tsx`, `input.tsx`

**Rules:**
- Keep generic and reusable
- Use shadcn MCP to add new components
- Don't add business logic

### 4. Shared Components (`shared/components/`)

Components used across multiple features.

```
shared/components/
├── common/           # Error boundary, loading, etc.
├── layout/           # Layout primitives
├── ui/               # shadcn/ui primitives
└── {component}.tsx   # Shared domain components (used by 2+ features)
```

**Rules:**
- Must be used by 2+ features
- No feature-specific logic

---

## Routes

TanStack Router file-based routing. Routes compose feature components.

```
routes/
├── __root.tsx                    # Root layout
├── _dashboard.tsx                # Dashboard layout
├── _dashboard.journeys.tsx       # Journey builder
├── _dashboard.settings.tsx       # Settings layout
├── _dashboard.settings.*.tsx     # Settings pages
└── ...
```

**Important:** Route files should be thin. They define the route and compose components, but logic lives in features.

```typescript
// routes/_dashboard.journeys.tsx
import { createFileRoute } from "@tanstack/react-router";
import { JourneyCanvas } from "@/features/journey";
import { AppLayout } from "@/shared/components/layout/app-layout-primitives";

export const Route = createFileRoute("/_dashboard/journeys")({
  component: () => (
    <AppLayout>
      <JourneyCanvas />
    </AppLayout>
  ),
});
```

---

## Hooks Organization

Hooks are split between app-wide and feature-specific.

### App-Wide (`hooks/`)

```
hooks/
├── queries/        # TanStack Query - data fetching
├── navigation/     # Route navigation
└── use-*.ts        # Utility hooks
```

### Feature-Specific (`features/{feature}/hooks/`)

```
features/journey/simulator/hooks/
├── use-simulator.ts
├── use-simulator-timers.ts
└── index.ts
```

---

## Adding New Features

### 1. Create Feature Structure

```bash
mkdir -p features/{feature}/components
mkdir -p features/{feature}/hooks
```

### 2. Create Components

```typescript
// features/{feature}/components/feature-page.tsx
export function FeaturePage() {
  return (
    <div className="p-6">
      <h1>Feature</h1>
    </div>
  );
}

// features/{feature}/components/index.ts
export { FeaturePage } from "./feature-page";
```

### 3. Create Feature Index

```typescript
// features/{feature}/index.ts
export { FeaturePage } from "./components";
```

### 4. Create Route

```typescript
// routes/_dashboard.{feature}.tsx
import { createFileRoute } from "@tanstack/react-router";
import { FeaturePage } from "@/features/{feature}";

export const Route = createFileRoute("/_dashboard/{feature}")({
  component: FeaturePage,
});
```

### 5. Add to Sidebar

Update `features/dashboard/components/sidebar-data.ts`:

```typescript
{
  title: "Feature",
  url: "/feature",
  icon: IconName,
}
```

---

## Best Practices

1. **Feature-first** - Put code in features, not root directories
2. **Single responsibility** - Each component does one thing
3. **Composition** - Build complex UIs from simple components
4. **Co-location** - Keep related code together
5. **Barrel exports** - Use index.ts for public APIs
6. **kebab-case** - All file names: `user-table.tsx`, not `UserTable.tsx`

---

## Reusable Components Reference

Before creating new components, check if one exists:

| Need | Use |
|------|-----|
| Table with pagination | `@/shared/components/ui/data-table-pagination` |
| Stats display | `@/features/dashboard/components/stats-card` |
| Loading state | `@/shared/components/common/loading-spinner` |
| Error handling | `@/shared/components/common/error-boundary` |
| Toast notifications | `@/shared/lib/ui/notify` |

---

## See Also

- [Project Structure](../architecture/project-structure.md) - Complete structure reference
- [Adding New Node Type](./adding-new-node-type.md) - Node plugin system
- [Adding Node Features](./adding-node-features.md) - Node feature flags
