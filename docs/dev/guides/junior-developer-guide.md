# Junior Developer Guide

Welcome to Journey Builder! This guide will help you navigate the codebase and avoid common pitfalls.

> **Core Philosophy**: Search before you create. Most functionality already exists.

For code standards and patterns, see [CLAUDE.md](/CLAUDE.md) in the project root.

---

## The Discovery-First Rule

**Before writing ANY new code, follow these 5 steps:**

```
┌─────────────────────────────────────────────────────────────────┐
│                    SHOULD I CREATE NEW CODE?                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Search for existing code  ──────────────────► Found? ──► USE IT
│         │                                            │
│         ▼ Not found                                  │
│  2. Check shared utilities  ────────────────────► Found? ──► USE IT
│         │                                            │
│         ▼ Not found                                  │
│  3. Review similar feature code  ───────────────► Found? ──► ADAPT IT
│         │                                            │
│         ▼ Not found                                  │
│  4. Ask teammate if unsure  ────────────────────► Exists? ──► USE IT
│         │                                            │
│         ▼ Confirmed doesn't exist                    │
│  5. CREATE NEW CODE (following patterns)             │
│                                                      │
└─────────────────────────────────────────────────────────────────┘
```

### Why This Matters

- **Consistency**: Existing code follows established patterns
- **Tested**: Existing code is already tested and proven
- **Maintainable**: One implementation is easier to maintain than duplicates
- **Faster**: Using existing code is faster than writing new code

---

## Search Commands

Use these commands to find existing code before creating new:

### Find Components

```bash
# Find a component by name
grep -rn "ComponentName" apps/web/src --include="*.tsx"

# List all React components in a feature
find apps/web/src/features/journey -name "*.tsx" -type f | head -30

# Find components using a specific prop
grep -rn "propName=" apps/web/src --include="*.tsx"
```

### Find Hooks

```bash
# List all custom hooks in the project
find apps/web -name "use-*.ts" -type f

# Find hooks by functionality
grep -rn "useQuery" apps/web/src --include="*.ts"
grep -rn "useMutation" apps/web/src --include="*.ts"

# Find hooks in shared directory
ls apps/web/src/shared/hooks/
ls apps/web/src/hooks/queries/
```

### Find Types

```bash
# Search in schemas (single source of truth)
grep -rn "TypeName" packages/schemas/src

# Find Zod schemas
grep -rn "z.object" packages/schemas/src --include="*.ts"

# Find type exports
grep -rn "export type" packages/schemas/src
```

### Find Services & API

```bash
# Find API endpoints
grep -rn "createProtectedRouter" apps/api/src/modules --include="routes.ts"

# Find module services
ls apps/api/src/modules/

# Find API client methods
grep -rn "apiClient\." apps/web/src --include="*.ts"
```

### Find Similar Patterns

```bash
# Search for any pattern across codebase
grep -rn "pattern keyword" . --include="*.ts" --include="*.tsx"

# Search in specific directory
grep -rn "pattern" apps/web/src/features/crm

# Find files containing multiple terms
grep -rln "term1" . | xargs grep -l "term2"
```

---

## Codebase Map

```
journey/
├── apps/
│   ├── web/src/                    # Frontend (React)
│   │   ├── features/               # Feature modules (main code lives here)
│   │   │   ├── journey/            # Journey builder, nodes, simulator
│   │   │   ├── agent-workflows/    # Agent workflow builder
│   │   │   ├── crm/                # CRM, clients, pipelines
│   │   │   ├── dashboard/          # Shell, sidebar, navigation
│   │   │   ├── mindstate/          # Mindstate builder
│   │   │   ├── settings/           # Settings pages
│   │   │   ├── developers/         # Developer tools
│   │   │   └── auth/               # Authentication
│   │   ├── shared/                 # Reusable components & utilities
│   │   │   ├── components/ui/      # shadcn/ui primitives
│   │   │   ├── components/         # Domain components (2+ features)
│   │   │   ├── hooks/              # Shared hooks
│   │   │   └── lib/                # Utilities, API client
│   │   ├── stores/                 # Global state (7 stores)
│   │   ├── hooks/                  # App-wide hooks
│   │   │   └── queries/            # TanStack Query hooks
│   │   └── routes/                 # TanStack Router pages
│   │
│   └── api/src/                    # Backend (Hono)
│       ├── modules/                # Domain routes + services (vertical slices)
│       ├── services/               # Cross-cutting services (timers, cache, runtime)
│       ├── events/                 # Event bus + consumers
│       └── lib/                    # Shared backend utilities
│
├── packages/
│   ├── schemas/                    # Shared types (SINGLE SOURCE OF TRUTH)
│   │   └── src/
│   │       ├── errors/             # Domain error classes
│   │       ├── nodes/              # Node type schemas
│   │       ├── variables/          # Variable system
│   │       ├── events/             # Event types
│   │       └── services/           # Service interfaces
│   ├── engine/                     # Journey execution engine
│   └── logger/                     # Structured logging
│
└── docs/
    └── dev/
        ├── architecture/           # System design docs
        └── guides/                 # How-to guides (you are here)
```

### Where to Look First

| What You Need     | Where to Look                        | Example Files              |
| ----------------- | ------------------------------------ | -------------------------- |
| Types & Schemas   | `packages/schemas/src/`              | `journey.ts`, `nodes/*.ts` |
| UI Components     | `apps/web/src/shared/components/ui/` | `button.tsx`, `dialog.tsx` |
| Domain Components | `apps/web/src/shared/components/`    | `template-textarea.tsx`    |
| Shared Hooks      | `apps/web/src/shared/hooks/`         | `use-debounce.ts`          |
| Query Hooks       | `apps/web/src/hooks/queries/`        | `use-tags.ts`              |
| Feature Hooks     | `apps/web/src/features/*/hooks/`     | `use-simulator.ts`         |
| Global Stores     | `apps/web/src/stores/`               | `ui-store.ts`              |
| API Client        | `apps/web/src/shared/lib/api/`       | `journeys.ts`              |
| Backend Services  | `apps/api/src/modules/`              | `journeys/journey-service.ts` |
| Error Classes     | `packages/schemas/src/errors/`       | `index.ts`                 |
| Utilities         | `apps/web/src/shared/lib/utils/`     | `date-utils.ts`            |

---

## Reusable Code Catalog

### UI Components (shadcn/ui)

Located in `apps/web/src/shared/components/ui/`:

| Component       | Use For                                                      |
| --------------- | ------------------------------------------------------------ |
| `button`        | All buttons (variants: default, destructive, outline, ghost) |
| `dialog`        | Modal dialogs                                                |
| `alert-dialog`  | Confirmation dialogs                                         |
| `sheet`         | Side panels                                                  |
| `drawer`        | Bottom/side drawers                                          |
| `popover`       | Floating content                                             |
| `dropdown-menu` | Context menus, actions menu                                  |
| `select`        | Dropdown selection                                           |
| `input`         | Text input                                                   |
| `textarea`      | Multi-line text                                              |
| `checkbox`      | Checkboxes                                                   |
| `switch`        | Toggle switches                                              |
| `tabs`          | Tab navigation                                               |
| `card`          | Content cards                                                |
| `table`         | Basic tables                                                 |
| `badge`         | Labels, tags                                                 |
| `avatar`        | User avatars                                                 |
| `tooltip`       | Hover tooltips                                               |
| `skeleton`      | Loading placeholders                                         |
| `scroll-area`   | Scrollable containers                                        |
| `separator`     | Visual dividers                                              |
| `collapsible`   | Expandable sections                                          |
| `command`       | Command palette, search                                      |
| `calendar`      | Date picker                                                  |

### Domain Components

Located in `apps/web/src/shared/components/`:

| Component                    | Use For                                    |
| ---------------------------- | ------------------------------------------ |
| `template-textarea`          | Text with variable interpolation `{{var}}` |
| `markdown-template-textarea` | Markdown + variable templates              |
| `template-input`             | Input with variable support                |
| `auto-resize-textarea`       | Auto-growing textarea                      |
| `data-table`                 | Tables with sorting, filtering, pagination |
| `data-table-pagination`      | Table pagination controls                  |
| `json-view`                  | JSON visualization                         |
| `tag-selector`               | Multi-tag selection                        |
| `tag-badge`                  | Tag display                                |
| `variable-selector-popover`  | Variable picker                            |
| `delete-confirm-dialog`      | Delete confirmation                        |
| `media-upload`               | File upload                                |
| `avatar-upload`              | Avatar upload                              |
| `loading-spinner`            | Loading indicator                          |
| `error-boundary`             | Error handling wrapper                     |
| `markdown-content`           | Markdown rendering                         |

### Shared Hooks

Located in `apps/web/src/shared/hooks/`:

| Hook                            | Use For                                 |
| ------------------------------- | --------------------------------------- |
| `useDebounce(value, delay)`     | Debounce input values                   |
| `useDialogState()`              | Dialog open/close state                 |
| `useSimpleDialogState()`        | Simple boolean dialog state             |
| `useIsMobile()`                 | Mobile viewport detection               |
| `useSSEConnection()`            | Server-sent events connection           |
| `useAudioRecorder()`            | Audio recording                         |
| `useAudioPlayer()`              | Audio playback                          |
| `useDurationField()`            | Duration input state                    |
| `useUnsavedChangesProtection()` | Prevent navigation with unsaved changes |
| `useKeyboardShortcuts()`        | Register keyboard shortcuts             |

### Query Hooks

Located in `apps/web/src/hooks/queries/`:

| Hook                       | Use For                     |
| -------------------------- | --------------------------- |
| `useTags()`                | Fetch all tags              |
| `useChannels()`            | Fetch channels              |
| `useVariables()`           | Fetch variables             |
| `useEvents()`              | Fetch events                |
| `useJourneyConfig()`       | Fetch journey configuration |
| `useModels()`              | Fetch LLM models            |
| `useMediaGallery()`        | Fetch media items           |
| `useActiveSessionsCount()` | Fetch active sessions count |
| `useUpload()`              | Handle file uploads         |

### Error Classes

Located in `packages/schemas/src/errors/`:

| Error Class               | HTTP Code | Use For                  |
| ------------------------- | --------- | ------------------------ |
| `ValidationError`         | 400       | Invalid input data       |
| `BadRequestError`         | 400       | Malformed requests       |
| `UnauthorizedError`       | 401       | Missing authentication   |
| `ForbiddenError`          | 403       | Insufficient permissions |
| `NotFoundError`           | 404       | Resource not found       |
| `ConflictError`           | 409       | Resource conflicts       |
| `RateLimitError`          | 429       | Rate limit exceeded      |
| `ServiceUnavailableError` | 503       | Service down             |

**Always use domain errors:**

```typescript
// ❌ Wrong
throw new Error("Journey not found");

// ✅ Correct
throw new NotFoundError("Journey", journeyId);
```

### Utilities

| Utility                             | Location                     | Use For                  |
| ----------------------------------- | ---------------------------- | ------------------------ |
| `createLogger(scope)`               | `@journey/logger`            | Structured logging       |
| `serializeError(err)`               | `@journey/logger`            | Safe error serialization |
| `notify.success/error/warning/info` | `shared/lib/ui/notify`       | Toast notifications      |
| `authFetch(url, options)`           | `shared/lib/api/base`        | Authenticated API calls  |
| `journeyKeys`, `tagKeys`, etc.      | `shared/lib/query-keys`      | Query cache keys         |
| `createMutation()`                  | `shared/lib/create-mutation` | Standardized mutations   |

### Store Patterns

Located in `apps/web/src/stores/patterns/`:

| Pattern                       | Use For                                 |
| ----------------------------- | --------------------------------------- |
| `createCRUDCapability()`      | Add, update, remove, getById operations |
| `createHistoryCapability()`   | Undo/redo functionality                 |
| `createSelectionCapability()` | Selection state management              |

---

## Patterns to Follow

### Store Communication

Stores never import each other. Use the event bus:

```typescript
// ✅ Emit event after mutation
journeyNodesStore.setState((s) => ({ ...s, nodes: newNodes }));
storeEventBus.emit({ type: "node:added", payload: { node } });

// ✅ Subscribe in another store
storeEventBus.on("node:deleted", (event) => {
  if (selectedId === event.payload.nodeId) {
    clearSelection();
  }
});
```

### API Route Services

Use the service container in API routes. Do not import `db` directly in routes.

```typescript
import { createServicesFromContext } from "../../services";

router.get("/", async (c) => {
  const services = createServicesFromContext(c);
  const data = await services.variable.getGlobalVariables();
  return c.json({ data });
});
```

### Logging

Never use `console.log`. Use structured logging:

```typescript
import { createLogger, serializeError } from "@journey/logger";

const log = createLogger("my-service");

// ✅ Correct
log.info({ userId, journeyId }, "service:actionCompleted");
log.error({ err: serializeError(error), userId }, "service:actionFailed");

// ❌ Wrong
console.log("something happened", data);
```

### Error Handling

Throw domain-specific errors:

```typescript
import { NotFoundError, BadRequestError } from "@journey/schemas";

// ✅ Correct
if (!journey) {
  throw new NotFoundError("Journey", journeyId);
}

if (!isValid) {
  throw new BadRequestError("Invalid input", { field: "email" });
}
```

### Toast Notifications

Use the notify utility:

```typescript
import { notify } from "@/shared/lib/ui/notify";

// ✅ Correct
notify.success("Saved successfully");
notify.error("Failed to save", { description: "Please try again" });

// ❌ Wrong
alert("Saved!");
window.confirm("Are you sure?");
```

### Types

Always import from `@journey/schemas`:

```typescript
// ✅ Correct - single source of truth
import type { JourneyNode, NodeType, MessageNodeData } from "@journey/schemas";

// ❌ Wrong - duplicate definition
interface MyJourneyNode { ... }
```

### API Queries

Use existing query hooks or create with the factory:

```typescript
import { useQuery } from "@tanstack/react-query";
import { tagKeys } from "@/shared/lib/query-keys";

export function useTags() {
  return useQuery({
    queryKey: tagKeys.global(),
    queryFn: () => apiClient.getTags(),
  });
}
```

---

## Adding New Code

When you've confirmed new code is needed, follow this checklist:

### Pre-Creation Checklist

- [ ] Searched for existing similar code
- [ ] Checked shared components/utilities
- [ ] Reviewed how similar features are implemented
- [ ] Asked a teammate if unsure
- [ ] Identified the correct location for new code

### Creation Checklist

- [ ] Created files in the correct directory
- [ ] Used kebab-case for file names (`my-component.tsx`)
- [ ] Followed existing patterns in similar code
- [ ] Imported types from `@journey/schemas`
- [ ] Used `createLogger()` for logging
- [ ] Used domain errors for error handling
- [ ] Used `notify` for user feedback

### Post-Creation Checklist

- [ ] Added barrel exports if needed (`index.ts`)
- [ ] Ran `pnpm typecheck`
- [ ] Ran relevant tests
- [ ] Updated docs if adding public APIs

---

## Common Mistakes

### 1. Duplicating Types

```typescript
// ❌ Wrong - duplicate definition
interface MessageNodeData {
  content: string;
  buttons?: Button[];
}

// ✅ Correct - import from schemas
import type { MessageNodeData } from "@journey/schemas";
```

### 2. Using console.log

```typescript
// ❌ Wrong
console.log("Debug:", data);
console.error("Failed:", error);

// ✅ Correct
const log = createLogger("component");
log.debug({ data }, "component:debug");
log.error({ err: serializeError(error) }, "component:failed");
```

### 3. Generic Errors

```typescript
// ❌ Wrong
throw new Error("Not found");

// ✅ Correct
throw new NotFoundError("Journey", journeyId);
```

### 4. Direct Store Imports

```typescript
// ❌ Wrong - direct import between stores
import { uiStore } from "./ui-store";
uiStore.setState(...);

// ✅ Correct - use event bus
storeEventBus.emit({ type: "selection:cleared", payload: {} });
```

### 5. Creating Duplicate Components

```typescript
// ❌ Wrong - custom delete dialog
function MyDeleteDialog({ onConfirm }) {
  return <Dialog>Are you sure?...</Dialog>;
}

// ✅ Correct - use existing component
import { DeleteConfirmDialog } from "@/shared/components/delete-confirm-dialog";
```

### 6. Alert/Confirm Dialogs

```typescript
// ❌ Wrong
alert("Saved!");
if (window.confirm("Delete?")) { ... }

// ✅ Correct
notify.success("Saved!");
// Use DeleteConfirmDialog component
```

### 7. Backward Compatibility Code

```typescript
// ❌ Wrong - we don't need this (MVP project)
const data = newFormat ?? legacyFormat ?? oldFormat;

// ✅ Correct - just use current format
const data = currentFormat;
```

---

## Commands Reference

### Always Run First

```bash
pnpm typecheck        # Check TypeScript types (~20s)
```

### Testing

```bash
pnpm test:quick       # Fast feedback (~30s, ~400 tests)
pnpm test:unit        # Pre-commit validation (~1min, ~880 tests)
pnpm test:backend     # Backend only (~2min)
pnpm test:frontend    # Frontend only (~3min)
pnpm test:integration # API/service changes (~2min)
pnpm test:e2e         # Full E2E (~3min)
```

### Engine Testing

```bash
# Test engine against real journey files
pnpm blade-runner apps/web/src/data/journeys/saas-onboarding/journey.json --thorough
```

### Database

```bash
# Reset and seed database (instead of complex migrations)
pnpm db:reset-full

# Direct database access
PGPASSWORD=journey_dev psql -h localhost -U journey -d journey
```

---

## Related Documentation

- [CLAUDE.md](/CLAUDE.md) - Code standards and patterns
- [Component Organization](./component-organization.md) - Feature-first architecture
- [Store Initialization](./store-initialization.md) - Store architecture
- [Adding New Node Type](./adding-new-node-type.md) - Node plugin system
- [Project Structure](../architecture/project-structure.md) - Complete structure reference
