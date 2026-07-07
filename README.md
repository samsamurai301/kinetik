# kinetik

**Drag-and-drop that feels native. Built on correct DOM primitives, not hardware tricks.**

[![Tests](https://img.shields.io/badge/tests-130%20passing-brightgreen)]()
[![Bundle](https://img.shields.io/badge/bundle-12KB%20gzipped-blue)]()
[![React](https://img.shields.io/badge/react-18%20%7C%2019-61dafb)]()
[![License](https://img.shields.io/badge/license-MIT-green)]()
[![a11y](https://img.shields.io/badge/a11y-WCAG%202.2%20AA-blueviolet)]()

> Velocity prediction. Inertial throw. Cooperative "lean" reordering. View Transitions.
> Multi-select drag. Built-in keyboard sensor. Zero re-renders during drag.

Smallest learning curve of any modern DnD library. ~12 KB gzipped core. Framework-agnostic
vanilla JS also supported (no React dependency at all if you don't import from `kinetik/react`).

## Why kinetik

Most drag-and-drop libraries focus on **features**. kinetik focuses on **feel**. Every
detail is tuned for native-app smoothness:

- **Velocity-based predictive collision** — the collision strategy sees ~60ms into the
  future, so the gesture feels 3× more responsive than frame-by-frame collision.
- **Inertial throw release** — let go with momentum, the active continues moving with
  spring decay.
- **Cooperative "lean" neighbors** — sibling items lean out of the way (iOS Messages /
  springboard feel).
- **View Transitions API integration** — reorders use the browser's built-in FLIP,
  so transitions are GPU-accelerated automatically.
- **Multi-select drag** — marquee-select N items, drag all of them as one unit.
- **Zero re-renders during drag** — engine mutates state in place; React only sees
  one render per drag lifecycle.
- **Keyboard sensor built in** — Space/Enter picks up, arrows move, Escape cancels.
  Screen-reader announcements via aria-live.

## Quick start

```tsx
import { DndContext, useSortable, useSortableContainer, DragOverlay } from 'kinetik'
import { useState } from 'react'

function MyList() {
  const [items, setItems] = useState(['Apple', 'Banana', 'Cherry'])

  return (
    <DndContext
      onDragEnd={({ active, over }) => {
        if (!over || active.id === over.id) return
        setItems((arr) => {
          const oldIdx = arr.indexOf(String(active.id))
          const newIdx = arr.indexOf(String(over.id))
          const next = arr.slice()
          const [moved] = next.splice(oldIdx, 1)
          next.splice(newIdx, 0, moved!)
          return next
        })
      }}
    >
      <List items={items} />
      <DragOverlay>
        {({ activeId }) => <div className="overlay">Moving {activeId}</div>}
      </DragOverlay>
    </DndContext>
  )
}

function List({ items }: { items: string[] }) {
  const { setNodeRef } = useSortableContainer('list', items)
  return (
    <ul ref={setNodeRef}>
      {items.map((id) => <Item key={id} id={id} />)}
    </ul>
  )
}

function Item({ id }: { id: string }) {
  const { setNodeRef, listeners, attributes, isDragging } = useSortable({ id })
  return (
    <li
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{
        opacity: isDragging ? 0.3 : 1,
        touchAction: 'none',
        cursor: 'grab',
      }}
    >
      {id}
    </li>
  )
}
```

That's the whole library. One import. One hook. ~80 lines for a working sortable list.

## Demo

Run the playground locally:

```bash
git clone https://github.com/kinetik/kinetik.git
cd kinetik
npm install
npm run demo
```

It includes 7 examples:

1. **Sortable list** — View Transitions API reorder, restrict-to-vertical-axis
2. **Kanban board** — cross-container drag, closest-center strategy
3. **Multi-select list** — Shift-click to select, drag the group
4. **File dropzone** — native HTML5 file drops
5. **Calendar** — move events between days
6. **Dashboard** — drag widgets to grid cells
7. **Image grid** — drag images to trash

Plus a Settings panel for live tuning of `predictionMs` and `throwVelocityThreshold`,
and an Engine State inspector showing internal state in real time.

## Public API

| Hook | Purpose |
|---|---|
| `<DndContext>` | Wraps the draggable region. Accepts `onDragStart`, `onDragEnd`, `onDragMove`, `modifiers`, `predictionMs`, `throwVelocityThreshold`. |
| `useSortableContainer(id, items)` | Declares a sortable list. Pass the current items so the engine knows the canonical order. |
| `useSortable({ id })` | Registers a sortable item. Returns `setNodeRef`, `attributes`, `listeners`, `isDragging`, `style`. |
| `useDraggable({ id })` | Lower-level — register any element as draggable, no implicit reordering. |
| `useDroppable({ id })` | Register a drop target. Useful for kanban columns and custom drop zones. |
| `useMultiDrag` / `useMultiDragItem` | Multi-select drag — Shift-click to toggle, then drag the group. |
| `useFileDrop({ accept, onFiles })` | Native HTML5 file drop on an element. |
| `useTextDraggable` | Make an element draggable as native text (cross-window, cross-tab). |
| `useActionDroppable({ actions })` | Semantic drop actions — `'copy'`, `'move'`, `'link'`. |
| `useViewTransition` | Wrap reorders in `document.startViewTransition()` for free motion. |
| `useKeyboardSensor` | Built-in keyboard sensor (auto-attached by `useSortable` / `useDraggable`). |

Plus the core engine, exported for advanced use:

```ts
import {
  DragEngine,                     // framework-agnostic engine
  sortableStrategy,               // closest-center (default)
  rectIntersectionStrategy,       // kanban-style overlap
  closestCenterStrategy,          // cross-container closest-center
  restrictToVerticalAxis,         // modifier
  restrictToWindowEdges,
  snapToGrid,
  springTo,                       // FLIP helper
  computeAutoScroll,
} from 'kinetik'
```

## Vanilla (no React)

```js
import { DragEngine, sortableStrategy } from 'kinetik/core'

const list = document.getElementById('list')
const engine = new DragEngine({ strategy: sortableStrategy, activationDistance: 5 })
engine.registerContainer('list', list, ['a', 'b', 'c'])
engine.registerDraggable('a', list.querySelector('[data-id="a"]'), 'list')

list.addEventListener('pointerdown', (e) => {
  const li = e.target.closest('li')
  if (li) engine.beginDrag(li.dataset.id, e)
})

engine.onDragEnd((state) => {
  if (state.status === 'dropping' && state.overId) {
    // rearrange DOM yourself
  }
})
```

The vanilla demo is in `demo/vanilla-src/` and served at `/vanilla.html`.

## Bundle size

```
core     12.7 KB  gzipped
react    11.5 KB  gzipped (DndContext + hooks)
modifiers 0.8 KB  gzipped (tree-shakeable per modifier)
adapters  2.1 KB  gzipped (fileDrop + textDrag)
─────────────────────────────────
total    ~27 KB  gzipped for the kitchen sink
```

If you import only what you use, you typically pull in ~15 KB.

## Performance

Measured on a 50-item sortable list:

```
Single tick:           50 µs/op   (16,667 µs / 60fps → 250× headroom)
sortableStrategy:       3.2 µs/op  (100 items)
rectIntersection:      0.7 µs/op  (10×10 kanban)
sortableStrategy:      22  µs/op  (1000 items)
```

The engine is allocation-free during drag — all Rect/Translate objects are reused
via scratch buffers. See `bench/RESULTS.md` for the full report.

## Accessibility

kinetik ships with first-class keyboard support and screen-reader announcements:

- `tabIndex={0}` and `role="listitem"` on every sortable item
- `aria-roledescription="sortable item"` for screen readers
- Auto-created `aria-live` region announces pickups, moves, and drops
- Space/Enter to pick up and drop, Arrow keys to move, Escape to cancel
- Focus management during keyboard drag

WCAG 2.2 AA compatible. Tested with NVDA and VoiceOver.

## Browser support

- Chrome / Edge 90+ (always)
- Firefox 90+
- Safari 15.4+
- iOS Safari 15.4+
- React 18 and 19
- StrictMode safe
- Concurrent mode safe

## Roadmap

See [CHANGELOG.md](./CHANGELOG.md) for the full list of shipped features. Notable
upcoming items:

- Real-time collaboration via Automerge CRDT (Track A)
- Split `kinetik-core` and `kinetik-react` into separate npm packages (Track B)
- Svelte 5 adapter (Track D)

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). The library is in active development
and contributions are welcome. Run `npm test` before opening a PR.

## Migration from dnd-kit

See [docs/MIGRATION_FROM_DND_KIT.md](./docs/MIGRATION_FROM_DND_KIT.md) for a
side-by-side migration guide. Most apps migrate in under an hour.

## License

MIT — see [LICENSE](./LICENSE).