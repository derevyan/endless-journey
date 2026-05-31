# Branded ID Types Guide

## Overview

The Journey codebase uses **branded types** (also known as nominal types or phantom types) to distinguish between different identifier formats at compile time. This prevents accidentally passing a slug where a UUID is expected (or vice versa).

## The Problem

Our `journeys` table has two identifier columns:
- `id` - UUID primary key (e.g., `550e8400-e29b-41d4-a716-446655440000`)
- `slug` - URL-friendly string (e.g., `my-cool-journey-m7k9p`)

Without type safety, it's easy to write bugs like:

```typescript
// BUG: Passing slug to a function expecting UUID
const journey = await getJourneyByUuid(journeySlug); // TypeScript won't catch this!
```

## The Solution: Branded Types

Branded types add a phantom "brand" to distinguish structurally identical types:

```typescript
// Both are strings at runtime, but TypeScript treats them as incompatible
type JourneyUuid = string & { readonly __brand: "JourneyUuid" };
type JourneySlug = string & { readonly __brand: "JourneySlug" };

// Now TypeScript catches the bug at compile time!
function getJourneyByUuid(uuid: JourneyUuid): Promise<Journey>;
getJourneyByUuid(mySlug); // Error: JourneySlug is not assignable to JourneyUuid
```

## Naming Convention

| Suffix | Type | Example | Use Case |
|--------|------|---------|----------|
| `*Uuid` | Database UUID | `JourneyUuid` | Database operations, API responses |
| `*Slug` | URL-friendly | `JourneySlug` | URLs, routing, display |
| `*IdOrSlug` | Union | `JourneyIdOrSlug` | API params accepting both |
| `*Id` | Generic UUID | `OrganizationId` | Non-journey UUIDs |

## Available Types

### Journey Identifiers
- `JourneyUuid` - Database primary key
- `JourneySlug` - URL-friendly identifier
- `JourneyIdOrSlug` - Union for API endpoints accepting both

### Other Entity Identifiers
- `OrganizationId`
- `UserId`
- `SessionId`
- `ChannelId`
- `VersionId`
- `ClientId`
- `NodeId`

## Usage

### Type Guards

Use type guards to check and narrow types at runtime:

```typescript
import { isJourneyUuid, isJourneySlug } from "@journey/schemas";

function handleJourneyParam(idOrSlug: JourneyIdOrSlug) {
  if (isJourneyUuid(idOrSlug)) {
    // TypeScript knows this is JourneyUuid
    await db.query(journeys.id, idOrSlug);
  } else {
    // TypeScript knows this is JourneySlug
    await db.query(journeys.slug, idOrSlug);
  }
}
```

### Constructors (with validation)

Use constructors when you need to validate and convert a string:

```typescript
import { createJourneyUuid, createJourneySlug } from "@journey/schemas";

// These throw if validation fails
const uuid = createJourneyUuid("550e8400-e29b-41d4-a716-446655440000");
const slug = createJourneySlug("my-cool-journey");

// Use try-catch for user input
try {
  const id = createJourneyUuid(userInput);
} catch (error) {
  console.error("Invalid UUID format");
}
```

### Zod Schemas

Use Zod schemas for runtime validation with automatic branding:

```typescript
import { JourneyUuidSchema, JourneyIdOrSlugSchema } from "@journey/schemas";

// In API routes
const RouteSchema = z.object({
  journeyId: JourneyIdOrSlugSchema, // Accepts UUID or slug
});

// Parsed values are automatically branded
const { journeyId } = RouteSchema.parse(params);
// journeyId is type JourneyIdOrSlug
```

## API Design Patterns

### Functions accepting both UUID and slug

```typescript
export async function getJourneyById(
  journeyIdOrSlug: JourneyIdOrSlug,
  organizationId: string
): Promise<JourneyConfigRecord | null> {
  const isUUID = isJourneyUuid(journeyIdOrSlug);

  const results = await db
    .select()
    .from(journeys)
    .where(isUUID
      ? eq(journeys.id, journeyIdOrSlug)
      : eq(journeys.slug, journeyIdOrSlug)
    );

  return results[0] ?? null;
}
```

### Functions returning UUIDs

```typescript
export async function verifyJourneyOrganization(
  journeyIdOrSlug: JourneyIdOrSlug,
  organizationId: string
): Promise<JourneyUuid | null> {
  // ... lookup logic
  return results.length > 0
    ? (results[0].id as JourneyUuid)  // DB id is always valid UUID
    : null;
}
```

## Frontend Usage

### In store state

```typescript
interface VersionStoreState {
  /** URL-friendly slug for routing */
  journeySlug: JourneySlug | null;
  /** Database UUID for API operations */
  journeyUuid: JourneyUuid | null;
}
```

### In API response types

```typescript
export interface JourneyMeta {
  /** Database UUID - use for API calls */
  id: JourneyUuid;
  /** URL-friendly slug - use for routing */
  slug: JourneySlug;
  name: string;
}
```

## Migration Guide

When updating existing code:

1. **Import branded types** from `@journey/schemas`
2. **Update function signatures** to use branded types
3. **Use type guards** where UUID/slug detection is needed
4. **Cast DB results** using `as JourneyUuid` (DB values are always valid)
5. **Remove duplicate regex/validators** - use imported ones

## Testing

Run branded-ids tests:

```bash
pnpm test:unit -- packages/schemas/src/__tests__/branded-ids.test.ts
```

## Files

- **Types & Schemas**: `packages/schemas/src/branded-ids.ts`
- **Tests**: `packages/schemas/src/__tests__/branded-ids.test.ts`
- **API Usage**: `apps/api/src/modules/journeys/journey-service.ts`
- **Frontend Types**: `apps/web/src/shared/lib/api/types.ts`
