# Adding Features to Nodes

This guide explains how to add new shared features to node editors using the **capability-driven** section/field registries.

## Overview

The Journey Builder uses **capabilities** from `@journey/schemas` to decide which editor sections and form fields apply to each node type.

1. **Capabilities** live in `packages/schemas/src/nodes/capabilities.ts`.
2. **Sections** register with `sectionRegistry` and render when `shouldRender` passes.
3. **Fields** register with `fieldRegistry` for capability-aware extract/build.

There is no `config.features` or `NodeConfigOptions` in the current system.

## Key Files

| File                                                                      | Purpose                                              |
| ------------------------------------------------------------------------- | ---------------------------------------------------- |
| `packages/schemas/src/nodes/capabilities.ts`                              | Node capability flags (single source of truth)       |
| `apps/web/src/features/nodes/journey/registry/section-registry.ts`        | Section discovery + ordering                          |
| `apps/web/src/features/nodes/journey/editors/editor-common-sections.tsx`  | Renders common capability-based sections              |
| `apps/web/src/features/nodes/journey/editors/dynamic-node-sections.tsx`   | Renders node-specific capability-based sections       |
| `apps/web/src/features/nodes/journey/forms/field-definitions.ts`          | Field registry definitions for shared fields          |
| `apps/web/src/features/nodes/journey/types/<node>/form.ts`                | Node-specific form extraction/building                |

## Enabling/Disabling Features Per Node

Update the node capabilities in `packages/schemas/src/nodes/capabilities.ts`:

```typescript
export const NODE_CAPABILITIES: Record<NodeType, NodeCapabilities> = {
  message: {
    ...DEFAULT_CAPABILITIES,
    hasTextMessage: true,
    hasButtons: true,
    hasTimer: true,
    hasTagAction: true,
    hasVariableAssignment: true,
  },
};
```

Capabilities automatically drive:

- `sectionRegistry` (which sections render)
- `fieldRegistry` (which fields extract/build)
- UI components that check `getNodeCapabilities()`

## Adding a New Common Feature

### Step 1: Add a Capability (if needed)

If this feature is new, add a flag to `NodeCapabilitiesSchema` in `packages/schemas/src/nodes/capabilities.ts` and update the relevant node entries in `NODE_CAPABILITIES`.

### Step 2: Create a Section Component

Create a section under `apps/web/src/features/nodes/journey/editors/sections/` and register it:

```typescript
import { SectionOrder, sectionRegistry, type SectionDefinition } from "../registry/section-registry";

const analyticsSectionDefinition = {
  id: "analytics",
  label: "Analytics",
  order: SectionOrder.METADATA,
  scope: "common",
  shouldRender: (_node, caps) => caps.hasAnalytics === true,
  component: AnalyticsSectionAdapter,
} satisfies SectionDefinition;

sectionRegistry.register(analyticsSectionDefinition);
```

### Step 3: Ensure the Section Registers

Add a side-effect import in the appropriate host:

- **Common sections**: `apps/web/src/features/nodes/journey/editors/editor-common-sections.tsx`
- **Node-specific sections**: `apps/web/src/features/nodes/journey/editors/dynamic-node-sections.tsx` or the node editor itself

### Step 4: Add Field Mapping (Optional)

If the feature stores data in node data, add a field definition to `apps/web/src/features/nodes/journey/forms/field-definitions.ts` so extract/build stays consistent:

```typescript
registerFields([
  defineField({
    id: "analytics",
    capability: "hasAnalytics",
    extract: (node) => ({ analytics: extractAnalytics(node) }),
    build: (form) => ({ analytics: buildAnalytics(form) }),
    hasValue: (node) => hasAnalytics(node),
  }),
]);
```

### Step 5: Update Schemas (If Needed)

If the feature adds new data, extend `BaseNodeDataSchema` or the node-specific schema in `packages/schemas/src/nodes/types/<node>/schema.ts`.

## Summary

| Step | Location                                                                 | Change                                      |
| ---- | ------------------------------------------------------------------------ | ------------------------------------------- |
| 1    | `packages/schemas/src/nodes/capabilities.ts`                             | Add/enable capability                        |
| 2    | `apps/web/src/features/nodes/journey/editors/sections/*`                 | Create + register section                    |
| 3    | `editor-common-sections.tsx` / `dynamic-node-sections.tsx`               | Ensure side-effect import                    |
| 4    | `apps/web/src/features/nodes/journey/forms/field-definitions.ts`         | Add field extract/build (optional)           |
| 5    | `packages/schemas/src/nodes/types/<node>/schema.ts`                      | Add data schema (if storing new fields)      |

This keeps feature visibility driven by capabilities and avoids per-editor conditionals.
