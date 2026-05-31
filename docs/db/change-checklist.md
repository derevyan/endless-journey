# Database Change Checklist

Step-by-step checklist for schema modifications in `@journey/db`.

## Pre-Change

- [ ] Read `docs/db/schema-conventions.md` for naming and patterns
- [ ] Search for similar patterns in existing schema files
- [ ] Verify column types match existing conventions
- [ ] Check if related changes are needed (relations, seeds, services)

## Schema Edit

### Adding a New Table

- [ ] Create schema file in `packages/db/src/schema/`
- [ ] Add `organization_id` with `NOT NULL` for org-scoped tables
- [ ] Add `created_at` and `updated_at` timestamps
- [ ] Add indexes for foreign keys
- [ ] Add unique constraints where needed
- [ ] Export table from `packages/db/src/schema/index.ts`
- [ ] Add relations in `packages/db/src/schema/relations.ts`
- [ ] Export relations from `packages/db/src/schema/index.ts`

### Modifying an Existing Table

- [ ] Edit schema file in `packages/db/src/schema/`
- [ ] Update indexes if adding new queryable columns
- [ ] Update relations in `relations.ts` if adding FKs
- [ ] Check if seeds need updating

### Adding an Enum

- [ ] Define enum in `packages/db/src/schema/enums.ts`
- [ ] Export from `packages/db/src/schema/index.ts`
- [ ] Add to `@journey/schemas` if shared with frontend

## Migration Generation

From `packages/db`:

```bash
pnpm generate
```

Review generated SQL in `packages/db/drizzle/`:

- [ ] Check for destructive changes (DROP, ALTER TYPE)
- [ ] Verify enum additions are forward-compatible
- [ ] Ensure no duplicate extension creation
- [ ] Review index and constraint names
- [ ] If using `vector` type: ensure `pgvector` extension is documented in reset scripts (extensions are NOT created by migrations)

## Drift Check

```bash
cd packages/db
pnpm db:check
```

- [ ] No drift detected between schema and migrations

## Apply Changes

### Development (Preferred)

For major schema changes, use full reset:

```bash
# From repo root
pnpm db:reset-full
```

### Incremental Apply

For minor changes:

```bash
cd packages/db
pnpm migrate
```

## Seed Updates

If new tables need seed data:

- [ ] Add or update seed function in `packages/db/src/seed/`
- [ ] Import and call in `packages/db/src/seed/index.ts`
- [ ] Test with `pnpm db:seed`
- [ ] Ensure `organization_id` is provided for org-scoped tables

## Documentation Updates

- [ ] Update `docs/db/README.md` if adding new module/table
- [ ] Update `docs/dev/architecture/database-schema.md` for ERD changes
- [ ] Update `docs/db/security.md` if adding encrypted columns
- [ ] Update API docs if schema change affects endpoints

## Test Utilities

If table needs cleanup in tests:

- [ ] Add cleanup function to `packages/db/src/test-utils/`
- [ ] Export from `packages/db/src/test-utils/index.ts`

## Verification

- [ ] Run `pnpm typecheck` - must pass
- [ ] Run `pnpm test:backend` - must pass
- [ ] Run `pnpm test:e2e` if API affected

## Quick Reference Commands

| Command | Location | Description |
|---------|----------|-------------|
| `pnpm generate` | packages/db | Generate migration from schema |
| `pnpm migrate` | packages/db | Apply pending migrations |
| `pnpm db:check` | packages/db | Check for schema drift |
| `pnpm db:reset` | packages/db | Drop + push + seed |
| `pnpm db:reset-full` | repo root | Full regenerate + seed (preferred) |
| `pnpm db:seed` | packages/db | Run seed scripts |

## Common Patterns

### Adding a Foreign Key

```typescript
// In schema file
import { myParentTable } from "./parent";

export const myTable = pgTable("my_table", {
  parentId: uuid("parent_id")
    .notNull()
    .references(() => myParentTable.id, { onDelete: "cascade" }),
}, (table) => [
  index("idx_my_table_parent").on(table.parentId),
]);

// In relations.ts
export const myTableRelations = relations(myTable, ({ one }) => ({
  parent: one(myParentTable, {
    fields: [myTable.parentId],
    references: [myParentTable.id],
  }),
}));
```

### Adding Organization Scoping

```typescript
import { organization } from "./organization";

export const myTable = pgTable("my_table", {
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
}, (table) => [
  index("idx_my_table_org").on(table.organizationId),
]);
```

### Adding Soft Delete

```typescript
import { sql } from "drizzle-orm";
import { uniqueIndex } from "drizzle-orm/pg-core";

export const myTable = pgTable("my_table", {
  key: text("key").notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  uniqueIndex("unq_my_table_org_key")
    .on(table.organizationId, table.key)
    .where(sql`deleted_at IS NULL`),
]);
```

## See Also

- `docs/db/schema-conventions.md` - Naming conventions
- `docs/db/README.md` - Package overview
- `docs/db/security.md` - Encrypted columns
