# Using the useArrayField Hook

This guide explains how to use `useArrayField` for managing array fields in node editors with proper reactivity and CRUD operations.

## Overview

The `useArrayField` hook provides a type-safe, reactive way to manage array fields in TanStack Form-based node editors. It eliminates duplicate array manipulation patterns and provides consistent CRUD operations.

## When to Use

Use `useArrayField` when you need to:

- Add/remove items from a form array field
- Update individual items in an array
- Reorder items (drag-and-drop)
- Subscribe to array changes reactively

## Basic Usage

```typescript
import { useArrayField } from "@/features/nodes/journey/hooks/use-array-field";
import type { ButtonConfig } from "@journey/schemas";

function MyNodeEditor({ node }: NodeEditorProps) {
  const form = useNodeEditorForm(node);

  // Create array field manager for buttons
  const buttons = useArrayField<ButtonConfig>(form, "buttons");

  // Access current items (reactive - triggers re-render on changes)
  const buttonCount = buttons.count;
  const isEmpty = buttons.isEmpty;

  // Add a new button
  const handleAdd = () => {
    buttons.add({
      id: generateButtonId(),
      text: "New Button",
    });
  };

  // Update a button by index
  const handleUpdateText = (index: number, text: string) => {
    buttons.updateByIndex(index, { text });
  };

  // Remove a button
  const handleRemove = (index: number) => {
    buttons.removeByIndex(index);
  };

  return (
    <div>
      {buttons.items.map((btn, index) => (
        <div key={btn.id}>
          <input value={btn.text} onChange={(e) => handleUpdateText(index, e.target.value)} />
          <button onClick={() => handleRemove(index)}>Remove</button>
        </div>
      ))}
      <button onClick={handleAdd}>Add Button</button>
    </div>
  );
}
```

## API Reference

### `useArrayField<T>(form, fieldName)`

Returns a `UseArrayFieldReturn<T>` object with:

| Property/Method                 | Type                                           | Description              |
| ------------------------------- | ---------------------------------------------- | ------------------------ |
| `items`                         | `T[]`                                          | Current items (reactive) |
| `add(item)`                     | `(item: T) => void`                            | Add item to end of array |
| `updateByIndex(index, updates)` | `(index: number, updates: Partial<T>) => void` | Update item at index     |
| `updateById(id, updates)`       | `(id: string, updates: Partial<T>) => void`    | Update item by ID        |
| `removeByIndex(index)`          | `(index: number) => void`                      | Remove item at index     |
| `removeById(id)`                | `(id: string) => void`                         | Remove item by ID        |
| `move(from, to)`                | `(fromIndex: number, toIndex: number) => void` | Reorder items            |
| `setItems(items)`               | `(items: T[]) => void`                         | Replace all items        |
| `getByIndex(index)`             | `(index: number) => T \| undefined`            | Get item at index        |
| `getById(id)`                   | `(id: string) => T \| undefined`               | Get item by ID           |
| `isEmpty`                       | `boolean`                                      | Whether array is empty   |
| `count`                         | `number`                                       | Number of items          |

### Type Requirements

Items must have an `id` field:

```typescript
interface ArrayItem {
  id: string;
  // ... other fields
}
```

## Nested Arrays

For nested arrays (e.g., buttons within questions), use `useNestedArrayField`:

```typescript
import { useNestedArrayField } from "@/features/nodes/journey/hooks/use-array-field";

function QuestionEditor({ questionId }: { questionId: string }) {
  const form = useNodeEditorForm(node);

  // Manage buttons within a specific question
  const questionButtons = useNestedArrayField<Question, ButtonConfig>(
    form,
    "questions", // parent field name
    questionId, // parent item ID
    "buttons" // child field name within Question type
  );

  // Same API as useArrayField
  questionButtons.add({ id: generateButtonId(), text: "Option" });
  questionButtons.updateByIndex(0, { text: "Yes" });
}
```

## Reactivity

The hook uses `useStore` from `@tanstack/react-store` for proper reactivity:

```typescript
// This pattern DOES trigger re-renders when values change
const items = useStore(form.store, (state) => state.values[fieldName]);

// The old useMemo pattern DID NOT work (stale values)
// const items = useMemo(() => form.getFieldValue(fieldName), [form, fieldName]);
```

**Key insight**: `form.getFieldValue()` is synchronous and doesn't provide reactivity. Use `useStore` subscriptions for reactive values.

## Real-World Examples

### Message Node Buttons

```typescript
// apps/web/src/features/nodes/journey/types/message/editor.tsx

const buttons = useArrayField<ButtonConfig>(form, "buttons");

const handleAddButton = () => {
  if (buttons.count >= 4) return; // Max 4 buttons
  buttons.add({
    id: generateButtonId(),
    text: "",
  });
};

const handleRemoveButton = (buttonId: string) => {
  const button = buttons.getById(buttonId);
  if (button?.targetNodeId) {
    // Clean up associated edge
    deleteEdge(ManagedEdgeId.create(node.id, buttonId));
  }
  buttons.removeById(buttonId);
};
```

### Questionnaire Questions

```typescript
// apps/web/src/features/nodes/journey/types/questionnaire/editor.tsx

const questions = useArrayField<Question>(form, "questions");

const handleAddQuestion = () => {
  const newQuestion: Question = {
    id: generateQuestionId(),
    content: "New question?",
    responseType: "buttons",
    buttons: [
      { id: generateButtonId(), text: "Yes" },
      { id: generateButtonId(), text: "No" },
    ],
    required: true,
  };
  questions.add(newQuestion);
};

const handleMoveQuestion = (questionId: string, direction: "up" | "down") => {
  const index = questions.items.findIndex((q) => q.id === questionId);
  const targetIndex = direction === "up" ? index - 1 : index + 1;
  questions.move(index, targetIndex);
};
```

### Webhook Headers

```typescript
// apps/web/src/features/nodes/journey/types/webhook/editor.tsx

const headers = useArrayField<HeaderConfig>(form, "headers");

const handleAddHeader = () => {
  headers.add({
    id: generateHeaderId(),
    key: "",
    value: "",
  });
};
```

## Common Patterns

### With Side Effects

When array operations have side effects (e.g., deleting edges):

```typescript
const handleRemoveButton = useCallback(
  (buttonId: string) => {
    const button = buttons.getById(buttonId);

    // Update form first
    buttons.removeById(buttonId);

    // Then perform side effects
    if (button?.id) {
      deleteEdgeRaw(ManagedEdgeId.create(node.id, button.id));
    }
  },
  [buttons, node.id, deleteEdgeRaw]
);
```

### With Validation

```typescript
const handleAdd = () => {
  if (buttons.count >= MAX_BUTTONS) {
    notify.warning(`Maximum ${MAX_BUTTONS} buttons allowed`);
    return;
  }
  buttons.add({ id: generateButtonId(), text: "" });
};
```

### With Expansion State

```typescript
const [expandedId, setExpandedId] = useState<string | null>(null);

const handleAdd = () => {
  const newItem = { id: generateId(), content: "" };
  items.add(newItem);
  setExpandedId(newItem.id); // Auto-expand new item
};

const handleRemove = (id: string) => {
  items.removeById(id);
  if (expandedId === id) {
    setExpandedId(null); // Clear expansion if removing expanded item
  }
};
```

## Performance Considerations

1. **Callbacks are memoized**: The hook returns stable callback references via `useCallback`
2. **Items are reactive**: The `items` array updates automatically when form state changes
3. **Getter functions use fresh values**: `getById` and `getByIndex` always read current form state

## Migration Guide

### From Manual Array Manipulation

Before:

```typescript
const buttons = form.getFieldValue("buttons") || [];
const handleAdd = () => {
  form.setFieldValue("buttons", [...buttons, newButton]);
};
```

After:

```typescript
const buttons = useArrayField<ButtonConfig>(form, "buttons");
const handleAdd = () => {
  buttons.add(newButton);
};
```

### From useMemo Pattern

Before (stale values bug):

```typescript
const items = useMemo(() => {
  return form.getFieldValue("items") ?? [];
}, [form, fieldName]);
```

After (reactive):

```typescript
const { items } = useArrayField(form, "items");
```

## Related Documentation

- [Adding Node Features](./adding-node-features.md) - Config-driven feature system
- [Pluggable Feature System](../proposals/active/pluggable-feature-system/04-migration-status.md) - Registry architecture
