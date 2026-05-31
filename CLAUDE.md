# Journey Builder - Junior Developer Guide

> Quick reference for writing clean, consistent code. Read this before your first commit.
>
> 📖 For detailed explanations, see the full guide: `docs/dev/guides/junior-developer-guide.md`

---

## Quick Start Checklist

### Before Writing Code

- [ ] Read existing similar code first (components, services, hooks)
- [ ] Check types exist in `@journey/schemas` before creating new ones
- [ ] Understand which store owns the data you're working with
- [ ] Know where your code should live (see "Where Code Lives" below)

### After Writing Code

- [ ] Run `pnpm typecheck` - must pass
- [ ] Run `pnpm --filter @journey/web lint` - must pass with 0 warnings
- [ ] Run relevant tests (`pnpm test:unit` or `pnpm test:backend`)
- [ ] No `console.log` - use `@journey/logger`
- [ ] No duplicate types - import from `@journey/schemas`
- [ ] Files use kebab-case naming

> **Lint runs in CI with `--max-warnings 0`** - any warnings will block your PR from merging.

### Before Committing (Pre-commit Cleanup)

**Important:** The pre-commit hook is disabled, but **CI enforces `--max-warnings 0`**. This means:

- **Errors block PR merge** - must be fixed
- **Warnings block PR merge** - must be fixed or suppressed
- **Run lint locally** before pushing to avoid CI failures

#### Step 1: Check Staged Files for Issues

```bash
# From project root - check only staged files
git diff --cached --name-only | xargs pnpm eslint

# Or check entire web app
pnpm --filter @journey/web lint
```

#### Step 2: Fix Common Issues

| Issue                   | Fix                                                                                                      |
| ----------------------- | -------------------------------------------------------------------------------------------------------- |
| Unused import           | Remove the import                                                                                        |
| Unused variable         | Prefix with `_` (e.g., `_unusedVar`) or remove                                                           |
| Missing hook dependency | Add to deps array OR add `// eslint-disable-next-line react-hooks/exhaustive-deps` with reason           |
| `no-explicit-any`       | Use proper type OR add inline `// eslint-disable-next-line @typescript-eslint/no-explicit-any -- reason` |
| `no-case-declarations`  | Add braces `{}` around case block                                                                        |

#### Step 3: Auto-fix What You Can

```bash
# Auto-fix staged files
git diff --cached --name-only | xargs pnpm eslint --fix

# Re-stage after auto-fix
git add -u
```

#### Step 4: Manual Fixes

For warnings that can't be auto-fixed, either:

1. **Fix the issue** (preferred)
2. **Suppress with reason** (use sparingly):
   ```typescript
   // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Will be used in next PR
   const _futureFeature = getData();
   ```

#### Quick Lint Commands

```bash
# Check all web app files
pnpm --filter @journey/web lint

# Auto-fix what's possible
pnpm --filter @journey/web exec eslint src --fix

# Check specific file
pnpm --filter @journey/web exec eslint src/path/to/file.tsx
```

**Note:** Pre-commit hook is disabled. CI is the enforcement point - run lint locally to catch issues early.

---

## Golden Rules

### NEVER Do These

| Rule                               | Why                                          |
| ---------------------------------- | -------------------------------------------- |
| ❌ Use `console.log`               | Use `@journey/logger` instead                |
| ❌ Duplicate type definitions      | Import from `@journey/schemas`               |
| ❌ Import stores into other stores | Use `storeEventBus` for communication        |
| ❌ Add backward compatibility      | MVP project - breaking changes OK            |
| ❌ Create trivial tests            | No Zod schema tests, no obvious tests        |
| ❌ Make git commits                | Leave commits to the maintainer              |
| ❌ Run servers yourself            | Web: 3000, API: 3001 are always running      |
| ❌ Git commits not allowed         | Leave commits to the maintainer              |
| ❌ @deprecated not allowed to use  | We dont add any backward compatibility code. |
| ❌ Use array index as React key    | Use unique IDs like `item.id`                |
| ❌ Subscribe to entire store state | Use granular selectors for performance       |
| ❌ Use anonymous memo components   | Named functions for React DevTools           |

### ALWAYS Do These

| Rule                                 | Example                                              |
| ------------------------------------ | ---------------------------------------------------- |
| ✅ Use structured logging            | `log.info({ userId }, "action:completed")`           |
| ✅ Throw domain errors               | `throw new NotFoundError("Journey", id)`             |
| ✅ Emit store events after mutations | `storeEventBus.emit({ type: "node:updated", ... })`  |
| ✅ Use kebab-case for files          | `use-journey.ts`, `node-editor.tsx`                  |
| ✅ Derive state from stores          | Don't pass everything through props                  |
| ✅ Use Lucide icons only             | `import { Plus } from "lucide-react"`                |
| ✅ Use `import type` for types       | `import type { Node } from "@journey/schemas"`       |
| ✅ Use `cn()` for class merging      | `className={cn("base", conditional)}`                |
| ✅ Use `.length` in deps arrays      | `[items.length]` not `[items]` - prevents re-renders |

### Important Project Conventions

- Instead complex migrations with drizzle prefer `pnpm db:reset-full` command to reset database and seed it with fresh data.
- VERY IMPORTANT - DRY PRINCIPLE - DO NOT REPEAT YOURSELF - If you see code that is similar to other code, create a function or a component to DRY it up. Search codebase or check docs for existing code that can be reused before creating new code.
- All docs located in `docs/` - always update docs of packages and features to be up to date with current code and structure.
- Tests politics - our main goal is to create tests that helps catch bugs in new code created, minimal tests amount and they should check real life cases.
- Never run servers yourself — web and api run on standard ports in the dev environment (web:3000, api:3001). Ensure they are running before you start working.
- **Check error-only logs during development:** Use `tail -f ./apps/{api,web,mcp}/logs/journey-error.$(date +%Y-%m-%d).*` or `tail -f ./packages/{db,llm}/logs/journey-error.$(date +%Y-%m-%d).*` to monitor errors while testing. Catches issues faster than verbose main logs.

---

## TypeScript Best Practices

> **Goal:** Zero `any`, maximum type safety, self-documenting code.

### Forbidden Patterns (Always Clean Up)

| Pattern                        | Fix                                                 |
| ------------------------------ | --------------------------------------------------- |
| `as any`                       | Use `unknown` + type guard, or proper generics      |
| `foo!` (non-null assertion)    | Use `if (foo)` narrowing or optional chaining       |
| `as SomeType` (type assertion) | Use type guards or `satisfies`                      |
| `// @ts-ignore`                | Fix the actual type error                           |
| `Function` type                | Use specific signature: `(x: string) => void`       |
| `{}` or `object` type          | Use `Record<string, unknown>` or specific interface |

### Preferred Patterns

```typescript
// ✅ Type narrowing instead of assertion
if (isNodeData(data)) {
  return data.label; // TypeScript knows the type
}

// ✅ unknown + type guard instead of any
function process(input: unknown): string {
  if (typeof input === "string") return input;
  if (isValidData(input)) return input.value;
  throw new BadRequestError("Invalid input");
}

// ✅ Generic constraints instead of any
function getValue<T extends Record<string, unknown>>(obj: T, key: keyof T) {
  return obj[key];
}

// ✅ satisfies for type checking without widening
const config = {
  mode: "dark",
  theme: "blue",
} satisfies Record<string, string>;

// ✅ Discriminated unions for state
type Result<T> = { success: true; data: T } | { success: false; error: string };

// ✅ as const for literal types
const MODES = ["edit", "view", "preview"] as const;
type Mode = (typeof MODES)[number]; // "edit" | "view" | "preview"
```

### Quick Type Guard Template

```typescript
// Create once, use everywhere
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
```

---

## Code Patterns

### 1. Logging (Always Use This)

```typescript
import { createLogger, serializeError } from "@journey/logger";

const log = createLogger("my-service");

// ✅ Correct
log.info({ userId, journeyId }, "service:actionCompleted");
log.error({ err: serializeError(error), userId }, "service:actionFailed");

// ❌ Wrong
console.log("something happened");
```

### 2. Error Handling

```typescript
import { NotFoundError, BadRequestError } from "@journey/schemas";

// ✅ Throw domain-specific errors
if (!journey) {
  throw new NotFoundError("Journey", journeyId);
}

if (!isValid) {
  throw new BadRequestError("Invalid input", { field: "email" });
}
```

> 📖 See all error types: `packages/schemas/src/errors/index.ts`

### 3. Type Definitions

```typescript
// ✅ Import from schemas (single source of truth)
import type { JourneyNode, NodeType, MessageNodeData } from "@journey/schemas";

// ✅ Web-only extensions go in nodes/types.ts
import type { JourneyNode } from "@/features/journey/nodes/types";

// ❌ Never create duplicate types
interface MyJourneyNode { ... } // DON'T DO THIS
```

### 4. Store Communication

```typescript
// ✅ Emit events for cross-store communication
journeyNodesStore.setState((s) => ({ ...s, nodes: newNodes }));
storeEventBus.emit({ type: "node:added", payload: { node } });

// ✅ Subscribe in other stores
storeEventBus.on("node:deleted", (event) => {
  if (selectedId === event.payload.nodeId) {
    clearSelection();
  }
});

// ❌ Never import stores into other stores
import { otherStore } from "./other-store"; // DON'T
```

### 5. React Components

```typescript
// ✅ Named memo component (shows correctly in React DevTools)
export const MyComponent = memo(function MyComponent({ id }: Props) {
  const data = useStore(myStore, (s) => s.items[id]); // Granular selector
  return <div>{data.name}</div>;
});

// ❌ Anonymous memo (shows as "Anonymous" in DevTools - hard to debug)
export const MyComponent = memo(({ id }: Props) => {
  return <div>{id}</div>;
});

// ❌ Don't pass everything through props
<MyComponent node={node} edges={edges} config={config} ... /> // Too many props
```

### 6. API Services

```typescript
const log = createLogger("my-service");

export async function getResource(id: string, organizationId: string) {
  try {
    const result = await db.select()...;

    if (!result) {
      throw new NotFoundError("Resource", id);
    }

    log.info({ resourceId: id }, "myService:getResource");
    return result;
  } catch (error) {
    log.error({ err: serializeError(error), resourceId: id }, "myService:getResource:error");
    throw error;
  }
}
```

Use the service container in API routes (no direct `db` access):

```typescript
import { createServicesFromContext } from "../services";

router.get("/", async (c) => {
  const services = createServicesFromContext(c);
  const data = await services.variable.getGlobalVariables();
  return c.json({ data });
});
```

### 7. Query Hooks

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

### 8. Toast Notifications

```typescript
import { notify } from "@/shared/lib/ui/notify";

// ✅ Use notify for user feedback
notify.success("Saved successfully");
notify.error("Failed to save", { description: "Please try again" });
notify.warning("Connection unstable");
notify.info("New version available");

// ❌ Don't use alert() or window.confirm
alert("Saved!"); // DON'T
```

### 9. TanStack Form Values (Reactive vs Snapshot)

```typescript
// ✅ For RENDERING - use reactive subscription
const formValues = useStore(form.store, (state) => state.values);
return <Input value={formValues.label} onChange={...} />;

// ✅ Inside CALLBACKS - direct access is OK (runs at call-time)
const handleSave = useCallback(() => {
  const values = form.state.values; // OK - gets current snapshot when called
  validateAndSave(values);
}, [form]);

// ❌ WRONG - non-reactive for rendering causes input freezing
const formValues = form.state.values; // Bug: inputs freeze after first edit
return <Input value={formValues.label} />;
```

> 📖 TanStack Form's `form.state.values` is a snapshot, not a subscription. For controlled inputs, always use `useStore(form.store, selector)` to ensure React re-renders on value changes.

### 10. Store Selector Optimization

```typescript
// ✅ Granular selectors - only re-render when this specific value changes
const selectedNodeId = useStore(uiStore, (s) => s.selectedNodeId);
const mode = useStore(uiStore, (s) => s.mode);

// ✅ For arrays in useEffect deps, use .length to prevent re-renders
const eventLogLength = eventLog.length;
useEffect(() => {
  // This only runs when array length changes, not on every render
}, [eventLogLength]);

// ❌ Full state subscription - re-renders on ANY store change
const state = useStore(uiStore, (s) => s);
const { selectedNodeId, mode } = state; // Bad: subscribes to everything
```

### 11. Button Loading States

```typescript
import { Loader2 } from "lucide-react";

// ✅ Standard loading button pattern
<Button disabled={isLoading}>
  {isLoading ? (
    <>
      <Loader2 className="mr-2 size-4 animate-spin" />
      Saving...
    </>
  ) : (
    "Save"
  )}
</Button>

// ✅ Icon-only loading
<Button size="icon" disabled={isLoading}>
  {isLoading ? <Loader2 className="size-4 animate-spin" /> : <Plus />}
</Button>
```

### 12. Import Order Convention

```typescript
// 1. React
import { memo, useCallback, useState } from "react";

// 2. External libraries
import { useStore } from "@tanstack/react-store";
import { Bot, User } from "lucide-react";

// 3. Shared types (@journey/*)
import type { InteractionEvent } from "@journey/schemas";

// 4. Shared components/utilities (@/shared/*)
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";

// 5. Feature imports (@/features/*, @/stores/*)
import { uiStore } from "@/stores/ui-store";

// 6. Local imports (same directory)
import { ChatInput } from "./chat-input";
```

---

## Where Code Lives

### Quick Reference

| What                   | Where                                              |
| ---------------------- | -------------------------------------------------- |
| Shared types & schemas | `packages/schemas/src/`                            |
| API services           | `apps/api/src/services/`                           |
| API routes             | `apps/api/src/routes/`                             |
| React components       | `apps/web/src/features/{feature}/components/`      |
| React hooks            | `apps/web/src/features/{feature}/hooks/`           |
| Global stores          | `apps/web/src/stores/`                             |
| Feature stores         | `apps/web/src/features/{feature}/store/`           |
| Shared UI components   | `apps/web/src/components/ui/`                      |
| Query hooks            | `apps/web/src/hooks/queries/`                      |
| Node configurations    | `apps/web/src/features/journey/nodes/definitions/` |
| App config             | `apps/web/src/shared/lib/app-config.ts`            |

### Decision Guide

```
Is this a shared type used across packages?
  → @journey/schemas

Is this backend business logic?
  → apps/api/src/services/

Is this a React Flow node type?
  → apps/web/src/features/journey/nodes/

Is this UI specific to one feature?
  → apps/web/src/features/{feature}/

Is this a reusable UI component?
  → apps/web/src/components/ui/

Is this global app state?
  → apps/web/src/stores/
```

> 📖 Full guide: `docs/dev/architecture/project-structure.md`

---

## Store Architecture (7 Stores)

| Store                  | What It Owns                   |
| ---------------------- | ------------------------------ |
| `journey-nodes-store`  | Nodes, edges, undo/redo        |
| `ui-store`             | Edit mode, selections, dialogs |
| `version-store`        | Version history                |
| `user-store`           | Current user state             |
| `custom-journey-store` | Custom journey persistence     |
| `simulator-store`      | Simulator state                |
| `journey-header-store` | Header controls                |

**Rule**: Stores never import each other. Use `storeEventBus`.

> 📖 Full guide: `docs/dev/guides/store-initialization.md`

---

## Testing

### What to Test

- Integration points (API endpoints)
- Store mutations and event bus communication
- Complex business logic
- Edge cases and error handling

### What NOT to Test

- Zod schemas (they test themselves)
- Trivial getters/setters
- UI that just renders props

### Test Pyramid (pick the right level)

Try to avoid run `pnpm test:e2e` all the time, its slow and not always needed. Use more specific and faster tests based on context of your changes.
Always ssearch for specific test that covers your changes or create new one on correct level. Both for frontend and backend. (save time and resources, very important).

| Command                            | Duration | Tests | Use Case                         |
| ---------------------------------- | -------- | ----- | -------------------------------- |
| `pnpm typecheck`                   | ~20s     | -     | Always run first                 |
| `pnpm --filter @journey/web lint`  | ~15s     | -     | Run after typecheck passes       |
| `pnpm test:quick`                  | ~30s     | ~400  | Fast feedback during development |
| `pnpm test:unit`                   | ~1min    | ~880  | Pre-commit validation            |
| `pnpm test:backend`                | ~2min    | ~990  | Backend-only changes             |
| `pnpm test:frontend`               | ~3min    | ~340  | Frontend-only changes            |
| `pnpm test:integration`            | ~2min    | ~350  | API/service changes              |
| `pnpm test:e2e`                    | ~3min    | ~160  | Full E2E validation              |

Check all available tests sets in `packages/engine/package.json` file ALWAYS try to run specific tests set based on context and code you edit.

### Blade Runner (Real-World Engine Testing)

After modifying engine code, run blade-runner to test against real journey files:

```bash
pnpm blade-runner apps/web/src/data/journeys/saas-onboarding/journey.json --thorough
```

Runs ~500 path variations in ~1 second. Always use `--thorough` for engine changes.

### E2E Test Credentials for Playwrite MCP Tests

- Email: `demo@journey.app`
- Password: `demo1234`

### Where to Put Tests

| Test Type        | Location                                           | Example                      |
| ---------------- | -------------------------------------------------- | ---------------------------- |
| Unit (component) | `apps/web/src/features/{feature}/__tests__/`       | `message-node.test.tsx`      |
| Unit (hook)      | `apps/web/src/features/{feature}/hooks/__tests__/` | `use-journey.test.ts`        |
| Unit (store)     | `apps/web/src/stores/__tests__/`                   | `ui-store.test.ts`           |
| Unit (service)   | `apps/api/src/services/__tests__/`                 | `journey-service.test.ts`    |
| API endpoint     | `apps/api/src/__tests__/`                          | `journeys.test.ts`           |
| E2E              | `apps/web/tests/`                                  | `journey-visualizer.spec.ts` |

**Rules:**

- Co-locate unit tests with the code they test (`__tests__/` folder)
- Integration tests go in the app's root `__tests__/` or `tests/` folder
- Name test files with `.test.ts(x)` for unit tests, `.spec.ts` for E2E tests

---

## Debugging

### Database Access

Connect directly to PostgreSQL for debugging:

```bash
PGPASSWORD=journey_dev psql -h localhost -U journey -d journey
```

### API Logs

Check recent errors in:

```
apps/api/logs/journey.log
```

Watch logs live: `tail -f apps/api/logs/journey.log`

### Error-Only Log (New!)

For faster debugging, check the **error-only log** that contains only error (level 50) and fatal (level 60) entries:

```bash
# View today's errors only (API, Web, MCP)
tail -f ./apps/api/logs/journey-error.$(date +%Y-%m-%d).*
tail -f ./apps/web/logs/journey-error.$(date +%Y-%m-%d).*
tail -f ./apps/mcp/logs/journey-error.$(date +%Y-%m-%d).*

# View today's errors only (Packages)
tail -f ./packages/db/logs/journey-error.$(date +%Y-%m-%d).*
tail -f ./packages/llm/logs/journey-error.$(date +%Y-%m-%d).*

# Count error entries
grep -c '"level":50' ./apps/api/logs/journey-error.$(date +%Y-%m-%d).*

# Search errors for specific text (e.g., "timeout")
grep "timeout" ./apps/api/logs/journey-error.$(date +%Y-%m-%d).*
```

**Why use error-only logs?**

- Faster incident investigation (no verbose info/debug logs)
- Daily rotation prevents unbounded disk growth (944 MB → ~80 MB max)
- Easier to spot patterns and recurring errors
- 7-day retention for recent issues

**File pattern:** `./apps/*/logs/journey-error.YYYY-MM-DD.N.log` (dated files rotate daily at midnight UTC)

---

## Common Mistakes

### 1. Wrong Import Path for Types

```typescript
// ❌ Wrong - importing from web when it's a shared type
import { NodeType } from "@/features/journey/nodes/types";

// ✅ Correct - import from schemas
import { NodeType } from "@journey/schemas";
```

### 2. Console Logging

```typescript
// ❌ Wrong
console.log("Debug:", data);
console.error("Failed:", error);

// ✅ Correct
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

### 4. Direct Store Access

```typescript
// ❌ Wrong - direct import between stores
import { uiStore } from "./ui-store";
uiStore.setState(...);

// ✅ Correct - use event bus
storeEventBus.emit({ type: "selection:cleared", payload: {} });
```

### 5. Backward Compatibility Code

We don't need backward compatibility code.

```typescript
// ❌ Wrong - we don't need this
const data = newFormat ?? legacyFormat ?? oldFormat;

// ✅ Correct - just use current format
const data = currentFormat;
```

### 6. Array Index as Key

```typescript
// ❌ Wrong - causes state bugs on reorder/delete
{
  items.map((item, index) => <Item key={index} data={item} />);
}

// ✅ Correct - use unique identifier
{
  items.map((item) => <Item key={item.id} data={item} />);
}
```

### 7. Anonymous Memo Components

```typescript
// ❌ Wrong - shows as "Anonymous" in React DevTools
export const MyComponent = memo(({ data }: Props) => {
  return <div>{data.name}</div>;
});

// ✅ Correct - named function for debugging
export const MyComponent = memo(function MyComponent({ data }: Props) {
  return <div>{data.name}</div>;
});
```

### 8. Full Store Subscription

```typescript
// ❌ Wrong - re-renders on ANY store change
const state = useStore(uiStore, (s) => s);
const { selectedNodeId } = state;

// ✅ Correct - only re-renders when selectedNodeId changes
const selectedNodeId = useStore(uiStore, (s) => s.selectedNodeId);
```

---

## Key Documentation

| Topic                  | Location                                     |
| ---------------------- | -------------------------------------------- |
| Project structure      | `docs/dev/architecture/project-structure.md` |
| Component organization | `docs/dev/guides/component-organization.md`  |
| Adding node types      | `docs/dev/guides/adding-new-node-type.md`    |
| Store patterns         | `docs/dev/guides/store-initialization.md`    |
| Junior guide (full)    | `docs/dev/guides/junior-developer-guide.md`  |
| Junior quick reference | `docs/dev/guides/junior-quick-reference.md`  |
| Error hierarchy        | `packages/schemas/src/errors/index.ts`       |
| API routes             | `docs/api/README.md`                         |
| Database schema        | `docs/db/README.md`                          |
| Logger usage           | `docs/logger/README.md`                      |

---

## Tech Stack Quick Reference

| Layer      | Technology                                                       |
| ---------- | ---------------------------------------------------------------- |
| Frontend   | React 19, TanStack (Router, Query, Store, Form), Tailwind CSS v4 |
| Backend    | Hono, Drizzle ORM, PostgreSQL, BullMQ                            |
| Validation | Zod (schemas → types)                                            |
| Monorepo   | Turborepo, pnpm                                                  |
| Testing    | Vitest, Playwright                                               |
| Icons      | Lucide React only                                                |

---

## Getting Help

1. **Search existing code** - Similar patterns likely exist
2. **Check `/docs/`** - Comprehensive documentation
3. **Read error messages** - They're usually helpful
4. **Ask before guessing** - Especially for architecture decisions

---

_Keep it simple. Keep it clean. When in doubt, look at existing code._
