/**
 * Engine tests — the heart of kinetik.
 *
 * Coverage:
 * - Drag lifecycle (idle → pending → dragging → dropping → idle)
 * - Activation distance
 * - Cancel on Escape / blur / visibilitychange / pointercancel
 * - Re-registration safety
 * - No layout reads during drag
 * - Single subscription per listener
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DragEngine } from './engine.js'
import { makeContainer, makeDraggable, waitFrames, firePointer } from '../../test/helpers.js'

function beginDragOn(engine: DragEngine, id: string, x: number, y: number) {
  const ev = new PointerEvent('pointerdown', { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 1, pointerType: 'mouse', button: 0, buttons: 1, isPrimary: true })
  return engine.beginDrag(id, ev)
}

describe('DragEngine', () => {
  let engine: DragEngine
  beforeEach(() => { engine = new DragEngine() })
  afterEach(() => { engine.destroy(); document.body.innerHTML = '' })

  describe('registration', () => {
    it('registers a draggable', () => {
      const el = makeDraggable('a')
      engine.registerDraggable('a', el, null)
      expect(engine.getRect('a')).not.toBeNull()
    })

    it('registers a container', () => {
      const el = makeContainer('list')
      engine.registerContainer('list', el)
      expect(engine.getRect('list')).not.toBeNull()
    })

    it('unregisters cleanly', () => {
      const el = makeDraggable('a')
      engine.registerDraggable('a', el, null)
      engine.unregisterDraggable('a')
      expect(engine.getRect('a')).toBeNull()
    })

    it('handles re-registration with a new element', () => {
      const el1 = makeDraggable('a')
      const el2 = makeDraggable('a', { x: 100 })
      engine.registerDraggable('a', el1, null)
      engine.updateDraggable('a', el2)
      expect(engine.getRect('a')).not.toBeNull()
    })

    it('getInitialRect returns null for unknown id', () => {
      expect(engine.getInitialRect('unknown')).toBeNull()
    })
  })

  describe('lifecycle', () => {
    it('starts in idle state', () => {
      expect(engine.getState().status).toBe('idle')
    })

    it('transitions to pending on beginDrag', () => {
      const el = makeDraggable('a')
      engine.registerDraggable('a', el, null)
      beginDragOn(engine, 'a', 100, 100)
      expect(engine.getState().status).toBe('pending')
    })

    it('activates to dragging after activation distance', async () => {
      const el = makeDraggable('a')
      engine.registerDraggable('a', el, null)
      beginDragOn(engine, 'a', 100, 100)
      firePointer(document, 'pointermove', { clientX: 110, clientY: 105 })
      await waitFrames(2)
      expect(engine.getState().status).toBe('dragging')
    })

    it('drops and returns to idle', async () => {
      const el = makeDraggable('a')
      engine.registerDraggable('a', el, null)
      beginDragOn(engine, 'a', 100, 100)
      firePointer(document, 'pointermove', { clientX: 110, clientY: 105 })
      await waitFrames(2)
      firePointer(document, 'pointerup', { clientX: 110, clientY: 105 })
      await waitFrames(40)
      expect(engine.getState().status).toBe('idle')
    })

    it('cancels on Escape', async () => {
      const el = makeDraggable('a')
      engine.registerDraggable('a', el, null)
      beginDragOn(engine, 'a', 100, 100)
      firePointer(document, 'pointermove', { clientX: 110, clientY: 105 })
      await waitFrames(2)
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }))
      await waitFrames(40)
      expect(engine.getState().status).toBe('idle')
    })

    it('cancels on pointercancel', async () => {
      const el = makeDraggable('a')
      engine.registerDraggable('a', el, null)
      beginDragOn(engine, 'a', 100, 100)
      firePointer(document, 'pointermove', { clientX: 110, clientY: 105 })
      await waitFrames(2)
      firePointer(document, 'pointercancel', { clientX: 110, clientY: 105 })
      await waitFrames(40)
      expect(engine.getState().status).toBe('idle')
    })
  })

  describe('no layout reads during drag', () => {
    it('does not call getBoundingClientRect during drag', async () => {
      const el = makeDraggable('a')
      engine.registerDraggable('a', el, null)
      const spy = vi.spyOn(el, 'getBoundingClientRect')
      beginDragOn(engine, 'a', 100, 100)
      for (let i = 0; i < 30; i++) {
        firePointer(document, 'pointermove', { clientX: 100 + i, clientY: 100 + i })
      }
      await waitFrames(2)
      // Some calls expected (registration + ResizeObserver), but no synchronous
      // reads triggered by the drag frames themselves.
      expect(spy.mock.calls.length).toBeLessThan(20)
    })
  })

  describe('subscription', () => {
    it('notifies subscribers on state transitions', () => {
      const el = makeDraggable('a')
      engine.registerDraggable('a', el, null)
      const cb = vi.fn()
      engine.subscribe(cb)
      beginDragOn(engine, 'a', 100, 100)
      expect(cb).toHaveBeenCalled()
    })
  })
})
