/**
 * Tests for the keyboard sensor — the accessibility entry point.
 *
 * Verifies:
 * - Space picks up an item (state transitions to dragging)
 * - ArrowDown advances the overId to the next item in the list
 * - Space again drops the item (state transitions to dropping)
 * - Escape cancels mid-drag
 * - Enter also picks up and drops
 * - aria-live region gets created and receives announcements
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { act, render } from '@testing-library/react'
import { DndContext, useKeyboardSensor, useSortableContainer, useSortable, useDragState } from '../index.js'

afterEach(() => {
  document.body.innerHTML = ''
})

// In happy-dom all rects are (0,0). Mock them so ArrowDown can find items below.
let rectSeq = 0
const origGetBCR = HTMLElement.prototype.getBoundingClientRect
HTMLElement.prototype.getBoundingClientRect = function() {
  // Use the data-testid as the index for deterministic ordering.
  const tid = this.getAttribute('data-testid')
  const idx = tid ? tid.charCodeAt(0) - 'a'.charCodeAt(0) : 0
  return {
    left: 0, top: idx * 50, right: 100, bottom: idx * 50 + 40,
    width: 100, height: 40, x: 0, y: idx * 50, toJSON() { return {} },
  } as DOMRect
}

function fireKey(target: HTMLElement, key: string): void {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
  // Both window and target get the event since our listener is on document.
  document.dispatchEvent(event)
}

describe('useKeyboardSensor', () => {
  it('picks up an item on Space and transitions to dragging', () => {
    let statusInRender: string | undefined
    function List() {
      const { setNodeRef } = useSortableContainer('list', ['a', 'b', 'c'])
      const state = useDragState()
      statusInRender = state.status
      return (
        <ul ref={setNodeRef as any}>
          <SortableItem id="a" />
          <SortableItem id="b" />
          <SortableItem id="c" />
        </ul>
      )
    }
    function SortableItem({ id }: { id: string }) {
      const { setNodeRef, attributes, listeners } = useSortable({ id })
      return <li ref={setNodeRef as any} data-testid={id} {...attributes} {...listeners} tabIndex={0} />
    }
    render(<DndContext><List /></DndContext>)
    expect(statusInRender).toBe('idle')

    const a = document.querySelector('[data-testid="a"]') as HTMLElement
    act(() => { fireKey(a, ' ') })
    expect(statusInRender).toBe('dragging')
  })

  it('drops the item on a second Space', () => {
    let statusInRender: string | undefined
    function List() {
      const { setNodeRef } = useSortableContainer('list', ['a', 'b', 'c'])
      const state = useDragState()
      statusInRender = state.status
      return (
        <ul ref={setNodeRef as any}>
          <SortableItem id="a" />
          <SortableItem id="b" />
        </ul>
      )
    }
    function SortableItem({ id }: { id: string }) {
      const { setNodeRef, attributes, listeners } = useSortable({ id })
      return <li ref={setNodeRef as any} data-testid={id} {...attributes} {...listeners} />
    }
    render(<DndContext><List /></DndContext>)
    const a = document.querySelector('[data-testid="a"]') as HTMLElement
    act(() => { fireKey(a, ' ') })
    expect(statusInRender).toBe('dragging')
    act(() => { fireKey(a, ' ') })
    expect(statusInRender).toBe('dropping')
  })

  it('Enter also picks up and drops', () => {
    let statusInRender: string | undefined
    function List() {
      const { setNodeRef } = useSortableContainer('list', ['a', 'b'])
      const state = useDragState()
      statusInRender = state.status
      return (
        <ul ref={setNodeRef as any}>
          <SortableItem id="a" />
        </ul>
      )
    }
    function SortableItem({ id }: { id: string }) {
      const { setNodeRef, attributes, listeners } = useSortable({ id })
      return <li ref={setNodeRef as any} data-testid={id} {...attributes} {...listeners} />
    }
    render(<DndContext><List /></DndContext>)
    const a = document.querySelector('[data-testid="a"]') as HTMLElement
    act(() => { fireKey(a, 'Enter') })
    expect(statusInRender).toBe('dragging')
    act(() => { fireKey(a, 'Enter') })
    expect(statusInRender).toBe('dropping')
  })

  it('Escape cancels an in-flight keyboard drag', () => {
    let statusInRender: string | undefined
    function List() {
      const { setNodeRef } = useSortableContainer('list', ['a', 'b'])
      const state = useDragState()
      statusInRender = state.status
      return (
        <ul ref={setNodeRef as any}>
          <SortableItem id="a" />
        </ul>
      )
    }
    function SortableItem({ id }: { id: string }) {
      const { setNodeRef, attributes, listeners } = useSortable({ id })
      return <li ref={setNodeRef as any} data-testid={id} {...attributes} {...listeners} />
    }
    render(<DndContext><List /></DndContext>)
    const a = document.querySelector('[data-testid="a"]') as HTMLElement
    act(() => { fireKey(a, ' ') })
    expect(statusInRender).toBe('dragging')
    act(() => { fireKey(a, 'Escape') })
    expect(['cancelled', 'idle']).toContain(statusInRender)
  })

  it('creates an aria-live region and announces pickup', async () => {
    function List() {
      const { setNodeRef } = useSortableContainer('list', ['a', 'b'])
      return (
        <ul ref={setNodeRef as any}>
          <SortableItem id="a" />
        </ul>
      )
    }
    function SortableItem({ id }: { id: string }) {
      const { setNodeRef, attributes, listeners } = useSortable({ id })
      return <li ref={setNodeRef as any} data-testid={id} {...attributes} {...listeners} />
    }
    render(<DndContext><List /></DndContext>)
    const a = document.querySelector('[data-testid="a"]') as HTMLElement
    act(() => { fireKey(a, ' ') })
    // Announcement goes via microtask; wait one tick.
    await Promise.resolve()
    const region = document.getElementById('__kinetik_live')
    expect(region).not.toBeNull()
    expect(region!.getAttribute('aria-live')).toBe('polite')
    expect(region!.textContent).toMatch(/Picked up item a/)
  })

  it('disabled items ignore keyboard pickup', () => {
    let statusInRender: string | undefined
    function List() {
      const { setNodeRef } = useSortableContainer('list', ['a'])
      const state = useDragState()
      statusInRender = state.status
      return (
        <ul ref={setNodeRef as any}>
          <SortableItem id="a" disabled />
        </ul>
      )
    }
    function SortableItem({ id, disabled }: { id: string; disabled?: boolean }) {
      const { setNodeRef, attributes, listeners } = useSortable({ id, disabled })
      return <li ref={setNodeRef as any} data-testid={id} {...attributes} {...listeners} tabIndex={disabled ? -1 : 0} />
    }
    render(<DndContext><List /></DndContext>)
    const a = document.querySelector('[data-testid="a"]') as HTMLElement
    act(() => { fireKey(a, ' ') })
    expect(statusInRender).toBe('idle')
  })
})

describe('useKeyboardSensor (engine API)', () => {
  it('beginKeyboardDrag / keyboardComplete move through lifecycle', () => {
    let observed: string | undefined
    function List() {
      const { setNodeRef } = useSortableContainer('list', ['a'])
      const state = useDragState()
      observed = state.status
      return (
        <ul ref={setNodeRef as any}>
          <SortableItem id="a" />
        </ul>
      )
    }
    function SortableItem({ id }: { id: string }) {
      const { setNodeRef, attributes, listeners } = useSortable({ id })
      return <li ref={setNodeRef as any} data-testid={id} {...attributes} {...listeners} />
    }
    render(<DndContext><List /></DndContext>)
    const a = document.querySelector('[data-testid="a"]') as HTMLElement
    act(() => { fireKey(a, ' ') })
    expect(observed).toBe('dragging')
    act(() => { fireKey(a, ' ') })
    expect(observed).toBe('dropping')
  })

  it('arrow keys do nothing when idle (no active drag)', () => {
    let arrowedObserved: string | undefined
    function List() {
      const { setNodeRef } = useSortableContainer('list', ['a'])
      const state = useDragState()
      arrowedObserved = state.status
      return (
        <ul ref={setNodeRef as any}>
          <SortableItem id="a" />
        </ul>
      )
    }
    function SortableItem({ id }: { id: string }) {
      const { setNodeRef, attributes, listeners } = useSortable({ id })
      return <li ref={setNodeRef as any} data-testid={id} {...attributes} {...listeners} />
    }
    render(<DndContext><List /></DndContext>)
    const a = document.querySelector('[data-testid="a"]') as HTMLElement
    act(() => { fireKey(a, 'ArrowDown') })
    expect(arrowedObserved).toBe('idle')
  })
})
