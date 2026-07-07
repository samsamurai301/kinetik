/**
 * Per-frame micro-benchmark — measures the cost of a single tick().
 * Excludes engine creation / registration (one-time cost).
 */
;(globalThis as any).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
;(globalThis as any).requestAnimationFrame = (cb: any) => setTimeout(cb, 16) as any
;(globalThis as any).cancelAnimationFrame = (id: any) => clearTimeout(id)

import { DragEngine } from '../src/core/engine.js'

class FakeEl {
  style: Record<string, string> = {}
  constructor(public id: string, public top: number) {}
  getBoundingClientRect() { return { top: this.top, left: 0, right: 100, bottom: this.top + 48, width: 100, height: 48 } as any }
  setPointerCapture() {} releasePointerCapture() {} addEventListener() {} removeEventListener() {}
}

function bench(name: string, iters: number, fn: () => void): void {
  for (let i = 0; i < 200; i++) fn()
  const start = performance.now()
  for (let i = 0; i < iters; i++) fn()
  const elapsed = performance.now() - start
  console.log(`  ${name.padEnd(50)} ${(elapsed/iters).toFixed(4)} ms/op  (${elapsed.toFixed(1)} ms / ${iters} iters)`)
}

console.log('=== per-frame micro-benchmarks ===\n')

// Setup
const els = Array.from({ length: 50 }, (_, i) => new FakeEl(`item-${i}`, i * 50))
const engine = new DragEngine({ activationDistance: 0, autoScroll: false })
engine.registerContainer('list', els[0] as any, els.map((e) => e.id))
els.forEach((e) => engine.registerDraggable(e.id, e as any, 'list'))
engine.beginDrag('item-10', { pointerId: 1, clientX: 50, clientY: 24 } as any)

// Single tick
bench('Single tick (50 items, no mods, no autoscroll)', 100_000, () => {
  engine['pending'] = { x: 100, y: 100 }
  engine['raf'] = 0
  engine['tick']()
})

// With modifiers
const engineWithMods = new DragEngine({
  activationDistance: 0,
  autoScroll: false,
  modifiers: [(r) => r, (r) => r, (r) => r],
})
engineWithMods.registerContainer('list', els[0] as any, els.map((e) => e.id))
els.forEach((e) => engineWithMods.registerDraggable(e.id, e as any, 'list'))
engineWithMods.beginDrag('item-10', { pointerId: 1, clientX: 50, clientY: 24 } as any)

bench('Single tick (50 items, 3 modifiers)', 100_000, () => {
  engineWithMods['pending'] = { x: 100, y: 100 }
  engineWithMods['raf'] = 0
  engineWithMods['tick']()
})

// Big list
const bigEls = Array.from({ length: 500 }, (_, i) => new FakeEl(`item-${i}`, i * 50))
const bigEngine = new DragEngine({ activationDistance: 0, autoScroll: false })
bigEngine.registerContainer('list', bigEls[0] as any, bigEls.map((e) => e.id))
bigEls.forEach((e) => bigEngine.registerDraggable(e.id, e as any, 'list'))
bigEngine.beginDrag('item-250', { pointerId: 1, clientX: 50, clientY: 24 } as any)

bench('Single tick (500 items, no mods)', 50_000, () => {
  bigEngine['pending'] = { x: 100, y: 100 }
  bigEngine['raf'] = 0
  bigEngine['tick']()
})
