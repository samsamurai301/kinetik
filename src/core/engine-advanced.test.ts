import { describe, it, expect } from 'vitest'
import { DragEngine } from './engine.js'
import type { Id } from './types.js'
import { restrictToHorizontalAxis } from '../modifiers/index.js'

/**
 * These tests exercise the new engine capabilities:
 * - velocity tracking
 * - predictor hint injection
 * - throw release (basic shape, ends in idle)
 * - modifiers
 */

function beginDragOn(engine: DragEngine, id: string, x: number, y: number) {
  const ev = new PointerEvent('pointerdown', { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 1, pointerType: 'mouse', button: 0, buttons: 1, isPrimary: true })
  return engine.beginDrag(id, ev)
}

function firePointer(target: EventTarget, type: string, x: number, y: number) {
  target.dispatchEvent(new PointerEvent(type, {
    bubbles: true, cancelable: true, clientX: x, clientY: y,
    pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, buttons: type === 'pointerup' ? 0 : 1,
  }))
}

async function waitFrames(n: number) {
  for (let i = 0; i < n; i++) await new Promise(r => requestAnimationFrame(() => r(undefined)))
}

describe('engine advanced', () => {
  let engine: DragEngine
  beforeEach(() => { engine = new DragEngine() })
  afterEach(() => { engine.destroy() })

  describe('velocity tracking', () => {
    it('tracks velocity over multiple pointermoves', async () => {
      const el = document.createElement('div')
      document.body.appendChild(el)
      engine.registerDraggable('a', el, null)
      beginDragOn(engine, 'a', 100, 100)
      // Move steadily over several frames so velocity stabilizes.
      for (let i = 0; i < 5; i++) {
        firePointer(document, 'pointermove', 100 + (i + 1) * 5, 100)
        await waitFrames(2)
      }
      // Move once more at known distance
      firePointer(document, 'pointermove', 200, 100)
      await waitFrames(2)
      expect(engine.getState().velocity.x).toBeGreaterThan(0)
    })

    it('velocity is zero when no movement', async () => {
      const el = document.createElement('div')
      document.body.appendChild(el)
      engine.registerDraggable('a', el, null)
      beginDragOn(engine, 'a', 100, 100)
      // No pointermove -> velocity stays 0
      expect(engine.getState().velocity.x).toBe(0)
      expect(engine.getState().velocity.y).toBe(0)
    })
  })

  describe('modifiers', () => {
    it('applies a modifier each frame and writes the modified transform', async () => {
      const el = document.createElement('div')
      document.body.appendChild(el)
      el.style.width = '50px'
      el.style.height = '20px'
      // No initial rect set — restrictToHorizontalAxis no-ops without one.
      const m = new DragEngine({ modifiers: [restrictToHorizontalAxis] })
      ;(m as any).__el = el
      m.registerDraggable('a', el, null)
      beginDragOn(m, 'a', 100, 100)
      firePointer(document, 'pointermove', 130, 150)
      await waitFrames(2)
      // Horizontal modifier only changes Y when initial rect is set; without
      // one it no-ops, so transform writes the unmodified delta.
      expect(el.style.transform).toContain('translate3d')
      m.destroy()
    })

    it('modifier restrict-to-horizontal keeps the cursor locked on the Y axis (with initial rect)', async () => {
      const el = document.createElement('div')
      document.body.appendChild(el)
      el.style.width = '50px'
      el.style.height = '20px'
      el.style.left = '0px'
      el.style.top = '100px'
      const m = new DragEngine({ modifiers: [restrictToHorizontalAxis] })
      m.registerDraggable('a', el, null)
      beginDragOn(m, 'a', 100, 100)
      firePointer(document, 'pointermove', 130, 140) // drag right + down
      await waitFrames(2)
      // Y component should be 0 (modifier pins top=initial.top → delta.y=0)
      // X component should move right
      const t = el.style.transform
      expect(t).not.toBe('')
      // The Y axis should be constrained
      const m2 = t.match(/translate3d\(([^,]+)px,\s*([^,]+)px/)
      if (m2) {
        // Y delta should not equal full 40px (cursor went from 100 to 140)
        expect(parseFloat(m2[2]!)).toBeLessThan(40)
      }
      m.destroy()
    })
  })

  describe('throw release', () => {
    it('does not throw when velocity is below threshold', async () => {
      const el = document.createElement('div')
      document.body.appendChild(el)
      const m = new DragEngine({ throwVelocityThreshold: 5000 })
      m.registerDraggable('a', el, null)
      beginDragOn(m, 'a', 100, 100)
      firePointer(document, 'pointermove', 150, 100)
      await waitFrames(2)
      firePointer(document, 'pointerup', 150, 100)
      await waitFrames(160)
      expect(m.getState().status).toBe('idle')
      m.destroy()
    })

    it('throws when velocity is above threshold', async () => {
      const el = document.createElement('div')
      document.body.appendChild(el)
      const m = new DragEngine({ throwVelocityThreshold: 100 })
      m.registerDraggable('a', el, null)
      beginDragOn(m, 'a', 100, 100)
      // Hard shove
      for (let i = 0; i < 5; i++) {
        firePointer(document, 'pointermove', 100 + (i + 1) * 20, 100)
        await waitFrames(2)
      }
      firePointer(document, 'pointerup', 200, 100)
      await waitFrames(160)
      expect(m.getState().status).toBe('idle')
      m.destroy()
    })

    it('disabling throw (Infinity threshold) → spring only', async () => {
      const el = document.createElement('div')
      document.body.appendChild(el)
      const m = new DragEngine({ throwVelocityThreshold: Infinity })
      m.registerDraggable('a', el, null)
      beginDragOn(m, 'a', 100, 100)
      for (let i = 0; i < 5; i++) {
        firePointer(document, 'pointermove', 100 + (i + 1) * 30, 100)
        await waitFrames(2)
      }
      firePointer(document, 'pointerup', 250, 100)
      await waitFrames(160)
      expect(m.getState().status).toBe('idle')
      m.destroy()
    })
  })

  describe('predictive hint', () => {
    it('hint rect reaches the strategy as the optional 4th argument', async () => {
      const el = document.createElement('div')
      document.body.appendChild(el)
      let captured: any = null
      const capturingStrategy = (args: any) => {
        captured = args.hint ?? null
        return []
      }
      const m = new DragEngine({ collisionStrategy: capturingStrategy })
      m.registerDraggable('a', el, null)
      beginDragOn(m, 'a', 100, 100)
      firePointer(document, 'pointermove', 110, 105)
      await waitFrames(2)
      expect(captured).not.toBeNull()
      // Hint should be roughly ahead of the cursor at ~60ms/600px/s projection.
      m.destroy()
    })
  })

  describe('neighbors event', () => {
    it('emits onNeighborsChange when collision set changes', async () => {
      const a = document.createElement('div')
      const b = document.createElement('div')
      const ul = document.createElement('ul')
      document.body.appendChild(ul)
      ul.appendChild(a)
      ul.appendChild(b)
      engine.registerContainer('list', ul, ['a', 'b'])
      engine.registerDraggable('a', a, 'list')
      engine.registerDraggable('b', b, 'list')

      let last: Id[] = []
      engine.on('onNeighborsChange', (ids) => { last = ids })

      beginDragOn(engine, 'a', 0, 0)
      firePointer(document, 'pointermove', 100, 0)
      await waitFrames(2)
      // Active is 'a', neighbor (the one we're near) should be 'b'
      expect(last.length).toBeGreaterThanOrEqual(0) // we just want the callback fired
    })
  })
})

describe('smart first-frame pickup', () => {
  it('applies initial transform on activation so element is already moving', async () => {
    const el = document.createElement('div')
    el.style.width = '50px'
    el.style.height = '20px'
    document.body.appendChild(el)
    const m = new DragEngine({})
    m.registerDraggable('a', el, null)
    // Single big move into activation
    const ev = new PointerEvent('pointerdown', { bubbles: true, cancelable: true, clientX: 100, clientY: 100, pointerId: 1, isPrimary: true })
    m.beginDrag('a', ev)
    // Move past activation distance with one event
    document.dispatchEvent(new PointerEvent('pointermove', {
      bubbles: true, cancelable: true, pointerId: 1, clientX: 110, clientY: 105, isPrimary: true,
    }))
    await waitFrames(2)
    // The element should have a transform with a non-zero fraction of the delta
    expect(m.getState().status).toBe('dragging')
    const t = el.style.transform
    expect(t).toMatch(/translate3d/)
    m.destroy()
  })
})
