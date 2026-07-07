import { describe, it, expect } from 'vitest'
import {
  restrictToHorizontalAxis,
  restrictToVerticalAxis,
  restrictToWindowEdges,
  snapToGrid,
  initialRect,
  setInitialRect,
} from './index.js'

describe('modifiers', () => {
  it('restrictToHorizontalAxis preserves top/height from initial rect', () => {
    const el = document.createElement('div')
    const init = { left: 10, top: 100, right: 110, bottom: 150, width: 100, height: 50 }
    setInitialRect(el, init)
    const r = restrictToHorizontalAxis({ rect: { ...init, top: 200, height: 30 } as any, el })
    expect(r.top).toBe(init.top)
    expect(r.height).toBe(init.height)
  })

  it('restrictToVerticalAxis preserves left/width', () => {
    const el = document.createElement('div')
    const init = { left: 10, top: 100, right: 110, bottom: 150, width: 100, height: 50 }
    setInitialRect(el, init)
    const r = restrictToVerticalAxis({ rect: { ...init, left: 200, width: 30 } as any, el })
    expect(r.left).toBe(init.left)
    expect(r.width).toBe(init.width)
  })

  it('restrictToWindowEdges clamps to viewport', () => {
    const r = restrictToWindowEdges({
      rect: { left: -50, top: 100, right: 60, bottom: 150, width: 110, height: 50 } as any,
    })
    expect(r.left).toBe(0)
    // Width is the clamp; just check it didn't make it bigger than the window
    expect(r.right).toBeLessThanOrEqual(window.innerWidth)
  })

  it('snapToGrid snaps to multiples of delta', () => {
    const snap = snapToGrid(50)
    const r = snap({ rect: { left: 47, top: 23, right: 100, bottom: 80, width: 100, height: 50 } as any })
    expect(r.left).toBe(50)
    expect(r.top).toBe(0)
  })
})
