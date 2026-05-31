# Database Schema Conventions

Developer guide for writing consistent schema code in `@journey/db`.

## Table Naming

| Convention | Example | Notes |
|------------|---------|-------|
| snake_case | `journey_sessions` | All table names use snake_case |
| Plural for collections | `journeys`, `clients`, `events` | Most tables hold multiple records |
| Singular for config/join | `organization`, `verification` | Config tables, auth tables |
| Domain prefix for related | `crm_pipelines`, `crm_pipeline_stages` | Groups related tables |

## Column Naming

| Pattern | Example | Notes |
|---------|---------|-------|
| snake_case | `organization_id`, `created_at` | All columns use snake_case |
| FK pattern: `{table}_id` | `journey_id`, `session_id` | Foreign key references |
| Boolean: positive naming | `is_active`, `is_default`, `is_test` | Avoid negative names like `not_deleted` |
| Encrypted: `_encrypted` suffix | `bot_token_encrypted` | Paired with `_hash` for lookup |
| Hash: `_hash` suffix | `bot_token_hash` | For deterministic lookups on encrypted data |

## Timestamp Patterns

Standard timestamp columns (all with timezone):

```typescript
// Required for most tables - MUST use .notNull().defaultNow()
createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),

// For soft delete
deletedAt: timestamp("deleted_at", { withTimezone: true }),
```

> **Important:** All `createdAt` and `updatedAt` columns MUST use `.notNull().defaultNow()`. The `.notNull()` ensures data integrity at the database level - without it, manual inserts could bypass the default and create NULL values.

| Column | Usage | Notes |
|--------|-------|-------|
| `created_at` | Creation time | Default `now()`, never updated |
| `updated_at` | Last modification | Default `now()`, application must update |
| `deleted_at` | Soft delete marker | `null` = not deleted |
| Domain-specific | `completed_at`, `expires_at`, `fired_at`, `sent_at` | Use descriptive names |

## Organization Scoping (Multi-Tenancy)

All business data must be scoped to organizations. Choose the appropriate pattern:

### Directly Scoped (Required for most tables)

```typescript
organizationId: text("organization_id")
  .notNull()
  .references(() => organization.id, { onDelete: "cascade" }),
```

Tables with direct `organization_id NOT NULL`:
- `journeys`, `journey_transfers`, `messaging_channels` - Core entities
- `clients`, `journey_sessions`, `test_personas` - Runtime users/simulator
- `tag_definitions`, `variables` - Tags + variable storage
- `crm_pipelines`, `crm_pipeline_stages`, `crm_client_stages`, `crm_stage_history`, `crm_custom_field_definitions`, `crm_direct_messages` - CRM data
- `automation_triggers` - Automations
- `agent_workflows`, `agent_definitions`, `agent_memories` - Agents + memory
- `mindstate_definitions` - Mindstate templates
- `events`, `llm_usage_events` - Event + usage tracking

### Indirectly Scoped (Via parent FK)

Tables that inherit org scope through their parent:

| Table | Scoped Via |
|-------|-----------|
| `journey_versions` | `journeys.id` |
| `journey_media` | `journeys.id` |
| `interactions`, `sent_messages`, `agent_conversations`, `durable_timers`, `node_outputs` | `journey_sessions.id` |
| `workflow_versions`, `workflow_approvals` | `agent_workflows.id` |
| `automation_webhooks` | `automation_triggers.id` |
| `client_tags` | `tag_definitions.id` (and `clients.id`) |
| `crm_client_field_values` | `crm_custom_field_definitions.id` (and `clients.id`) |
| `client_mindstates` | `mindstate_definitions.id` |
| `mindstate_analysis_log` | `client_mindstates.id` |

### No Org Scope (Auth tables only)

Better Auth managed tables have no org scope:
- `user`, `session`, `account`, `verification`
- `organization`, `member`, `invitation`

## Soft Delete Pattern

For tables supporting soft delete:

```typescript
export const myTable = pgTable("my_table", {
  // ... other columns
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  // Use partial unique index to allow key reuse after delete
  uniqueIndex("unq_my_table_org_key")
    .on(table.organizationId, table.key)
    .where(sql`deleted_at IS NULL`),
]);
```

Tables using soft delete:
- `agent_workflows` - Workflow definitions
- `agent_definitions` - Agent definitions

**Query Pattern**: Always filter `WHERE deleted_at IS NULL` unless explicitly querying deleted records.

## Enum Usage

Define enums in `packages/db/src/schema/enums.ts`:

```typescript
export const sessionStatusEnum = pgEnum("session_status", [
  "active",
  "paused",
  "completed",
  "failed",
]);
```

| Convention | Example |
|------------|---------|
| Type name: `{domain}_{concept}` | `session_status`, `member_role` |
| Values: lowercase | `active`, `paused`, `completed` |
| Multi-word values: snake_case | `in_progress`, `needs_review` |

## Index Naming

| Pattern | Example | Use Case |
|---------|---------|----------|
| `idx_{table}_{column}` | `idx_clients_org` | Single column |
| `idx_{table}_{col1}_{col2}` | `idx_sessions_org_status` | Composite |
| `unq_{table}_{cols}` | `unq_workflows_org_key` | Unique constraint |
| `{table}_{cols}_unique` | `variables_org_key_unique` | Alternate unique naming |

## JSONB Columns

Use JSONB with type annotations:

```typescript
configuration: jsonb("configuration")
  .$type<JourneyConfig>()
  .notNull()
  .default({ nodes: [], edges: [] }),

// Optional metadata
metadata: jsonb("metadata").$type<Record<string, unknown>>(),
```

Common JSONB column names:
- `configuration` - Main config object
- `settings` - User-adjustable settings
- `metadata` - Flexible metadata
- `payload` - Event/message payload

## Variable Scoping Pattern

The `variables` table uses a unified approach for global, journey, and user-scoped variables:

```typescript
export const variables = pgTable("variables", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: text("organization_id").notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  scope: variableScopeEnum("scope").notNull(), // "global" | "journey" | "user"
  ownerId: text("owner_id").notNull(), // Interpretation depends on scope
  key: text("key").notNull(),
  value: jsonb("value").notNull(),
  // ... timestamps
}, (table) => [
  uniqueIndex("variables_org_scope_owner_key_unique")
    .on(table.organizationId, table.scope, table.ownerId, table.key),
]);
```

**How `ownerId` is interpreted:**

| Scope | `ownerId` Value | Description |
|-------|-----------------|-------------|
| `global` | `organizationId` | Org-wide variables |
| `journey` | `journeyId` | Journey-specific variables |
| `user` | `clientId` | User-specific variables |

This pattern allows a single table to handle all variable scopes with proper uniqueness constraints.

## Relations

All Drizzle relations are centralized in `packages/db/src/schema/relations.ts` to avoid circular imports.

```typescript
// In relations.ts
export const journeysRelations = relations(journeys, ({ one, many }) => ({
  organization: one(organization, {
    fields: [journeys.organizationId],
    references: [organization.id],
  }),
  versions: many(journeyVersions),
}));
```

**Why centralized?** Prevents circular import issues between schema files and keeps all relationship logic in one discoverable location.

## Foreign Key Constraints

Standard FK patterns:

```typescript
// Cascade delete (child deleted with parent)
organizationId: text("organization_id")
  .notNull()
  .references(() => organization.id, { onDelete: "cascade" }),

// Set null (preserve record, clear reference)
sessionId: uuid("session_id")
  .references(() => journeySessions.id, { onDelete: "set null" }),

// Restrict (block parent deletion if children exist)
pipelineId: uuid("pipeline_id")
  .references(() => crmPipelines.id, { onDelete: "restrict" }),
```

## Primary Keys

Use UUID for all primary keys:

```typescript
id: uuid("id").primaryKey().defaultRandom(),
```

## Example Complete Table

```typescript
import { relations, sql } from "drizzle-orm";
import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import type { MyConfig } from "@journey/schemas";
import { organization } from "./organization";
import { myStatusEnum } from "./enums";

export const myTable = pgTable(
  "my_table",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    name: text("name").notNull(),
    status: myStatusEnum("status").notNull().default("draft"),
    configuration: jsonb("configuration").$type<MyConfig>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_my_table_org").on(table.organizationId),
    index("idx_my_table_status").on(table.status),
    uniqueIndex("unq_my_table_org_key")
      .on(table.organizationId, table.key)
      .where(sql`deleted_at IS NULL`),
  ]
);
```

## See Also

- `docs/db/README.md` - Package overview
- `docs/db/change-checklist.md` - Schema change process
- `docs/db/security.md` - Encrypted columns
