# Pluggable Section & Field Registries

This guide explains the pluggable registry systems for node editor sections and form fields.

## Overview

The Journey Builder uses three registry systems:

| Registry                  | Purpose                                             | Location                         |
| ------------------------- | --------------------------------------------------- | -------------------------------- |
| **Section Registry**      | Capability-based sections (Timer, Media, Follow-up) | `editors/section-registry.ts`    |
| **Field Registry**        | Form extraction/building logic                      | `forms/field-registry.ts`        |
| **Edge Section Registry** | Edge-specific sections (Guard)                      | `edges/edge-section-registry.ts` |

## Section Registry

### Purpose

Renders sections based on node **capabilities** (what the node type can do):

```
Node Type: "message"
Capabilities: { hasTimer: true, hasMedia: true, hasFollowUp: true }
                    │              │               │
                    ▼              ▼               ▼
              Timer Section   Media Section   Follow-up Section
```

### Registering a Section

```typescript
// apps/web/src/features/nodes/journey/editors/sections/timer-section.tsx

import { sectionRegistry, type SectionProps } from "../section-registry";
import { Clock } from "lucide-react";

function TimerSectionContent({ form, readOnly }: SectionProps) {
  // Section implementation
  return (
    <div className="space-y-3">
      <DurationInput form={form} fieldPrefix="timer" readOnly={readOnly} />
    </div>
  );
}

// Self-register at module load
sectionRegistry.register({
  id: "timer",
  label: "Timer",
  icon: Clock,
  order: 30, // Controls section order
  shouldRender: (node, capabilities) => capabilities.hasTimer,
  component: TimerSectionContent,
});

export { TimerSectionContent as TimerSection };
```

### Using DynamicNodeSections

```typescript
// In your node editor

import { DynamicNodeSections } from "./dynamic-node-sections";

export function MessageNodeEditor({ node, form, readOnly }: Props) {
  return (
    <NodeEditorShell node={node} form={form}>
      {/* Fixed sections */}
      <MessageContentSection form={form} />
      <ButtonsSection form={form} />

      {/* Dynamic capability-based sections */}
      <DynamicNodeSections
        node={node}
        form={form}
        readOnly={readOnly}
        getInitialOpenState={(sectionId, n) => {
          if (sectionId === "followUp") return hasFollowUpSet(n);
          return false;
        }}
      />

      {/* Common sections (tags, variables, metadata) */}
      <EditorCommonSections form={form} nodeId={node.id} />
    </NodeEditorShell>
  );
}
```

### Section Registration API

```typescript
interface SectionDefinition {
  id: string; // Unique identifier
  label: string; // Display label
  icon: LucideIcon; // Section icon
  order: number; // Sort order (lower = first)
  shouldRender: (node, caps) => boolean; // When to show
  component: React.ComponentType<SectionProps>; // Section content
}

interface SectionProps {
  node: JourneyNode;
  form: NodeEditorFormApi;
  readOnly: boolean;
}
```

## Field Registry

### Purpose

Centralizes form field extraction and building:

```
Node Data → Extract → Form Values → Build → Node Data
     ↑                                          ↑
     └── fieldRegistry.extractAll() ◄──────────┘
                                    fieldRegistry.buildAll()
```

### Registering a Field

```typescript
// apps/web/src/features/nodes/journey/forms/field-definitions.ts

import { defineField, registerFields } from "./field-registry";

const timerField = defineField({
  id: "timer",
  capability: "hasTimer", // Only extract/build for nodes with this capability

  // Extract from node data to form values
  extract: (node) => {
    const seconds = node.data?.timer?.seconds ?? 0;
    const { days, hours, minutes, seconds: secs } = secondsToDHMS(seconds);
    return {
      timerDays: days || undefined,
      timerHours: hours || undefined,
      timerMinutes: minutes || undefined,
      timerSeconds: secs || undefined,
    };
  },

  // Build from form values to node data
  build: (form) => {
    const seconds = dhmsToSeconds(form.timerDays ?? 0, form.timerHours ?? 0, form.timerMinutes ?? 0, form.timerSeconds ?? 0);
    return seconds > 0 ? { timer: { seconds } } : { timer: undefined };
  },

  // Check if field has a value set
  hasValue: (node) => (node.data?.timer?.seconds ?? 0) > 0,
});

// Register at module load
registerFields([timerField, mediaField, followUpField /* ... */]);
```

### Using in Extractors/Builders

```typescript
// apps/web/src/features/nodes/journey/forms/node-form-extractors.ts

import { fieldRegistry } from "./field-registry";

export function extractMessageFields(node: JourneyNode) {
  // Get all registry-managed field values
  const registryFields = fieldRegistry.extractAll(node);

  return {
    ...extractCommonFields(node),
    type: node.data.type,
    content: node.data.content || "",
    // Registry handles timer, media, followUp, tagAction, variableAction, crmAction
    ...registryFields,
  };
}
```

```typescript
// apps/web/src/features/nodes/journey/forms/node-form-builders.ts

import { fieldRegistry } from "./field-registry";

export function buildMessageNodeData(form: MessageFormValues) {
  // Get all registry-managed field data
  const registryData = fieldRegistry.buildAll("message", form);

  return {
    type: "message",
    label: form.label,
    content: form.content,
    // Registry builds timer, media, followUp, tagAction, variableAction, crmAction
    ...registryData,
  };
}
```

### Field Definition API

```typescript
interface FieldDefinition {
  id: string; // Unique identifier
  capability: keyof NodeCapabilities; // Which nodes get this field

  // Extract from node data to form values
  extract: (node: JourneyNode) => Record<string, unknown>;

  // Build from form values to node data
  build: (form: FormState) => Partial<NodeData>;

  // Check if field has a value (for UI indicators)
  hasValue: (node: JourneyNode) => boolean;
}
```

## Edge Section Registry

### Purpose

Renders sections specific to edge editing (e.g., Guard conditions):

```typescript
// apps/web/src/features/nodes/journey/edges/edge-section-registry.ts

import { edgeSectionRegistry } from "./edge-section-registry";
import { Shield } from "lucide-react";

edgeSectionRegistry.register({
  id: "guard",
  label: "Guard",
  icon: Shield,
  order: 10,
  shouldRender: (edge) => edge.sourceHandle === "default",
  component: GuardSectionContent,
});
```

### Using DynamicEdgeSections

```typescript
import { DynamicEdgeSections } from "./dynamic-edge-sections";

export function EdgeEditor({ edge }: Props) {
  return (
    <div>
      <EdgeLabelSection edge={edge} />
      <DynamicEdgeSections edge={edge} />
    </div>
  );
}
```

## Node Capabilities

Capabilities determine which fields/sections apply to a node:

```typescript
// packages/schemas/src/nodes/capabilities.ts

export const NODE_CAPABILITIES: Record<NodeType, NodeCapabilities> = {
  message: {
    hasTimer: true,
    hasMedia: true,
    hasFollowUp: true,
    hasButtons: true,
    hasTagAction: true,
    hasVariableAssignment: true,
    hasCrmAction: true,
    // ...
  },
  questionnaire: {
    hasQuestions: true,
    hasTimeout: true,
    hasFollowUp: true,
    // ...
  },
  // ...
};
```

## Adding a New Capability-Based Feature

### Step 1: Add Capability

```typescript
// packages/schemas/src/nodes/capabilities.ts

export interface NodeCapabilities {
  // ... existing
  hasAnalytics?: boolean; // New capability
}

export const NODE_CAPABILITIES = {
  message: {
    // ... existing
    hasAnalytics: true,
  },
};
```

### Step 2: Add Field Definition

```typescript
// apps/web/src/features/nodes/journey/forms/field-definitions.ts

export const analyticsField = defineField({
  id: "analytics",
  capability: "hasAnalytics",

  extract: (node) => ({
    analyticsEnabled: node.data.analytics?.enabled ?? false,
    analyticsEvents: node.data.analytics?.events ?? [],
  }),

  build: (form) => {
    if (!form.analyticsEnabled) return { analytics: undefined };
    return {
      analytics: {
        enabled: true,
        events: form.analyticsEvents,
      },
    };
  },

  hasValue: (node) => node.data.analytics?.enabled ?? false,
});

// Add to builtinFields array
export const builtinFields = [
  // ... existing
  analyticsField,
];
```

### Step 3: Add Section

```typescript
// apps/web/src/features/nodes/journey/editors/sections/analytics-section.tsx

import { sectionRegistry, type SectionProps } from "../section-registry";
import { BarChart3 } from "lucide-react";

function AnalyticsSectionContent({ form, readOnly }: SectionProps) {
  return <div className="space-y-3">{/* Analytics configuration UI */}</div>;
}

sectionRegistry.register({
  id: "analytics",
  label: "Analytics",
  icon: BarChart3,
  order: 50,
  shouldRender: (_, caps) => caps.hasAnalytics === true,
  component: AnalyticsSectionContent,
});
```

### Step 4: Import for Side Effects

```typescript
// apps/web/src/features/nodes/journey/forms/form-registrations.ts

// Import for side-effect registration
import "./field-definitions";

// apps/web/src/features/nodes/journey/editors/sections/index.ts

// Import for side-effect registration
export * from "./analytics-section";
```

## Architecture Benefits

1. **Centralization**: Field logic in one place, not duplicated across extractors/builders
2. **Consistency**: All nodes use the same extraction/building patterns
3. **Extensibility**: New features via registration, no editor changes
4. **Maintainability**: Changes to a field affect all node types automatically
5. **Type Safety**: Capability checks at compile time

## Related Documentation

- [Using Array Field Hook](./using-array-field-hook.md) - Managing array fields
- [Adding Node Features](./adding-node-features.md) - Config-driven features
- [Migration Status](../proposals/active/pluggable-feature-system/04-migration-status.md) - Implementation details
