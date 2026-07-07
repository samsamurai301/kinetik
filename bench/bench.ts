/**
 * Micro-benchmarks for the kinetik engine hot paths.
 *
 * Run with: ./node_modules/.bin/tsx bench/bench.ts
 * 
 * Measures:
 *  - sortableStrategy on a 100-item list
 *  - rectIntersectionStrategy on a 10-container, 100-item kanban
 *  - Modifier pipeline (5 modifiers × 1000 frames)
 *  - Engine subscribe + notify (simulated drag)
 */
import { sortableStrategy, rectIntersectionStrategy } from '../src/core/collision.js'
import { DragEngine } from '../src/core/engine.js'
import type { Rect } from '../src/core/types.js'

function bench(name: string, iters: number, fn: () => void): void {
  // Warmup
  for (let i = 0; i < 100; i++) fn()
  const start = performance.now()
  for (let i = 0; i < iters; i++) fn()
  const elapsed = performance.now() - start
  const perOp = elapsed / iters
  console.log(`  ${name.padEnd(40)} ${perOp.toFixed(4)} ms/op  (${iters} iters in ${elapsed.toFixed(1)} ms)`)
}

function makeRect(i: number): Rect {
  return { top: i * 50, left: 0, right: 100, bottom: i * 50 + 48, width: 100, height: 48 }
}

console.log('=== kinetik benchmarks ===\n')

// Benchmark 1: sortableStrategy with 100 items
{
  const items = Array.from({ length: 100 }, (_, i) => `item-${i}`)
  const rects = new Map<string, Rect>()
  items.forEach((id, i) => rects.set(id, makeRect(i)))
  const containers = [{ id: 'c', el: null as any, disabled: false, rect: makeRect(0), items, autoScroll: true }]
  const activeRect = makeRect(20)
  bench('sortableStrategy (100 items, closest-center)', 10_000, () => {
    sortableStrategy({
      activeRect,
      activeId: 'item-50',
      activeContainerId: 'c',
      containers: containers as any,
      rects,
      previousCollision: null,
    })
  })
}

// Benchmark 2: rectIntersectionStrategy with 10 containers × 10 items
{
  const containers = Array.from({ length: 10 }, (_, i) => ({
    id: `c-${i}`,
    el: null as any,
    disabled: false,
    rect: makeRect(i * 10),
    items: Array.from({ length: 10 }, (_, j) => `item-${i}-${j}`),
    autoScroll: true,
  }))
  const rects = new Map<string, Rect>()
  containers.forEach((c) => c.items.forEach((id, i) => rects.set(id, makeRect(i + c.items.indexOf(id)))))
  const activeRect = makeRect(50)
  bench('rectIntersectionStrategy (10×10 kanban)', 10_000, () => {
    rectIntersectionStrategy({
      activeRect,
      activeId: 'item-5-5',
      activeContainerId: 'c-5',
      containers: containers as any,
      rects,
      previousCollision: null,
    })
  })
}

// Benchmark 3: Modifier pipeline (5 modifiers)
{
  const engine = new DragEngine({ modifiers: [] })
  const mod = (r: Rect) => r
  bench('Modifier pipeline (empty)', 100_000, () => {
    let r = makeRect(0)
    for (const m of [mod, mod, mod, mod, mod]) r = m(r)
  })
}

// Benchmark 4: DragEngine subscribe + notify
{
  const engine = new DragEngine({})
  let count = 0
  engine.subscribe(() => count++)
  bench('engine.notify() with 1 subscriber', 100_000, () => {
    engine['notify']()
  })
}

// Benchmark 5: Engine state read via getState (useSyncExternalStore snapshot)
{
  const engine = new DragEngine({})
  bench('engine.getState() snapshot read', 1_000_000, () => {
    engine.getState()
  })
}

// Benchmark 6: Collisions on a 1000-item list (worst case)
{
  const items = Array.from({ length: 1000 }, (_, i) => `item-${i}`)
  const rects = new Map<string, Rect>()
  items.forEach((id, i) => rects.set(id, makeRect(i)))
  const containers = [{ id: 'c', el: null as any, disabled: false, rect: makeRect(0), items, autoScroll: true }]
  const activeRect = makeRect(500)
  bench('sortableStrategy (1000 items)', 1000, () => {
    sortableStrategy({
      activeRect,
      activeId: 'item-500',
      activeContainerId: 'c',
      containers: containers as any,
      rects,
      previousCollision: null,
    })
  })
}
