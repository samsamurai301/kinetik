# Migrating from dnd-kit to kinetik

This guide helps you move a project from `@dnd-kit/core` + `@dnd-kit/sortable` to
kinetik. The two libraries have similar mental models (collision strategies,
sensors, modifiers) but different ergonomics. Most apps migrate in under an hour.

> **TL;DR** — Wrap your tree in `<DndContext>` instead of importing sensors,
> call `useSortable` instead of `useSortable({...})` from dnd-kit's sortable
> package, drop the `DndContext` props and pass them as React props on
> `<DndContext>` instead. One import, one hook name change, no sensors to
> manage.

## Import map

```ts
// Before (dnd-kit)
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  arrayMove,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'

// After (kinetik)
import {
  DndContext,
  useSortable,
  useSortableContainer,
  DragOverlay,
} from 'kinetik'
```

You also no longer need `arrayMove` — kinetik's `useSortableContainer` does
the reorder for you if you pass items as state and `onDragEnd` updates them.

## Provider setup

```tsx
// Before (dnd-kit)
const sensors = useSensors(
  useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
)

<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
  <SortableContext items={items} strategy={verticalListSortingStrategy}>
    {items.map(id => <SortableItem key={id} id={id} />)}
  </SortableContext>
</DndContext>

// After (kinetik)
<DndContext onDragEnd={handleDragEnd}>
  <List items={items} setItems={setItems} />
</DndContext>

function List({ items, setItems }) {
  const { setNodeRef } = useSortableContainer('list', items)
  return (
    <ul ref={setNodeRef}>
      {items.map(id => <SortableItem key={id} id={id} setItems={setItems} items={items} />)}
    </ul>
  )
}
```

That's it — pointer + keyboard sensors are built-in. No `sensors` array, no
`activationConstraint` boilerplate. The keyboard sensor comes with arrow keys,
Space, Enter, and Escape wired up automatically.

## Item hook

```tsx
// Before (dnd-kit)
function SortableItem({ id }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }
  return <li ref={setNodeRef} style={style} {...attributes} {...listeners}>...</li>
}

// After (kinetik)
function SortableItem({ id }) {
  const { attributes, listeners, setNodeRef, isDragging, style } = useSortable({ id })
  return (
    <li ref={setNodeRef} style={{ ...style, opacity: isDragging ? 0.4 : 1 }} {...attributes} {...listeners}>
      ...
    </li>
  )
}
```

`style` already includes `touchAction: none`, `userSelect: none`, and
`cursor: grab`. The transform is written as an inline `translate3d(...)`
during the drag — not via React state — so there's zero re-render cost.

## handleDragEnd

```tsx
// Before (dnd-kit)
function handleDragEnd(event) {
  const { active, over } = event
  if (over && active.id !== over.id) {
    const oldIndex = items.indexOf(active.id)
    const newIndex = items.indexOf(over.id)
    setItems(arrayMove(items, oldIndex, newIndex))
  }
}

// After (kinetik)
function handleDragEnd({ active, over }) {
  if (over && active.id !== over.id) {
    const oldIndex = items.indexOf(active.id)
    const newIndex = items.indexOf(over.id)
    setItems(arrayMove(items, oldIndex, newIndex))  // still arrayMove, your impl
  }
}
```

Same shape, same logic. We didn't replace `arrayMove` — bring your own or
use the one from `@dnd-kit/sortable` (it still works as a utility).

## Modifiers

```tsx
// Before (dnd-kit)
const sensors = useSensors(
  useSensor(PointerSensor, {
    activationConstraint: { distance: 4 },
  }),
)

const handleDragOver = useCallback(({ active, over }) => { ... }, [])

<DndContext modifiers={[restrictToVerticalAxis]} onDragOver={handleDragOver}>

// After (kinetik)
<DndContext modifiers={[restrictToVerticalAxis]}>
```

Same modifier names. Drop-in replacement for the common ones
(`restrictToVerticalAxis`, `restrictToHorizontalAxis`,
`restrictToWindowEdges`, `snapToGrid`, `restrictToParentElement`).

## DragOverlay

```tsx
// Same API as dnd-kit.
<DndContext>
  <DragOverlay>
    {activeId ? <Item id={activeId} /> : null}
  </DragOverlay>
</DndContext>
```

## What's different

| Feature | dnd-kit | kinetik |
|---|---|---|
| Sensors | You compose them via `useSensors` | Built-in (pointer + touch + keyboard) |
| Collision strategy | You pick per-DndContext | Default is closest-center, swappable |
| Modifiers | Per-DndContext | Per-DndContext, identical API |
| Velocity / throw | Not shipped | Built-in (`throwVelocityThreshold`) |
| View Transitions | Not shipped | Built-in (`useViewTransition`) |
| Auto-scroll | Built-in | Built-in, predictive (faster edge response) |
| Multi-select | Not in core | `useMultiDrag` (data model + UI helper) |
| Bundle size | ~12 KB | core 10 KB + react 6 KB + modifiers 0.8 KB |
| React 19 | Yes | Yes |

## What's NOT ported

- `MeasuringStrategy.Always` / `MeasuringStrategy.BeforeDragOnly` — kinetik
  uses a ResizeObserver-cached Map, so layout reads happen automatically when
  elements resize.
- `restrictToFirstScrollableAncestor` — replaced with `restrictToParentElement`,
  which is conceptually simpler.
- Custom sensors (TouchSensor, MouseSensor separately) — kinetik uses the
  unified Pointer Events API, so mouse + touch + pen all go through one path.

## Common gotchas

1. **Don't wrap each item with a `<DndContext>`** — only the root needs it.
   Multiple nested contexts are supported but unusual; if you find yourself
   wanting them, you probably want a separate engine per region.

2. **`useSortableContainer` needs the items as the second argument** — not
   just children. This is what lets the engine know the canonical order
   without walking the DOM.

3. **StrictMode is supported** but the engine warns in dev if you re-register
   a draggable on a different element without unregistering first. If you see
   the warning, you probably have a missing `key` prop or a memoization issue.

4. **No `onDragStart` in the old shape** — you can subscribe via
   `engine.onDragStart(id => ...)` if you need to know the pickup event.

5. **`useSortable` doesn't accept `data-` props** — use `<li {...attributes}>`
   and let the `attributes` object spread them.