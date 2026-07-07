/**
 * Allocation pressure benchmark — measures memory churn during a sustained drag.
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

console.log('=== allocation pressure (one sustained drag) ===\n')

// Create engines + elements OUTSIDE the timing window
const els = Array.from({ length: 50 }, (_, i) => new FakeEl(`item-${i}`, i * 50))

function runDrag(label: string): void {
  // Warmup
  const warmupEngine = new DragEngine({ activationDistance: 0, autoScroll: false })
  warmupEngine.registerContainer('list', els[0] as any, els.map((e) => e.id))
  els.forEach((e) => warmupEngine.registerDraggable(e.id, e as any, 'list'))
  warmupEngine.beginDrag('item-10', { pointerId: 1, clientX: 50, clientY: 24 } as any)
  for (let i = 0; i < 100; i++) {
    warmupEngine['pending'] = { x: 50 + i, y: 24 + i }
    warmupEngine['raf'] = 0
    warmupEngine['tick']()
  }

  if ((globalThis as any).gc) (globalThis as any).gc()

  const heapBefore = (globalThis as any).process.memoryUsage().heapUsed
  const start = performance.now()

  // Real measured work: 5000 frames
  for (let i = 0; i < 5000; i++) {
    warmupEngine['pending'] = { x: 50 + (i % 100), y: 24 + (i % 100) }
    warmupEngine['raf'] = 0
    warmupEngine['tick']()
  }

  const elapsed = performance.now() - start
  const heapAfter = (globalThis as any).process.memoryUsage().heapUsed
  const heapDelta = heapAfter - heapBefore
  const perFrameUs = (elapsed / 5000) * 1000
  console.log(`  ${label.padEnd(40)} ${perFrameUs.toFixed(2)} µs/frame, heap delta ${(heapDelta / 1024).toFixed(1)} KB`)
}

runDrag('5000-frame drag (warm)')

// Compare with simpler: empty modifier list (same as default)
runDrag('5000-frame drag (warm, repeat)')
