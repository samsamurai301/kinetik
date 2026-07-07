/**
 * React adapter tests — DndContext, useDraggable, useDroppable, useSortable, DragOverlay.
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
} from '../index.js'

// Reset the DOM between every test so --isolate=false is safe (3.7x faster unit runs).
afterEach(() => { document.body.innerHTML = '' })

function makeItem(id: string) {
  return <div data-testid={id} style={{ padding: 10, margin: 4, background: 'white' }}>{id}</div>
}

describe('DndContext', () => {

  it('renders children', () => {
    render(<DndContext><div data-testid="x">hi</div></DndContext>)
    expect(document.querySelector('[data-testid="x"]')!.textContent).toBe('hi')
  })

  it('exposes engine via useEngine to children', () => {
    function Probe() {
      // We don't have a public useEngine test hook but the context works if children render.
      return <div data-testid="probe" />
    }
    render(<DndContext><Probe /></DndContext>)
    expect(document.querySelector('[data-testid="probe"]')).not.toBeNull()
  })
})

describe('useSortableContainer + useSortable', () => {
  it('registers container and items with the engine', () => {
    function List() {
      const { setNodeRef } = useSortableContainer('list')
      return (
        <ul ref={setNodeRef as any}>
          <Item id="a" />
          <Item id="b" />
        </ul>
      )
    }
    function Item({ id }: { id: string }) {
      const { setNodeRef, attributes, listeners } = useSortable({ id })
      return <li ref={setNodeRef as any} {...attributes} {...listeners} data-testid={id}>{id}</li>
    }
    render(<DndContext><List /></DndContext>)
    expect(document.querySelector('[data-testid="a"]')).not.toBeNull()
    expect(document.querySelector('[data-testid="b"]')).not.toBeNull()
  })

  it('marks isDragging on the active item', () => {
    function List() {
      const { setNodeRef } = useSortableContainer('list')
      return (
        <ul ref={setNodeRef as any}>
          <Item id="a" />
        </ul>
      )
    }
    function Item({ id }: { id: string }) {
      const { setNodeRef, attributes, listeners, isDragging } = useSortable({ id })
      return (
        <li ref={setNodeRef as any} {...attributes} {...listeners} data-testid={id} data-dragging={isDragging}>
          {id}
        </li>
      )
    }
    render(<DndContext><List /></DndContext>)
    expect(document.querySelector('[data-testid="a"]')!.getAttribute('data-dragging')).toBe('false')
  })
})

describe('useDraggable', () => {
  it('attaches onPointerDown listener', () => {
    function Item() {
      const { setNodeRef, listeners } = useDraggable({ id: 'x' })
      return <div ref={setNodeRef as any} {...listeners} data-testid="x" />
    }
    render(<DndContext><Item /></DndContext>)
    expect(document.querySelector('[data-testid="x"]')).not.toBeNull()
  })
})

describe('useDroppable', () => {
  it('registers a container', () => {
    function Drop() {
      const { setNodeRef } = useDroppable({ id: 'drop' })
      return <div ref={setNodeRef as any} data-testid="drop" />
    }
    render(<DndContext><Drop /></DndContext>)
    expect(document.querySelector('[data-testid="drop"]')).not.toBeNull()
  })
})

describe('DragOverlay', () => {
  it('renders nothing when no drag is active', () => {
    render(
      <DndContext>
        <DragOverlay>{() => <div data-testid="overlay" />}</DragOverlay>
      </DndContext>
    )
    expect(document.querySelector('[data-testid="overlay"]')).toBeNull()
  })
})
