# Adding a New Node Type

This guide explains how to add a new node type to the Journey Builder using the auto-discovery plugin architecture.

## Overview

The node system uses a **self-registration pattern** where each node type defines its configuration in a dedicated folder. Importing the descriptor triggers registration with the node registry.

## Files to Create

Adding a new node type requires creating **5+ files** and adding **2 import lines**:

| File                                                     | Purpose                                |
| -------------------------------------------------------- | -------------------------------------- |
| `apps/web/src/features/nodes/journey/types/<type>/descriptor.ts`          | Frontend descriptor (config, registration) |
| `apps/web/src/features/nodes/journey/types/<type>/component.tsx`          | Visual component for React Flow        |
| `apps/web/src/features/nodes/journey/types/<type>/editor.tsx`             | Editor panel component                 |
| `apps/web/src/features/nodes/journey/types/<type>/form.ts`                | Form handlers (schema/extract/build)   |
| `packages/engine/src/handlers/types/<type>/handler.ts`                    | Runtime execution logic                |
| `packages/engine/src/handlers/types/<type>/descriptor.ts`                 | Backend descriptor registration        |

Plus import lines in:

- `apps/web/src/features/nodes/journey/types/index.ts` (frontend registration)
- `packages/engine/src/handlers/index.ts` (engine handler registration)

**No modifications needed to:**

- `node-wrapper.tsx`
- `node-editor-panel.tsx`
- `node-selector-panel.tsx`
- Any config files

## Step-by-Step Guide

### Step 1: Create the Schema (if needed)

If your node type needs new data fields, create a schema in `packages/schemas/src/nodes/types/<type>/`:

```typescript
// packages/schemas/src/nodes/types/delay/schema.ts
import { z } from "zod";
import { BaseNodeDataSchema } from "../../base";

export const DelayNodeDataSchema = BaseNodeDataSchema.extend({
  type: z.literal("delay"),
  duration: z.object({
    seconds: z.number().min(1),
    randomize: z.boolean().optional(),
  }),
  reason: z.string().optional(),
});

export type DelayNodeData = z.infer<typeof DelayNodeDataSchema>;
```

Then export from `packages/schemas/src/nodes/index.ts`:

```typescript
// Add to exports
export { DelayNodeDataSchema, type DelayNodeData } from "./delay";

// Add to NodeTypeValues
export const NodeTypeValues = ["start", "message", "condition", "wait", "webhook", "end", "delay"] as const;

// Add to discriminated union
export const JourneyStepDataSchema = z.discriminatedUnion("type", [
  // ... existing schemas
  DelayNodeDataSchema,
]);
```

Also add a descriptor for the node type in `packages/schemas/src/nodes/types/delay/descriptor.ts`, and export it from `packages/schemas/src/nodes/types/delay/index.ts`.

### Step 2: Create the Node Definition

Create a definition file that registers the node with all its configuration:

```typescript
// apps/web/src/features/nodes/journey/types/delay/descriptor.ts

import { Timer } from "lucide-react";
import { delayNodeDescriptor, type DelayNodeData } from "@journey/schemas";

import { getNodeTheme } from "../../config/node-theme";
import { nodeRegistry, type FrontendNodeDescriptor } from "../../registry/node-registry";
import { DelayNode } from "./component";
import { DelayNodeEditor } from "./editor";
import { delayFormHandlers } from "./form";

const delayFrontendDescriptor: FrontendNodeDescriptor<DelayNodeData> = {
  ...delayNodeDescriptor,
  icon: Timer,
  colors: getNodeTheme("wait"),
  formHandlers: delayFormHandlers,
  component: DelayNode,
  editor: DelayNodeEditor,
};

nodeRegistry.register(delayFrontendDescriptor);
```

### Step 3: Create the Visual Component

Create the React component that renders the node in the canvas:

```typescript
// apps/web/src/features/nodes/journey/types/delay/component.tsx

import { Timer } from "lucide-react";
import { memo } from "react";

import type { DelayNodeData } from "@journey/schemas";
import { NodeTypeEnum } from "@/features/nodes/journey/react-flow-types";
import { BaseNode } from "../../components/base-node";

interface DelayNodeProps {
  data: DelayNodeData;
}

export const DelayNode = memo(function DelayNode({ data }: DelayNodeProps) {
  const duration = data.duration?.seconds || 0;
  const isRandomized = data.duration?.randomize || false;

  return (
    <BaseNode nodeType={NodeTypeEnum.DELAY} label={data.label}>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Timer className="w-4 h-4" />
        <span>
          {duration}s{isRandomized && " (±random)"}
        </span>
      </div>
      {data.reason && <p className="text-xs text-muted-foreground mt-1">{data.reason}</p>}
    </BaseNode>
  );
});
```

**Note:** You can use `BaseNode` for standard card-style nodes, or create a custom design like `wait-node.tsx` does with its pill shape.

### Step 4: Create the Editor Component

Create the editor panel that appears when the node is selected:

```typescript
// apps/web/src/features/nodes/journey/types/delay/editor.tsx

import { useCallback } from "react";

import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Switch } from "@/shared/components/ui/switch";
import { Textarea } from "@/shared/components/ui/textarea";

import { useNodeEditorForm } from "../../hooks/use-node-editor-form";
import { EditorBase } from "../../editors/editor-base";
import { EditorNameField } from "../../editors/editor-common-fields";
import { EditorCommonSections } from "../../editors/editor-common-sections";
import type { NodeEditorProps } from "../../editors/types";

export function DelayNodeEditor({ node, onClose, onDelete, readOnly }: NodeEditorProps) {
  const { form, isDirty, isSaving, validateAndSave, validationErrors, resetForm } = useNodeEditorForm(node);

  const handleCancel = useCallback(() => {
    resetForm();
  }, [resetForm]);

  return (
    <EditorBase
      title={readOnly ? "Delay Node Info" : "Edit Delay Node"}
      nodeId={node.id}
      onClose={onClose}
      onDelete={onDelete}
      onAutoSaveClose={validateAndSave}
      onSave={validateAndSave}
      onCancel={handleCancel}
      isSaving={isSaving}
      isDirty={isDirty}
      readOnly={readOnly}
    >
      {/* 1. Name field */}
      <EditorNameField form={form} nodeId={node.id} readOnly={readOnly} />

      {/* 2. Node-specific fields */}
      <div className="space-y-4">
        <form.Field name="duration.seconds">
          {(field) => (
            <div className="space-y-2">
              <Label htmlFor={`duration-${node.id}`}>Duration (seconds)</Label>
              <Input
                id={`duration-${node.id}`}
                type="number"
                min={1}
                value={field.state.value || 60}
                onChange={(e) => field.handleChange(parseInt(e.target.value, 10) || 60)}
                disabled={readOnly}
              />
            </div>
          )}
        </form.Field>

        <form.Field name="duration.randomize">
          {(field) => (
            <div className="flex items-center gap-2">
              <Switch
                id={`randomize-${node.id}`}
                checked={field.state.value || false}
                onCheckedChange={(checked) => field.handleChange(checked)}
                disabled={readOnly}
              />
              <Label htmlFor={`randomize-${node.id}`}>Randomize timing</Label>
            </div>
          )}
        </form.Field>

        <form.Field name="reason">
          {(field) => (
            <div className="space-y-2">
              <Label htmlFor={`reason-${node.id}`}>Reason (optional)</Label>
              <Textarea
                id={`reason-${node.id}`}
                placeholder="Why this delay?"
                value={field.state.value || ""}
                onChange={(e) => field.handleChange(e.target.value)}
                disabled={readOnly}
              />
            </div>
          )}
        </form.Field>
      </div>

      {/* 3. Common sections (Tags, Variables, Metadata, Advanced) */}
      <EditorCommonSections
        form={form}
        nodeId={node.id}
        nodeType={node.data.type}
        readOnly={readOnly}
        validationErrors={validationErrors}
      />
    </EditorBase>
  );
}
```

**Important:** Use `EditorCommonSections` with `nodeType={node.data.type}` to automatically render common sections based on the node's declared `capabilities`.

#### Using EditorActionsContext for Component Isolation

For better testability and component isolation, node editors can use `useEditorActionsContext()` instead of direct store imports. This provides dependency-injected actions that can be mocked in tests:

```typescript
// apps/web/src/features/nodes/journey/types/delay/editor.tsx

import { useEditorActionsContext } from "@/features/journey/builder/context";
import { useNodeEditorForm } from "../hooks/use-node-editor-form";
// ... other imports

export function DelayNodeEditor({ node, onClose, onDelete, readOnly }: NodeEditorProps) {
  const { form, validateAndSave } = useNodeEditorForm(node);

  // Get injected actions from context (enables mocking in tests)
  const { updateNode, deleteNode, setButtonTarget, notify } = useEditorActionsContext();

  // Example: Custom save with notification
  const handleCustomSave = () => {
    updateNode(node.id, { data: form.state.values });
    notify.success("Node saved!");
  };

  return (
    <EditorBase
      title="Edit Delay Node"
      nodeId={node.id}
      onClose={onClose}
      onDelete={onDelete}
      onSave={validateAndSave}
      readOnly={readOnly}
    >
      {/* ... editor content ... */}
    </EditorBase>
  );
}
```

**Available Context Actions:**

| Action | Description |
|--------|-------------|
| `updateNode(id, updates)` | Update node data with sync |
| `deleteNode(id)` | Delete node (auto-clears selection) |
| `updateEdge(id, updates)` | Update edge data |
| `deleteEdge(id)` | Delete edge (handles managed/virtual edges) |
| `deleteEdgeRaw(id)` | Raw edge deletion (use when managing form state) |
| `setButtonTarget(nodeId, buttonId, targetNodeId)` | Set button target with managed edge sync |
| `setPendingChanges(pending)` | Mark journey as having unsaved changes |
| `clearSelection()` | Clear current node/edge selection |
| `notify.success/error/warning/info()` | Toast notifications |

**When to use `deleteEdgeRaw`:** Use this instead of `deleteEdge` when you're managing button state in a form and deleting the associated managed edge. The regular `deleteEdge` would also clear the button's `targetNodeId` in the store, causing a form reset conflict.

### Step 5: Register the Definition

Add one import line to trigger auto-registration:

```typescript
// apps/web/src/features/nodes/journey/types/index.ts

// Import all descriptors to trigger self-registration
import "./start/descriptor";
import "./message/descriptor";
import "./condition/descriptor";
import "./wait/descriptor";
import "./webhook/descriptor";
import "./end/descriptor";
import "./delay/descriptor"; // Add this line
```

### Step 6: Add Engine Handler

**All nodes must have execution logic.** Even the simplest nodes need a handler to define how they execute at runtime. Create a handler in `packages/engine/src/handlers/types/<type>/`:

```typescript
// packages/engine/src/handlers/types/delay/handler.ts

import type { DelayNodeData } from "@journey/schemas";

import type { ExecutionContext, HandlerResult } from "../../../types";
import { BaseNodeHandler } from "../../base-handler";

export class DelayNodeHandler extends BaseNodeHandler<DelayNodeData> {
  readonly nodeType = "delay" as const;

  protected async executeNode(context: ExecutionContext): Promise<HandlerResult> {
    const { node, outgoingEdges, services, log } = context;
    const nodeData = node.data as DelayNodeData;

    let delay = nodeData.duration.seconds;

    if (nodeData.duration.randomize) {
      // Add ±20% randomization
      const variance = delay * 0.2;
      delay = delay + (Math.random() * variance * 2 - variance);
    }

    const delayMs = Math.round(delay) * 1000;

    // Schedule timer for the delay
    if (outgoingEdges.length > 0) {
      services.timer.scheduleTimer(delayMs, outgoingEdges[0].id);
      log.info({ nodeId: node.id, delayMs, edgeId: outgoingEdges[0].id }, "delay:timerScheduled");
    }

    return { action: "wait" };
  }
}

export const delayHandler = new DelayNodeHandler();
```

Register the backend descriptor so the handler is discoverable:

```typescript
// packages/engine/src/handlers/types/delay/descriptor.ts

import { delayNodeDescriptor } from "@journey/schemas";

import { backendNodeRegistry } from "../../descriptors/backend-descriptor";
import { delayHandler } from "./handler";

backendNodeRegistry.register({
  ...delayNodeDescriptor,
  handler: delayHandler,
});
```

Then register in `packages/engine/src/handlers/index.ts`:

```typescript
import { delayHandler } from "./types/delay";

const defaultHandlers: NodeHandler[] = [
  // ... existing handlers
  delayHandler,
];
```

**Note:** Even simple nodes that just transition to the next node need a handler. For example, a pass-through node would still need a handler that reads the outgoing edges and transitions accordingly. See `packages/engine/src/handlers/types/start/handler.ts` or `packages/engine/src/handlers/types/end/handler.ts` for examples of simpler handlers.

### Advanced: Stateful Handlers

For complex node types that maintain internal state across multiple executions (like multi-turn conversations or sequential questionnaires), use **dedicated state managers** to encapsulate state operations:

```typescript
// packages/engine/src/handlers/survey-handler.ts

import type { NodeHandler, ExecutionContext, HandlerResult } from "../types";
import {
  createSurveyStateManager,
  createDefaultSurveyState,
} from "../state/survey-state-manager";
import type { SurveyState } from "@journey/schemas";

export const surveyHandler: NodeHandler = {
  nodeType: "survey",

  async execute(context: ExecutionContext): Promise<HandlerResult> {
    const { node, services, log } = context;

    // Get or initialize state
    let state = context.getState<SurveyState>();
    if (!state) {
      state = createDefaultSurveyState(node.data);
      context.setState(state);
    }

    // Create state manager for encapsulated operations
    const stateManager = createSurveyStateManager(state, context.setState);

    // Use state manager methods instead of direct state mutation
    if (!stateManager.isComplete()) {
      const questionId = stateManager.getCurrentQuestionId();
      await services.messenger.sendMessage(`Question: ${questionId}`);
      return { action: "wait" };
    }

    return { action: "transition", targetNodeId: "next-node" };
  },
};
```

**When to use state managers:**
- Multi-step interactions (questionnaires, surveys)
- Multi-turn conversations (agent nodes)
- Nodes that track progress, usage, or accumulated data

**Existing state managers:**
- `AgentStateManager` - Agent node state (workflow init, greeting, usage tracking)
- `QuestionnaireStateManager` - Questionnaire progress (index, responses, skipped)

See `docs/engine/README.md` § "Node-Specific State Managers" for full API reference.

## Node Definition Reference

### NodeDefinition Interface

```typescript
interface NodeDefinition {
  type: NodeType; // Unique identifier (e.g., "delay")
  label: string; // Display name (e.g., "Delay")
  description: string; // Tooltip/docs description
  category: "flow" | "action" | "logic" | "integration";
  icon: LucideIcon; // Lucide icon component
  colors: NodeColorScheme; // Color scheme for theming
  config: NodeConfigOptions;
  createDefaultData: () => JourneyStepData;
  component: ComponentType<any>; // Visual React component
  editor: ComponentType<any>; // Editor panel component
}
```

### NodeConfigOptions Interface

```typescript
interface NodeConfigOptions {
  // Feature flags - control which editor sections appear
  features: {
    tags: boolean; // Show UserTagsSection
    variables: boolean; // Show VariableActionSection
    metadata: boolean; // Show EditorMetadataSection
  };
  // Node capabilities
  canHaveButtons: boolean; // Can this node have button outputs?
  canHaveTimer: boolean; // Can this node have a timer?
  canHaveMedia: boolean; // Can this node display media?
  isEntryPoint: boolean; // Is this a journey entry point?
  isExitPoint: boolean; // Is this a journey exit point?
  maxOutgoingEdges: number; // 0 = unlimited
}
```

### Categories

| Category      | Description       | Examples        |
| ------------- | ----------------- | --------------- |
| `flow`        | Journey structure | start, end      |
| `action`      | User interaction  | message         |
| `logic`       | Branching/timing  | condition, wait |
| `integration` | External services | webhook         |

### Color Scheme Recommendations

| Node Type       | Primary Color   | Use Case  |
| --------------- | --------------- | --------- |
| Entry points    | emerald (green) | start     |
| Messages        | blue            | message   |
| Logic/branching | violet (purple) | condition |
| Timing/delays   | orange          | wait      |
| External APIs   | amber (yellow)  | webhook   |
| Exit points     | rose (red)      | end       |

## Testing Your Node

1. **Run typecheck**:

   ```bash
   pnpm typecheck
   ```

2. **Run tests**:

   ```bash
   pnpm test
   ```

3. **Start dev server**:

   ```bash
   pnpm dev
   ```

4. **Test in browser**:
   - Open the journey editor
   - The new node should appear in the "Add Nodes" panel
   - Drag it to the canvas
   - Click to open the editor
   - Verify styling and functionality

## Troubleshooting

### Node doesn't appear in selector

- Verify the import line is added to `types/index.ts`
- Check for TypeScript errors in the descriptor file
- Ensure `isEntryPoint` is `false` (entry points are filtered out)

### Component not rendering

- Check the component is exported correctly
- Verify the component receives and uses props correctly
- Check browser console for errors

### Editor not opening

- Verify the editor component is exported correctly
- Check that props match the expected interface
- Look for errors in the browser console

### Features not appearing in editor

- Verify the node's `capabilities` in the shared descriptor (schemas) include the expected feature flags
- Check that `EditorCommonSections` has `nodeType={node.data.type}` prop
- Ensure the relevant sections are registered in the section registry

### Styling issues

- Verify Tailwind classes are valid
- Check dark mode variants are included
- Test both light and dark themes

## Example: Complete Delay Node

See the example files in this guide for a complete reference implementation. The pattern follows the existing node types:

- `apps/web/src/features/nodes/journey/types/wait/descriptor.ts` - Similar logic node descriptor
- `apps/web/src/features/nodes/journey/types/wait/component.tsx` - Custom visual design
- `apps/web/src/features/nodes/journey/types/wait/editor.tsx` - Editor with duration
- `packages/engine/src/handlers/types/wait/handler.ts` - Runtime execution logic

For simpler examples, see:

- `packages/engine/src/handlers/types/start/handler.ts` - Simple auto-transition handler
- `packages/engine/src/handlers/types/end/handler.ts` - Terminal node handler

For complex stateful handlers, see:

- `packages/engine/src/handlers/types/agent/handler.ts` - Multi-turn AI conversations with state manager
- `packages/engine/src/handlers/types/questionnaire/handler.ts` - Sequential questions with state manager

## Related Guides

- [Adding Features to Nodes](./adding-node-features.md) - How to add new common features like analytics
