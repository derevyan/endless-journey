# Import Boundary Exceptions

> This document tracks approved exceptions to the import boundary rules enforced by `eslint-plugin-boundaries`.

## Overview

Our architecture follows a **vertical slice** pattern where each feature is isolated and can only import from:

1. **Its own feature** - Files within the same feature directory
2. **Shared kernel** - `@/shared/*`, `@/stores/*`, `@/components/*`, `@/hooks/*`
3. **External packages** - `@journey/schemas`, `@journey/logger`, `@journey/engine`
4. **Data files** - `@/data/*`

Features **cannot** import directly from other features. When cross-feature functionality is needed, it should be:

1. Extracted to shared kernel, or
2. Communicated via the event bus

## Approved Exceptions

| From Feature | To Feature | Files Affected | Reason | Issue |
|-------------|-----------|----------------|--------|-------|
| *None yet* | - | - | - | - |

## Adding New Exceptions

Before adding an exception:

1. **Consider extraction** - Can this be moved to `@/shared/*`?
2. **Consider events** - Can this use `storeEventBus` instead?
3. **Document thoroughly** - Add to this table with issue link

To add an exception, update the ESLint config in `apps/web/eslint.config.js`:

```js
// In the "from: feature" rule, add:
{
  from: ["feature"],
  allow: [
    // ... existing allowed imports ...
    // Exception: Feature X needs to import from Feature Y
    // Reason: [brief explanation]
    // Issue: #XXX
    ["feature", { feature: "feature-y" }],
  ],
},
```

## How to Fix Violations

When you see an import boundary violation:

1. **Identify the import** - Which feature is importing from which?
2. **Evaluate options**:
   - Move shared logic to `@/shared/lib/`
   - Move shared components to `@/shared/components/`
   - Move shared types to `@journey/schemas`
   - Use event bus for state communication
3. **If exception needed** - Create issue and add to this document

## Related Documentation

- [Project Structure](./project-structure.md)
- [Store Architecture](../guides/store-initialization.md)
- [Component Organization](../guides/component-organization.md)
