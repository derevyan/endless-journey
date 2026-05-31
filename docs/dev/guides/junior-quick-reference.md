# Junior Developer Quick Reference

> One-page cheat sheet. For details, see [Junior Developer Guide](./junior-developer-guide.md).

---

## Golden Rules

1. **Search before creating** - Most code already exists
2. **Types from `@journey/schemas`** - Single source of truth
3. **Use `createLogger()`** - Never `console.log`
4. **Stores use event bus** - Never import stores into stores
5. **Domain errors only** - Not generic `new Error()`

---

## Before Writing Code

```
[ ] Searched for existing code (see commands below)
[ ] Checked shared components/utilities
[ ] Reviewed similar feature code
[ ] Asked teammate if unsure
```

---

## Where Things Live

| Need                    | Location                             |
| ----------------------- | ------------------------------------ |
| Types/Schemas           | `packages/schemas/src/`              |
| UI Components           | `apps/web/src/shared/components/ui/` |
| Domain Components       | `apps/web/src/shared/components/`    |
| Shared Hooks            | `apps/web/src/shared/hooks/`         |
| Query Hooks             | `apps/web/src/hooks/queries/`        |
| Global Stores           | `apps/web/src/stores/`               |
| API Client              | `apps/web/src/shared/lib/api/`       |
| API Modules             | `apps/api/src/modules/`              |
| Shared Runtime Services | `apps/api/src/services/`             |
| Errors                  | `packages/schemas/src/errors/`       |

---

## Search Commands

```bash
# Find component
grep -rn "ComponentName" apps/web/src --include="*.tsx"

# Find hook
find apps/web -name "use-*.ts" -type f

# Find type
rg -n "TypeName" packages/schemas/src

# Find API endpoint
rg -n "endpoint" apps/api/src/modules

# Find pattern anywhere
rg -n "keyword" . --glob "*.ts" --glob "*.tsx"
```

---

## Key Existing Code

### Components (`shared/components/`)

`button` `dialog` `alert-dialog` `sheet` `drawer` `popover` `dropdown-menu` `select` `input` `textarea` `tabs` `card` `table` `badge` `tooltip` `data-table` `template-textarea` `tag-selector` `delete-confirm-dialog` `media-upload` `loading-spinner` `error-boundary`

### Hooks (`shared/hooks/` & `hooks/queries/`)

`useDebounce` `useDialogState` `useIsMobile` `useSSEConnection` `useTags` `useChannels` `useVariables` `useEvents` `useJourneyConfig` `useModels` `useMediaGallery`

### Errors (`@journey/schemas`)

`NotFoundError` `BadRequestError` `ValidationError` `UnauthorizedError` `ForbiddenError` `ConflictError`

### Utilities

`createLogger()` `serializeError()` `notify.success/error/warning/info` `authFetch()` `createMutation()`

---

## Do's and Don'ts

| Do                                        | Don't                          |
| ----------------------------------------- | ------------------------------ |
| `import { Type } from "@journey/schemas"` | Define duplicate types         |
| `createLogger("scope")`                   | `console.log()`                |
| `throw new NotFoundError("X", id)`        | `throw new Error("not found")` |
| `storeEventBus.emit(...)`                 | Import stores into stores      |
| `notify.success("Done")`                  | `alert("Done")`                |
| `DeleteConfirmDialog` component           | `window.confirm()`             |
| `useDebounce()` hook                      | Custom debounce                |
| `useTags()` hook                          | Custom tag fetching            |

---

## Patterns

### Logging

```typescript
import { createLogger, serializeError } from "@journey/logger";
const log = createLogger("my-service");
log.info({ userId }, "action:completed");
log.error({ err: serializeError(e) }, "action:failed");
```

### Errors

```typescript
import { NotFoundError } from "@journey/schemas";
throw new NotFoundError("Journey", id);
```

### Notifications

```typescript
import { notify } from "@/shared/lib/ui/notify";
notify.success("Saved");
notify.error("Failed", { description: "Details" });
```

### Store Events

```typescript
import { storeEventBus } from "@/stores/store-event-bus";
storeEventBus.emit({ type: "node:added", payload: { node } });
storeEventBus.on("node:deleted", (e) => {
  /* handle */
});
```

---

## Commands

```bash
pnpm typecheck        # Always run first
pnpm test:quick       # Fast feedback (30s)
pnpm test:unit        # Pre-commit (1min)
pnpm db:reset-full    # Reset database
pnpm blade-runner ... # Test engine
```

---

## Debugging

### Error-Only Logs

Monitor errors while testing (faster than verbose logs):

```bash
# Apps
tail -f ./apps/{api,web,mcp}/logs/journey-error.$(date +%Y-%m-%d).*

# Packages
tail -f ./packages/{db,llm}/logs/journey-error.$(date +%Y-%m-%d).*
```

### Database Access

```bash
PGPASSWORD=journey_dev psql -h localhost -U journey -d journey
```

---

## File Naming

- All files: `kebab-case` (e.g., `user-table.tsx`)
- Components: `*.tsx`
- Hooks: `use-*.ts`
- Stores: `*-store.ts`
- Tests: `*.test.ts`
