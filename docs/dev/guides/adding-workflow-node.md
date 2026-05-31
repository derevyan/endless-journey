# Adding a New Workflow Node

> Step-by-step guide for adding new node types to the Workflow Builder.

---

## Quick Reference Checklist

```
## Step 1: Schema Layer (@journey/schemas)
[ ] 1.1 Add config schema in packages/schemas/src/agents/workflow/nodes/{category}.ts
[ ] 1.2 Add to WorkflowNodeTypeSchema enum in node-type.ts
[ ] 1.3 Add to NODE_OUTPUT_HANDLES record in node-type.ts
[ ] 1.4 (If branching) Add to BRANCHING_NODE_TYPES array

## Step 2: Engine Layer (@journey/llm)
[ ] 2.1 Create executor class in packages/llm/src/workflow/executors/{category}/
[ ] 2.2 Export from executors/{category}/index.ts
[ ] 2.3 Import and register in executors/index.ts (registerBuiltinExecutors)

## Step 3: UI Layer (@journey/web) - JUST 2 ACTIONS!
[ ] 3.1 Create folder: nodes/definitions/{node-name}/
      - index.ts (definition + registration)
      - {node-name}-node.tsx (component)
      - {node-name}-node-config.tsx (config panel)
[ ] 3.2 Add import to nodes/definitions/index.ts

## Step 4: Verify
[ ] 4.1 Run `pnpm typecheck` - must pass
[ ] 4.2 Test in browser
```

---

## Detailed Steps

### Step 1: Schema Layer

#### 1.1 Add Config Schema

**File:** `packages/schemas/src/agents/workflow/nodes/{category}.ts`

Categories:

- `core.ts` - start, agent, end
- `tools.ts` - guard, context, mcp, question_understanding
- `logic.ts` - if_else, user_approval
- `data.ts` - transform, set_state

```typescript
// Example: New preprocessing node
export const MyNodeConfigSchema = z.object({
  /** Variable name to store result */
  outputVariable: z
    .string()
    .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/)
    .default("my_result"),

  /** Processing mode */
  mode: z.enum(["fast", "quality"]).default("quality"),

  /** Include debug info */
  debug: z.boolean().default(false),
});

export type MyNodeConfig = z.infer<typeof MyNodeConfigSchema>;
```

#### 1.2 Register Node Type

**File:** `packages/schemas/src/agents/workflow/node-type.ts`

```typescript
export const WorkflowNodeTypeSchema = z.enum([
  // ... existing nodes
  "my_node", // Add your node
]);
```

#### 1.3 Add Output Handles

**File:** `packages/schemas/src/agents/workflow/node-type.ts`

```typescript
export const NODE_OUTPUT_HANDLES: Record<WorkflowNodeType, string[]> = {
  // ... existing nodes
  my_node: ["default"], // Single output (pass-through)
  // OR for branching:
  my_node: ["success", "failure"], // Multiple outputs
};
```

---

### Step 2: Engine Layer

#### 2.1 Create Executor

**File:** `packages/llm/src/workflow/executors/{category}/my-node.ts`

```typescript
import type { MyNodeConfig } from "@journey/schemas";
import type { NodeInput, NodeOutput, WorkflowContext } from "../../types";
import { BaseNodeExecutor } from "../base-executor";

export class MyNodeExecutor extends BaseNodeExecutor<MyNodeConfig> {
  readonly nodeType = "my_node";

  protected async executeNode(input: NodeInput, config: MyNodeConfig, context: WorkflowContext): Promise<NodeOutput> {
    context.log.info({ mode: config.mode }, "workflow:my-node:start");

    try {
      // Your logic here
      const result = await processData(input.message, config);

      context.log.info({}, "workflow:my-node:complete");

      return {
        outHandle: "default", // Or conditional: result.success ? "success" : "failure"
        data: {
          [config.outputVariable]: result,
        },
        executionTimeMs: 0, // Set by BaseNodeExecutor
      };
    } catch (error) {
      context.log.error({ err: error }, "workflow:my-node:failed");
      throw error;
    }
  }
}
```

#### 2.2 Export Executor

**File:** `packages/llm/src/workflow/executors/{category}/index.ts`

```typescript
export { MyNodeExecutor } from "./my-node";
```

#### 2.3 Register Executor

**File:** `packages/llm/src/workflow/executors/index.ts`

```typescript
import { MyNodeExecutor } from "./{category}/my-node";

export function registerBuiltinExecutors(): void {
  // ...existing registrations
  registerNodeExecutor("my_node", new MyNodeExecutor());
}
```

---

### Step 3: UI Layer (Self-Registration Pattern)

The UI layer uses a **self-registration pattern** where nodes register themselves when imported.
This reduces adding a node from 6 synchronized files to just **1 folder + 1 import**.

#### 3.1 Create Node Definition Folder

Create a new folder: `apps/web/src/features/nodes/workflow/definitions/{node-name}/`

**File: `index.ts`** - Node definition and self-registration

```typescript
/**
 * My Node Definition
 * @module features/nodes/workflow/definitions/my-node
 */

import { MyIcon } from "lucide-react";
import { workflowNodeRegistry } from "../../registry/workflow-node-registry";
import { MyNode } from "./my-node-node";
import { MyNodeConfig } from "./my-node-node-config";

workflowNodeRegistry.register({
  type: "my_node",
  label: "My Node",
  description: "Brief description of what this node does",
  category: "tools", // "core" | "tools" | "logic" | "data"
  icon: MyIcon,
  color: "blue", // Choose from: slate, emerald, rose, sky, amber, indigo, violet, teal, cyan, orange, green, purple
  size: "standard", // "compact" | "standard"
  config: {
    isEntryPoint: false,
    isExitPoint: false,
    showTargetHandle: true,
    showSourceHandle: true,
    // For branching nodes, add:
    // sourceHandles: [
    //   { id: "success", label: "yes" },
    //   { id: "failure", label: "no" },
    // ],
  },
  createDefaultData: () => ({
    outputVariable: "my_result",
    mode: "quality",
    debug: false,
  }),
  component: MyNode,
  editor: MyNodeConfig,
});
```

**File: `my-node-node.tsx`** - Visual component for the canvas

```typescript
/**
 * My Node Component
 * @module features/nodes/workflow/definitions/my-node/my-node-node
 */

import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import type { MyNodeConfig as MyNodeConfigType } from "@journey/schemas";
import { MyIcon } from "lucide-react";

import { BaseWorkflowNode } from "../../components/base-workflow-node";
import type { WorkflowCanvasNode } from "../../../stores/agent-workflow-store";

export const MyNode = memo(function MyNode({ id, selected, data }: NodeProps<WorkflowCanvasNode>) {
  const config = data as unknown as MyNodeConfigType;
  const { isCurrentNode, isVisitedNode } = data as {
    isCurrentNode?: boolean;
    isVisitedNode?: boolean;
  };

  return (
    <BaseWorkflowNode
      id={id}
      selected={selected}
      isCurrentNode={isCurrentNode}
      isVisitedNode={isVisitedNode}
      icon={MyIcon}
      label="My Node"
      subtitle={config.mode || "Default mode"}
      nodeType="my_node"
    />
  );
});
```

**File: `my-node-node-config.tsx`** - Configuration panel component

```typescript
/**
 * My Node Config
 * @module features/nodes/workflow/definitions/my-node/my-node-node-config
 */

import { useCallback } from "react";
import type { MyNodeConfig as MyNodeConfigType } from "@journey/schemas";

import { agentWorkflowActions } from "../../../stores/agent-workflow-store";
import { Label } from "@/shared/components/ui/label";
import { Input } from "@/shared/components/ui/input";
import { Switch } from "@/shared/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";

interface MyNodeConfigProps {
  nodeId: string;
  data: MyNodeConfigType;
}

export function MyNodeConfig({ nodeId, data }: MyNodeConfigProps) {
  const handleUpdate = useCallback(
    (updates: Partial<MyNodeConfigType>) => {
      agentWorkflowActions.updateNodeData(nodeId, { ...data, ...updates });
    },
    [nodeId, data]
  );

  return (
    <div className="space-y-4">
      {/* Output Variable */}
      <div className="space-y-2">
        <Label>Output Variable</Label>
        <Input value={data.outputVariable || "my_result"} onChange={(e) => handleUpdate({ outputVariable: e.target.value })} placeholder="my_result" />
        <p className="text-xs text-muted-foreground">Variable name to store the result.</p>
      </div>

      {/* Mode Selection */}
      <div className="space-y-2">
        <Label>Mode</Label>
        <Select value={data.mode || "quality"} onValueChange={(value) => handleUpdate({ mode: value as MyNodeConfigType["mode"] })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="fast">Fast</SelectItem>
            <SelectItem value="quality">Quality</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Debug Toggle */}
      <div className="flex items-center justify-between">
        <Label>Debug Mode</Label>
        <Switch checked={data.debug ?? false} onCheckedChange={(checked) => handleUpdate({ debug: checked })} />
      </div>
    </div>
  );
}
```

#### 3.2 Add Import (Triggers Self-Registration)

**File:** `apps/web/src/features/nodes/workflow/definitions/index.ts`

```typescript
// ... existing imports
import "./my-node"; // Add this line - triggers self-registration!
```

**That's it!** The node will now appear in the selector panel, render correctly on the canvas, and have a working configuration panel.

---

## File Structure

```
apps/web/src/features/agent-workflows/
  nodes/
    registry/
      workflow-node-registry.tsx   # Registry class
      types.ts                     # Shared interfaces
    definitions/
      index.ts                     # Import trigger
      my-node/                     # YOUR NEW NODE
        index.ts                   # Definition + registration
        my-node-node.tsx           # Visual component
        my-node-node-config.tsx    # Config panel
      start/                       # Existing nodes...
      end/
      agent/
      guard/
      ...
    components/
      base-workflow-node.tsx       # Shared base component
```

---

## Common Patterns

### Pass-Through Node (Single Output)

```typescript
return {
  outHandle: "default",
  data: { [config.outputVariable]: result },
  executionTimeMs: 0,
};
```

### Branching Node (Multiple Outputs)

In definition:

```typescript
config: {
  sourceHandles: [
    { id: "success", label: "yes" },
    { id: "failure", label: "no" },
  ],
}
```

In executor:

```typescript
return {
  outHandle: condition ? "success" : "failure",
  data: { result },
  executionTimeMs: 0,
};
```

### Blocking Node (Terminate Workflow)

```typescript
if (shouldBlock) {
  return {
    blocked: true,
    blockedMessage: config.blockedMessage,
    outHandle: "blocked",
    executionTimeMs: 0,
  };
}
```

### Variable Storage (For Downstream Nodes)

```typescript
// Data is auto-merged into input.variables for next node
return {
  outHandle: "default",
  data: {
    myVar: value, // Access via {{variables.myVar}}
    userMessageOverride: x, // Special: Agent uses as user message
  },
};
```

### Error Handling

```typescript
try {
  // Logic
} catch (error) {
  context.log.error({ err: error }, "workflow:my-node:failed");

  // Option 1: Throw (workflow stops)
  throw error;

  // Option 2: Return fallback (workflow continues)
  return {
    outHandle: "default",
    data: { [config.outputVariable]: "" },
    metadata: { error: error.message },
  };
}
```

---

## Reference Files

| Purpose          | File                                                         |
| ---------------- | ------------------------------------------------------------ |
| Schema pattern   | `packages/schemas/src/agents/workflow/nodes/tools.ts`        |
| Executor pattern | `packages/llm/src/workflow/executors/tools/guard.ts`         |
| Node definition  | `apps/web/.../nodes/definitions/guard/index.ts`              |
| Node component   | `apps/web/.../nodes/definitions/guard/guard-node.tsx`        |
| Config component | `apps/web/.../nodes/definitions/guard/guard-node-config.tsx` |
| Registry types   | `apps/web/.../nodes/registry/types.ts`                       |

---

## Available Colors

Choose from these predefined color themes for your node's `color` property:

| Color     | Usage                        |
| --------- | ---------------------------- |
| `slate`   | Core nodes (start)           |
| `emerald` | Success/completion nodes     |
| `rose`    | Safety/guard nodes           |
| `sky`     | AI/agent nodes               |
| `amber`   | Warning/conditional nodes    |
| `indigo`  | Logic nodes                  |
| `violet`  | Transform/data nodes         |
| `teal`    | State/storage nodes          |
| `cyan`    | External/MCP nodes           |
| `orange`  | User interaction nodes       |
| `green`   | Completed/visited indicator  |
| `purple`  | Question/understanding nodes |

---

## Tips

1. **Start with schema** - Types flow through the entire system
2. **Follow existing patterns** - Look at Guard node for safety nodes, SetState for data nodes
3. **Test early** - Run `pnpm typecheck` after each layer
4. **Use `userMessageOverride`** - For preprocessing nodes that should feed into Agent
5. **Choose unique color** - Makes nodes visually distinct on canvas
6. **Self-registration is automatic** - Just adding the import triggers registration
