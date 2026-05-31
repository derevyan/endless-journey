# New Node Scaffolder: {nodeType}

## 🎯 Mission
Create a new Journey Node type with all required boilerplate files. Use via `/new-node {nodeType}`.

## 🛠️ Execution Steps

### 1. Create Component
Create `apps/web/src/features/journey/nodes/components/{NodeType}-node.tsx`:
```typescript
import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { BaseNode } from "./base/base-node";
import type { {PascalCaseNodeType}NodeData } from "../types";
import { NodeProps } from "@xyflow/react";

export const {PascalCaseNodeType}Node = memo(({ data, selected }: NodeProps<{PascalCaseNodeType}Node>) => {
  return (
    <BaseNode
      data={data}
      selected={selected}
      icon={YourIcon}
      title="{PascalCaseNodeType}"
    >
      <div className="p-4 text-sm">
        Node content here
      </div>
    </BaseNode>
  );
});
```

### 2. Create Editor
Create `apps/web/src/features/journey/nodes/editors/{NodeType}-node-editor.tsx`:
```typescript
import { useEditorActionsContext } from "../../builder/context";
import { EditorPanel } from "@/shared/components/editor-panel";
import type { {PascalCaseNodeType}NodeData } from "../types";

export function {PascalCaseNodeType}NodeEditor({ node }: { node: {PascalCaseNodeType}Node }) {
  const { updateNode } = useEditorActionsContext();

  return (
    <EditorPanel title="Edit {PascalCaseNodeType}">
      {/* Add form fields here */}
    </EditorPanel>
  );
}
```

### 3. Create Definition (Registration)
Create `apps/web/src/features/journey/nodes/definitions/{NodeType}.ts`:
```typescript
import { nodeRegistry, DEFAULT_FEATURES } from "../registry/node-registry";
import { getNodeTheme } from "../config/node-theme";
import { {PascalCaseNodeType}Node } from "../components/{NodeType}-node";
import { {PascalCaseNodeType}NodeEditor } from "../editors/{NodeType}-node-editor";
import { Activity } from "lucide-react"; // Replace with appropriate icon
import type { {PascalCaseNodeType}NodeData } from "../types";

nodeRegistry.register({
  type: "{NodeType}",
  label: "{PascalCaseNodeType}",
  description: "Description of what this node does",
  category: "custom", // logic, communication, etc.
  icon: Activity,
  colors: getNodeTheme("default"),
  config: {
    features: DEFAULT_FEATURES,
    maxOutgoingEdges: 1,
  },
  createDefaultData: (): {PascalCaseNodeType}NodeData => ({
    type: "{NodeType}",
    label: "{PascalCaseNodeType}",
    // Add custom fields
  }),
  component: {PascalCaseNodeType}Node,
  editor: {PascalCaseNodeType}NodeEditor,
});
```

### 4. Update Types
> [!NOTE]
> You may need to add `{PascalCaseNodeType}NodeData` to `apps/web/src/features/journey/nodes/types.ts` manually if strict typing is enforced there.

## ✅ Validation
- Run `pnpm typecheck`.
