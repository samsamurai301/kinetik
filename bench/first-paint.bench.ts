/**
 * First-paint benchmark — measures the time from "pointer down on item"
 * to "transform is on the active element". This is the single number that
 * determines whether a drag feels instant or laggy.
 */

// Install a ResizeObserver shim (Node has none).
(globalThis as any).requestAnimationFrame = (cb: any) => setTimeout(cb, 16) as any;
(globalThis as any).cancelAnimationFrame = (id: any) => clearTimeout(id);
;(globalThis as any).ResizeObserver = class {
  observe() {} unobserve() {} disconnect() {}
}

import { DragEngine } from '../src/core/engine.js'

function makeRect(top: number): any {
  return { top, left: 0, right: 100, bottom: top + 48, width: 100, height: 48 }
}

class FakeEl {
  style: Record<string, string> = {}
  transformWrites = 0
  captureCount = 0
  releaseCount = 0
  constructor(public id: string, public top: number) {}
  getBoundingClientRect() { return makeRect(this.top) }
  setPointerCapture(_id: number) { this.captureCount++ }
  releasePointerCapture(_id: number) { this.releaseCount++ }
  addEventListener() {} removeEventListener() {}
  // Intercept transform writes to count them
}

function bench(name: string, iters: number, fn: () => void): { perOp: number; total: number } {
  for (let i = 0; i < 100; i++) fn()
  const start = performance.now()
  for (let i = 0; i < iters; i++) fn()
  const elapsed = performance.now() - start
  const perOp = elapsed / iters
  console.log(`  ${name.padEnd(50)} ${perOp.toFixed(4)} ms  (${iters} iters, ${elapsed.toFixed(1)} ms total)`)
  return { perOp, total: elapsed }
}

console.log('=== first-paint + sustained drag benchmarks ===\n')

// Full drag — pickup, 100 frames, drop
{
  bench('Full drag (pointerdown + 100 frames + up, 50-item list)', 100, () => {
    const els = Array.from({ length: 50 }, (_, i) => new FakeEl(`item-${i}`, i * 50))
    const engine = new DragEngine({ activationDistance: 4, autoScroll: false })
    engine.registerContainer('list', els[0] as any, els.map((e) => e.id))
    els.forEach((e) => engine.registerDraggable(e.id, e as any, 'list'))
    const e0 = els[10]!
    const startX = 50, startY = e0.top + 24
    const ev = { pointerId: 1, clientX: startX, clientY: startY } as any
    engine.beginDrag('item-10', ev)
    for (let i = 0; i < 100; i++) {
      engine['pending'] = { x: startX + (i + 1) * 2, y: startY + (i + 1) * 2 }
      engine['raf'] = 0
      engine['tick']()
    }
    // engine.cancel() — would call teardown which needs document
  })
  console.log()
}

// Collision-only loop (no DOM writes)
{
  const items = Array.from({ length: 100 }, (_, i) => `item-${i}`)
  const engine = new DragEngine({})
  const fakeEl = { getBoundingClientRect: () => makeRect(0), style: {}, addEventListener: () => {}, removeEventListener: () => {}, setPointerCapture: () => {}, releasePointerCapture: () => {}, scrollBy: () => {}, scrollLeft: 0, scrollTop: 0, clientWidth: 800, clientHeight: 600 } as any
  engine.registerContainer('list', fakeEl, items)
  items.forEach((id, i) => engine.registerDraggable(id, { ...fakeEl, getBoundingClientRect: () => makeRect(i * 50) } as any, 'list'))

  bench('100 collision ticks (100-item list)', 1000, () => {
    for (let i = 0; i < 100; i++) {
      engine['collisionStrategy']({
        activeRect: makeRect(i * 50),
        activeId: 'item-50',
        activeContainerId: 'list',
        containers: Array.from(engine['containers'].values()),
        rects: engine['rects'],
        previousCollision: null,
      })
    }
  })
  console.log()
}
