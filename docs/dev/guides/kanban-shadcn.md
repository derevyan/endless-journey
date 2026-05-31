# Kanban Component (DiceUI/shadcn)

Source: https://www.diceui.com/docs/components/kanban

## Overview

A drag-and-drop kanban board built on top of @dnd-kit.

## Installation

```bash
pnpm dlx shadcn@latest add https://www.diceui.com/r/kanban
```

## API Reference

### Kanban.Root

Main container component with drag-and-drop context. Wraps everything in DndContext.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `Record<UniqueIdentifier, T[]>` | required | Columns and their items |
| `onValueChange` | `(value) => void` | - | Callback when items/columns change |
| `getItemValue` | `(item: T) => UniqueIdentifier` | - | Extract unique ID from item objects (required for objects) |
| `strategy` | `SortingStrategy` | `verticalListSortingStrategy` | Sorting strategy from @dnd-kit/sortable |
| `orientation` | `"vertical" \| "horizontal"` | `"horizontal"` | Board layout orientation |
| `flatCursor` | `boolean` | `false` | Disable grab cursor styling |
| `onMove` | `(event: DragEndEvent & { activeIndex, overIndex }) => void` | - | Callback for column/item moves (bypasses onValueChange) |
| `modifiers` | `Modifiers` | - | DnD-kit modifiers |

**Inherited from DndContext:**
| Prop | Type | Description |
|------|------|-------------|
| `onDragStart` | `(event: DragStartEvent) => void` | Fires when drag starts |
| `onDragOver` | `(event: DragOverEvent) => void` | Fires when dragging over a droppable |
| `onDragEnd` | `(event: DragEndEvent) => void` | Fires when drag ends |
| `onDragCancel` | `(event: DragCancelEvent) => void` | Fires when drag is cancelled |
| `accessibility` | `Accessibility` | Accessibility options |
| `autoScroll` | `AutoScrollOptions` | Auto-scroll configuration |
| `sensors` | `SensorDescriptor[]` | Custom sensors (default: Mouse, Touch, Keyboard) |

### Kanban.Board

Container for kanban columns. Creates a SortableContext for columns.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `ReactNode` | required | Column components |
| `asChild` | `boolean` | `false` | Compose with child element via Radix Slot |

**Data Attributes:**
- `[data-orientation]` - Current orientation ("horizontal" | "vertical")
- `[data-slot="kanban-board"]` - Slot identifier

### Kanban.Column

Individual column with optional drag capability. Creates a SortableContext for items.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `UniqueIdentifier` | required | Unique column identifier (cannot be empty string) |
| `children` | `ReactNode` | required | Column content |
| `asHandle` | `boolean` | `false` | Make entire column a drag handle |
| `disabled` | `boolean` | `false` | Disable drag functionality |
| `asChild` | `boolean` | `false` | Compose with child element via Radix Slot |

**Data Attributes:**
- `[data-disabled]` - Present when disabled
- `[data-dragging]` - Present during drag
- `[data-slot="kanban-column"]` - Slot identifier

### Kanban.ColumnHandle

Dedicated drag handle for columns. Use when `asHandle` is not set on Column.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `asChild` | `boolean` | `false` | Compose with child element |
| `disabled` | `boolean` | `false` | Disable drag functionality |

**Data Attributes:**
- `[data-disabled]` - Present when disabled
- `[data-dragging]` - Present during drag
- `[data-slot="kanban-column-handle"]` - Slot identifier

**Must be used within `Kanban.Column`.**

### Kanban.Item

Individual kanban card/item.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `UniqueIdentifier` | required | Unique item identifier (cannot be empty string) |
| `asHandle` | `boolean` | `false` | Make entire item a drag handle |
| `disabled` | `boolean` | `false` | Disable drag functionality |
| `asChild` | `boolean` | `false` | Compose with child element via Radix Slot |

**Data Attributes:**
- `[data-disabled]` - Present when disabled
- `[data-dragging]` - Present during drag
- `[data-slot="kanban-item"]` - Slot identifier

**Must be used within `Kanban.Board` or `Kanban.Overlay`.**

### Kanban.ItemHandle

Dedicated drag handle for items. **Use this when you need clickable elements inside items.**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `asChild` | `boolean` | `false` | Compose with child element |
| `disabled` | `boolean` | `false` | Disable drag functionality |

**Data Attributes:**
- `[data-disabled]` - Present when disabled
- `[data-dragging]` - Present during drag
- `[data-slot="kanban-item-handle"]` - Slot identifier

**Must be used within `Kanban.Item`.**

### Kanban.Overlay

Displays drag preview during drag operations. Renders via React Portal to document.body.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `ReactNode \| ((params: { value, variant }) => ReactNode)` | - | Content or render function |
| `container` | `Element \| DocumentFragment \| null` | `document.body` | Portal container |

**Render function parameters:**
- `value: UniqueIdentifier` - ID of the item/column being dragged
- `variant: "column" \| "item"` - Whether dragging a column or item

```tsx
<Kanban.Overlay>
  {({ value, variant }) => {
    if (variant === "column") {
      return <ColumnPreview id={value} />;
    }
    return <ItemPreview id={value} />;
  }}
</Kanban.Overlay>
```

## Usage Patterns

### Pattern 1: Entire Item as Drag Handle (Simple)

When you don't need clickable elements inside items:

```tsx
<Kanban.Item value={item.id} asHandle asChild>
  <div className="p-3 border rounded-lg">
    {item.title}
  </div>
</Kanban.Item>
```

### Pattern 2: Dedicated ItemHandle (For Clickable Elements)

**Use this when you need buttons/links inside items:**

```tsx
<Kanban.Item value={item.id} asChild>
  <div className="p-3 border rounded-lg flex items-center gap-2">
    <Kanban.ItemHandle asChild>
      <button className="cursor-grab">
        <GripVertical className="size-4" />
      </button>
    </Kanban.ItemHandle>
    <button onClick={() => handleClick(item.id)}>
      {item.title}
    </button>
  </div>
</Kanban.Item>
```

**⚠️ Important:** When using `Kanban.ItemHandle` inside a card component, the card must always be wrapped in `Kanban.Item` - including in the overlay!

### Pattern 3: asHandle with stopPropagation (Alternative for Clickable Elements)

**Use this when you want the entire card draggable but need specific clickable elements:**

```tsx
<Kanban.Item value={item.id} asHandle asChild>
  <div className="p-3 border rounded-lg">
    <button
      onClick={() => handleClick(item.id)}
      onPointerDown={(e) => e.stopPropagation()}  // Prevents drag initiation
    >
      {item.title}
    </button>
    <span>Other content remains draggable</span>
  </div>
</Kanban.Item>
```

The `onPointerDown` stopPropagation prevents the drag from starting when clicking on that specific element, while the rest of the card remains draggable.

### Pattern 4: Card Component with Handle Passthrough

```tsx
interface TaskCardProps extends Omit<React.ComponentProps<typeof Kanban.Item>, "value"> {
  task: Task;
}

function TaskCard({ task, ...props }: TaskCardProps) {
  return (
    <Kanban.Item key={task.id} value={task.id} asChild {...props}>
      <div className="rounded-md border bg-card p-3">
        <span>{task.title}</span>
      </div>
    </Kanban.Item>
  );
}

// Usage - pass asHandle via props
{tasks.map((task) => (
  <TaskCard key={task.id} task={task} asHandle />
))}
```

## Keyboard Navigation

| Key | Action |
|-----|--------|
| `Enter` / `Space` | Pick up or drop item |
| `Arrow Keys` | Move item directionally |
| `Escape` | Cancel drag operation |

## Important Notes

1. **Clicks inside draggable items**: When using `asHandle` on an Item, the entire item becomes a drag handle and captures pointer events. Two solutions:
   - Use `Kanban.ItemHandle` with a dedicated grip icon
   - Use `onPointerDown={(e) => e.stopPropagation()}` on clickable elements

2. **ItemHandle in Overlay**: If your card component contains `Kanban.ItemHandle`, the overlay must also wrap the card in `Kanban.Item`. Otherwise you'll get "KanbanItemHandle must be used within KanbanItem" error.

3. **asChild behavior**: When `asChild` is true, the component merges its props with the immediate child element using Radix Slot.

4. **Unique identifiers**: The `value` prop must be unique within its context (columns must have unique values, items within a column must have unique values). Empty strings are not allowed.

5. **Object items**: When using objects as items, you must provide `getItemValue` to extract the unique identifier.

6. **Sensors**: Default sensors are Mouse, Touch, and Keyboard. You can customize with activation constraints:
   ```tsx
   const sensors = useSensors(
     useSensor(MouseSensor, {
       activationConstraint: { distance: 10 }  // Requires 10px movement before drag
     })
   );
   ```
