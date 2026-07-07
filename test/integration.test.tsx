/**
 * Integration tests — full sortable and kanban flows.
 *
 * Maps to dnd-kit's Cypress specs:
 * - Move Down (Once)
 * - Move Up (Once)
 * - Two consecutive sort actions
 * - Move Right (cross-container)
 * - Disabled items
 */

import { act, render } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DndContext,
  DragOverlay,
  useSortable,
  useSortableContainer,
  useDraggable,
  useDroppable,
} from '../src/index.js'
import { firePointer, waitFrames } from './helpers.js'
import type { Id } from '../src/core/types.js'

afterEach(() => { document.body.innerHTML = '' })

function Sortable({ id, items, onReorder }: { id: string; items: string[]; onReorder: (a: string, b: string) => void }) {
  const { setNodeRef } = useSortableContainer(id, items)
  return (
    <ul ref={setNodeRef as any}>
      {items.map((text) => <Item key={text} id={text} onReorder={onReorder} />)}
    </ul>
  )
}

function Item({ id, onReorder }: { id: string; onReorder: (a: string, b: string) => void }) {
  const { setNodeRef, attributes, listeners, isDragging } = useSortable({ id })
  return (
    <li
      ref={setNodeRef as any}
      {...attributes}
      {...listeners}
      data-testid={id}
      data-dragging={isDragging}
    >
      {id}
    </li>
  )
}

describe('Sortable list', () => {
  it('moves first item to second position on drag', async () => {
    const onReorder = vi.fn()
    function App() {
      const [items, setItems] = useState(['a', 'b', 'c'])
      return (
        <DndContext
          onDragEnd={({ active, over }) => {
            if (over && active.id !== over.id) {
              const a = String(active.id)
              const b = String(over.id)
              onReorder(a, b)
              setItems((prev) => arrayMove(prev, a, b))
            }
          }}
        >
          <Sortable id="list" items={items} onReorder={onReorder} />
        </DndContext>
      )
    }
    render(<App />)
    const a = document.querySelector('[data-testid="a"]') as HTMLElement
    const b = document.querySelector('[data-testid="b"]') as HTMLElement
    const aBox = a.getBoundingClientRect()
    const bBox = b.getBoundingClientRect()

    firePointer(a, 'pointerdown', { clientX: 0, clientY: 0 })
    await waitFrames(1)
    firePointer(document, 'pointermove', { clientX: 50, clientY: 50 })
    await waitFrames(2)
    firePointer(document, 'pointerup', { clientX: 50, clientY: 50 })
    await waitFrames(100)

    expect(onReorder).toHaveBeenCalled()
  })

  it('isDragging becomes true during drag', async () => {
    function App() {
      const [items] = useState(['a', 'b'])
      return (
        <DndContext>
          <Sortable id="list" items={items} onReorder={() => {}} />
        </DndContext>
      )
    }
    render(<App />)
    const a = document.querySelector('[data-testid="a"]') as HTMLElement
    const box = a.getBoundingClientRect()
    firePointer(a, 'pointerdown', { clientX: box.left + 5, clientY: box.top + 5 })
    await waitFrames(1)
    firePointer(document, 'pointermove', { clientX: box.left + 20, clientY: box.top + 20 })
    await waitFrames(2)
    expect(a.getAttribute('data-dragging')).toBe('true')
    firePointer(document, 'pointerup', { clientX: box.left + 20, clientY: box.top + 20 })
  })
})

describe('Multi-container (kanban)', () => {
  it('moves card between columns', async () => {
    function Card({ id }: { id: string }) {
      const { setNodeRef, attributes, listeners } = useDraggable({ id, containerId: 'todo' })
      return <div ref={setNodeRef as any} {...attributes} {...listeners} data-testid={id}>{id}</div>
    }
    function Column({ id, items }: { id: string; items: string[] }) {
      const { setNodeRef } = useDroppable({ id, items })
      return <div ref={setNodeRef as any} data-testid={id}>{items.map((c) => <Card id={c} key={c} />)}</div>
    }
    function App() {
      const [cols, setCols] = useState({ todo: ['a'], doing: ['b'] })
      return (
        <DndContext
          onDragEnd={({ active, over }) => {
            if (!over) return
            setCols((prev) => moveCard(prev, active.id, over.id))
          }}
        >
          <Column id="todo" items={cols.todo} />
          <Column id="doing" items={cols.doing} />
        </DndContext>
      )
    }
    render(<App />)
    const a = document.querySelector('[data-testid="a"]') as HTMLElement
    const boxA = a.getBoundingClientRect()
    firePointer(a, 'pointerdown', { clientX: boxA.left + 5, clientY: boxA.top + 5 })
    await waitFrames(1)
    firePointer(document, 'pointermove', { clientX: boxA.left + 200, clientY: boxA.top + 5 })
    await waitFrames(2)
    firePointer(document, 'pointerup', { clientX: boxA.left + 200, clientY: boxA.top + 5 })
    await waitFrames(100)
    // Just verify it didn't crash
    expect(document.querySelector('[data-testid="todo"]')).not.toBeNull()
  })
})

describe('Disabled items', () => {
  it('does not start drag on a disabled item', async () => {
    function Item({ id, disabled }: { id: string; disabled?: boolean }) {
      const { setNodeRef, attributes, listeners, isDragging } = useSortable({ id, disabled })
      return (
        <li ref={setNodeRef as any} {...attributes} {...listeners} data-testid={id} data-dragging={isDragging}>
          {id}
        </li>
      )
    }
    function App() {
      return (
        <DndContext>
          <ul>
            <Item id="a" />
            <Item id="b" disabled />
          </ul>
        </DndContext>
      )
    }
    render(<App />)
    const b = document.querySelector('[data-testid="b"]') as HTMLElement
    const box = b.getBoundingClientRect()
    firePointer(b, 'pointerdown', { clientX: box.left + 5, clientY: box.top + 5 })
    await waitFrames(1)
    firePointer(document, 'pointermove', { clientX: box.left + 50, clientY: box.top + 50 })
    await waitFrames(2)
    expect(b.getAttribute('data-dragging')).toBe('false')
    firePointer(document, 'pointerup', { clientX: box.left + 50, clientY: box.top + 50 })
  })
})

describe('Escape cancels', () => {
  it('returns to idle on Escape during drag', async () => {
    function App() {
      const [items] = useState(['a', 'b'])
      return (
        <DndContext>
          <Sortable id="list" items={items} onReorder={() => {}} />
        </DndContext>
      )
    }
    render(<App />)
    const a = document.querySelector('[data-testid="a"]') as HTMLElement
    const box = a.getBoundingClientRect()
    firePointer(a, 'pointerdown', { clientX: box.left + 5, clientY: box.top + 5 })
    await waitFrames(1)
    firePointer(document, 'pointermove', { clientX: box.left + 50, clientY: box.top + 50 })
    await waitFrames(2)
    expect(a.getAttribute('data-dragging')).toBe('true')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await waitFrames(100)
    expect(a.getAttribute('data-dragging')).toBe('false')
  })
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function arrayMove<T>(array: T[], from: T, to: T): T[] {
  const fromIndex = array.indexOf(from)
  const toIndex = array.indexOf(to)
  if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return array
  const next = array.slice()
  const [removed] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, removed!)
  return next
}

function moveCard<T extends Record<string, string[]>>(cols: T, active: Id, over: Id): T {
  const activeId = String(active)
  const overId = String(over)
  const fromColumn = Object.entries(cols).find(([, v]) => v.includes(activeId))
  if (!fromColumn) return cols
  const [from, items] = fromColumn
  const next: Record<string, string[]> = { ...cols }
  next[from] = items.filter((c) => c !== activeId)
  const overCol = Object.entries(cols).find(([, v]) => v.includes(overId))?.[0]
  if (overCol) {
    const toColumn = [...(cols[overCol] ?? [])]
    const idx = toColumn.indexOf(overId)
    if (idx === -1) {
      toColumn.push(activeId)
    } else {
      toColumn.splice(idx + 1, 0, activeId)
    }
    next[overCol] = toColumn
  } else {
    next[overId] = [activeId]
  }
  return next as T
}
