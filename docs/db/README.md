# @journey/db

Database schema and client for Journey Builder, built on Drizzle ORM + PostgreSQL (postgres.js).

## Overview

This package provides:

- **Schema modules** split by domain in `packages/db/src/schema/`
- **Typed database client** with connection pooling and helpers
- **Migrations + drift checks** via Drizzle Kit
- **Seed data** for dev and E2E scenarios
- **Encryption utilities** for sensitive columns
- **Test utilities** for cleanup helpers

## Package Exports

```typescript
// Schema tables + enums
import { journeys, crmPipelines, journeyStatusEnum } from "@journey/db";
// or explicit schema import
import { journeys } from "@journey/db/schema";

// Client + helpers
import {
  db,
  queryClient,
  withQueryLogging,
  checkDatabaseHealth,
  closeDatabaseConnection,
  poolConfig,
  getPoolStats,
  startPoolMonitoring,
} from "@journey/db";
// or client-only import
import { db as dbClient } from "@journey/db/client";

// Encryption helpers
import { encrypt, decrypt, isEncrypted, safeEncrypt, hashSecret } from "@journey/db";

// Transaction helper
import { withTransaction, type TransactionClient } from "@journey/db";

// Test utilities
import { cleanupOldTestData } from "@journey/db/test-utils";
```

## Schema Overview

Schema modules live in `packages/db/src/schema/` and are re-exported via `@journey/db/schema`.

| Module | Tables / Exports | Description |
| ------ | --------------- | ----------- |
| `auth.ts` | `user`, `session`, `account`, `verification` | Better Auth tables |
| `organization.ts` | `organization` | Multi-tenant workspaces |
| `organization-membership.ts` | `member`, `invitation` | Organization membership |
| `journey.ts` | `journeys`, `journeyVersions`, `journeyMedia` | Journey builder core (includes `defaultPipelineId` for CRM) |
| `journey-transfers.ts` | `journeyTransfers` | Journey transfer audit log |
| `channels.ts` | `messagingChannels` | Messaging channels (Telegram/WhatsApp) |
| `session.ts` | `clients`, `journeySessions`, `interactions`, `sentMessages`, `agentConversations`, `nodeOutputs` | Runtime sessions + logs |
| `variables.ts` | `variables` | Unified variable store (global/journey/user) |
| `tags.ts` | `tagDefinitions`, `clientTags` | Global tags + assignments |
| `crm.ts` | `crmPipelines`, `crmPipelineStages`, `crmClientStages`, `crmStageHistory`, `crmCustomFieldDefinitions`, `crmClientFieldValues`, `crmDirectMessages` | CRM system |
| `automation.ts` | `automationTriggers`, `automationWebhooks`, `durableTimers` | Triggers, webhooks, timers |
| `events.ts` | `events`, `failedEvents` | Universal event store + DLQ |
| `mindstate.ts` | `mindstateDefinitions`, `clientMindstates`, `mindstateAnalysisLog` | Mindstate tracking |
| `agents.ts` | `agentWorkflows`, `agentDefinitions`, `workflowVersions`, `workflowApprovals` | Agent workflows |
| `memory.ts` | `agentMemories` | Long-term memory (pgvector) |
| `simulator.ts` | `testPersonas` | Simulator personas |
| `usage.ts` | `llmUsageEvents` | LLM usage tracking |
| `enums.ts` | `*Enum` exports | PostgreSQL enums for statuses/types |
| `relations.ts` | `*Relations` exports | Centralized Drizzle relations |

## Database Client

### Basic Usage

```typescript
import { db, journeys } from "@journey/db";
import { eq } from "drizzle-orm";

const journey = await db.select().from(journeys).where(eq(journeys.id, journeyId));
```

### Raw SQL

```typescript
import { queryClient } from "@journey/db";

const result = await queryClient`SELECT 1`;
```

### Query Logging

```typescript
import { db, withQueryLogging, journeys } from "@journey/db";

const results = await withQueryLogging("journeys:list", () =>
  db.select().from(journeys)
);
```

### Transactions

Use the `withTransaction` helper for atomic operations:

```typescript
import { withTransaction, journeys, journeyVersions } from "@journey/db";

const result = await withTransaction(async (tx) => {
  const [journey] = await tx.insert(journeys).values({...}).returning();
  await tx.insert(journeyVersions).values({ journeyId: journey.id, ... });
  return journey;
});
```

### Health + Shutdown

```typescript
import { checkDatabaseHealth, closeDatabaseConnection } from "@journey/db";

const ok = await checkDatabaseHealth();
await closeDatabaseConnection();
```

### Pool Monitoring

```typescript
import { getPoolStats, startPoolMonitoring } from "@journey/db";

const stats = await getPoolStats();
const stop = startPoolMonitoring(60_000);
// call stop() on shutdown
```

## Migrations

### Generate + Apply

From `packages/db`:

```bash
pnpm generate
pnpm migrate
```

From repo root:

```bash
pnpm db:generate
pnpm db:migrate
```

### Drift Check

```bash
cd packages/db
pnpm db:check
```

### Studio

```bash
cd packages/db
pnpm studio
```

### Push (Dev Only)

From `packages/db`:

```bash
pnpm push
```

From repo root:

```bash
pnpm db:push
```

> `push` runs `drizzle-kit push --force` and bypasses migrations. Use for local resets only.

### Migration Files

```
packages/db/drizzle/
├── 0000_*.sql
├── 0001_*.sql
├── ...
└── meta/
    ├── _journal.json
    └── 0000_snapshot.json
```

### Required Extensions

| Extension | Purpose | Required For |
|-----------|---------|--------------|
| `vector` (pgvector) | Vector similarity search | `agent_memories.embedding` column |
| `pgcrypto` | Database-level crypto | Future encryption features |

Extensions require superuser privileges. Options:

1. **Local Development**: Run `pnpm db:reset-full` which creates extensions automatically
2. **Cloud Providers**: Most (Supabase, Neon, Railway) pre-install common extensions
3. **Manual Setup**: Connect as superuser and run:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   CREATE EXTENSION IF NOT EXISTS pgcrypto;
   ```

> **Important**: Extensions are created by reset/drop scripts (`db:reset-full`, `db:drop`), NOT by incremental migrations (`drizzle-kit migrate`). For a fresh database, either run a reset script first or manually create extensions before running migrations.

If you see errors like `type "vector" does not exist`, the extension is missing.

## Reset + Drop (Destructive)

Use these only in development/test environments.

- `pnpm db:drop` drops all tables and creates extensions (blocked in production).
- `pnpm db:reset` runs `drop` + `drizzle-kit push --force` + `seed`.
- `pnpm db:reset-full` (root) fully regenerates migrations and reseeds the DB.

> **Preferred for major schema changes:** `pnpm db:reset-full` (see `scripts/db-reset-full.sh`).
> If you run `src/drop.ts` directly, set `DB_RESET_CONFIRM=true` and ensure `NODE_ENV` is not `production`.
> `db:reset-full` uses local `psql` defaults (user `journey`, password `journey_dev`).

## Seeding

Seed commands are split into phases for flexibility:

| Command | Description | Use Case |
|---------|-------------|----------|
| `pnpm db:seed:core` | Minimal seeds (users + orgs) | Fresh database setup |
| `pnpm db:seed:demo` | Core + sample data (CRM, mindstate, tags, etc.) | Development environment |
| `pnpm db:seed` | Full seeding including E2E test data | Complete setup with test data |

```bash
# Most common - full seed for development
pnpm db:seed

# Minimal - just users and organizations
pnpm db:seed:core

# Development data without heavy E2E test data
pnpm db:seed:demo
```

**Note:** user seeding creates users directly in the database with hashed passwords.

### Seed Structure

```
packages/db/src/seed/
├── index.ts        # Full seeding (core + demo + e2e)
├── core.ts         # Minimal seeds: users, organizations, journeys
├── demo.ts         # Sample data: CRM, mindstate, tags, variables, workflows
├── data.ts         # Shared seed data constants
├── types.ts        # Seed type definitions
├── seed-users.ts
├── seed-organizations.ts
├── seed-journeys.ts
├── seed-workflows.ts
├── seed-mindstate.ts
├── seed-crm.ts
├── seed-variables.ts
├── seed-tags.ts
├── seed-clients.ts
└── seed-sessions.ts
```

### Test Users

| Email | Password | Description |
| ----- | -------- | ----------- |
| `demo@journey.app` | `demo1234` | Demo workspace + journeys |
| `arina@journey.app` | `arina1234` | Sample journeys workspace |
| `default@journey.app` | `default1234` | Starter template |

## Test Utilities

Helpers live in `packages/db/src/test-utils/` and are exported via `@journey/db/test-utils`:

- `cleanupTestPipelines`, `cleanupTestTags`, `cleanupTestVariables`, `cleanupTestOrganizations`
- `cleanupOldTestData(hoursOld = 24)`
- `registerCleanupOnExit()`

Test scripts (package):

```bash
pnpm test:seed
pnpm test:cleanup
```

Both scripts force `NODE_ENV=test` and use the test database connection.

## Environment Variables

| Variable | Required | Default | Description |
| -------- | -------- | ------- | ----------- |
| `DATABASE_URL` | Yes (prod) | `postgres://journey:journey_dev@localhost:5432/journey` | PostgreSQL connection string |
| `DB_POOL_MAX` | No | `20` | Max pool size |
| `DB_IDLE_TIMEOUT` | No | `30` | Idle timeout (seconds) |
| `DB_CONNECT_TIMEOUT` | No | `10` | Connection timeout (seconds) |
| `DB_MAX_LIFETIME` | No | `1800` | Max connection lifetime (seconds) |
| `ENCRYPTION_KEY` | Yes (for secrets) | - | 32-byte hex key for AES-256-GCM |
| `API_URL` | No | `http://localhost:3001` | Used by seed users via Better Auth |

## Security

See `docs/db/security.md` for encrypted columns, hashes, and rotation guidance.

## Example Schema Definition

```typescript
import { pgTable, text, jsonb, timestamp, uuid } from "drizzle-orm/pg-core";
import type { JourneyConfig } from "@journey/schemas";
import { organization } from "./organization";

export const journeys = pgTable("journeys", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  configuration: jsonb("configuration").$type<JourneyConfig>().notNull(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
```

## File Structure

```
packages/db/
├── src/
│   ├── client.ts
│   ├── index.ts
│   ├── drop.ts
│   ├── schema/
│   ├── seed/
│   ├── test-utils/
│   └── utils/
├── drizzle/
└── drizzle.config.ts
```

## See Also

- `docs/db/schema-conventions.md` - Naming conventions + patterns
- `docs/db/change-checklist.md` - Schema change process
- `docs/db/security.md` - Sensitive columns + rotation
- `docs/db/retention.md` - Data retention policy
- `docs/reference/environment-variables.md` - Env var reference
- `docs/dev/architecture/database-schema.md` - Architectural overview
