/**
 * Test setup — runs before each test file.
 *
 * Key things we need to polyfill / configure for happy-dom:
 * - matchMedia (used by some libs; we don't use it but safe to stub)
 * - ResizeObserver (used by MeasurementStore)
 * - requestAnimationFrame (happy-dom has it but we want stable timing)
 * - cancelAnimationFrame
 * - PointerEvent (happy-dom may not have it; we provide a fallback)
 * - setPointerCapture / releasePointerCapture on Element prototype
 */

import { afterEach, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'

// ResizeObserver — happy-dom may not implement it.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  } as unknown as typeof ResizeObserver
}

// happy-dom doesn't implement scrollBy on elements. We polyfill it to
// update scrollTop/scrollLeft based on the arguments.
if (typeof Element !== 'undefined' && !Element.prototype.scrollBy) {
  Element.prototype.scrollBy = function (...args: any[]) {
    if (typeof args[0] === 'object' && args[0] !== null) {
      this.scrollLeft += args[0].left ?? 0
      this.scrollTop += args[0].top ?? 0
    } else {
      this.scrollLeft += args[0] ?? 0
      this.scrollTop += args[1] ?? 0
    }
  }
  Element.prototype.scrollTo = function (...args: any[]) {
    if (typeof args[0] === 'object' && args[0] !== null) {
      this.scrollLeft = args[0].left ?? 0
      this.scrollTop = args[0].top ?? 0
    } else {
      this.scrollLeft = args[0] ?? 0
      this.scrollTop = args[1] ?? 0
    }
  }
}

// happy-dom doesn't compute real layout from inline styles. We patch
// getBoundingClientRect to return a rect derived from the element's
// style.left/top/width/height so our tests can verify spatial logic.
;(function patchGetBoundingClientRect() {
  const origGetBCR = Element.prototype.getBoundingClientRect
  Element.prototype.getBoundingClientRect = function () {
    const cs = getComputedStyle(this)
    const left = parseFloat(cs.left) || 0
    const top = parseFloat(cs.top) || 0
    const width = parseFloat(cs.width) || 0
    const height = parseFloat(cs.height) || 0
    return {
      top,
      left,
      right: left + width,
      bottom: top + height,
      width,
      height,
      x: left,
      y: top,
      toJSON() {
        return { top, left, right: left + width, bottom: top + height, width, height, x: left, y: top }
      },
    } as DOMRect
  }
})()

// matchMedia stub
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

// PointerEvent — happy-dom doesn't ship it by default.
if (typeof globalThis.PointerEvent === 'undefined') {
  class PointerEventPolyfill extends MouseEvent {
    public readonly pointerId: number
    public readonly pointerType: string
    public readonly isPrimary: boolean
    public readonly width: number
    public readonly height: number
    public readonly pressure: number
    public readonly tangentialPressure: number
    public readonly tiltX: number
    public readonly tiltY: number
    public readonly twist: number

    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params)
      this.pointerId = params.pointerId ?? 1
      this.pointerType = params.pointerType ?? 'mouse'
      this.isPrimary = params.isPrimary ?? true
      this.width = params.width ?? 1
      this.height = params.height ?? 1
      this.pressure = params.pressure ?? 0.5
      this.tangentialPressure = params.tangentialPressure ?? 0
      this.tiltX = params.tiltX ?? 0
      this.tiltY = params.tiltY ?? 0
      this.twist = params.twist ?? 0
    }
    getCoalescedEvents(): PointerEvent[] {
      return []
    }
  }
  globalThis.PointerEvent = PointerEventPolyfill as unknown as typeof PointerEvent
}

// Ensure Element has setPointerCapture / releasePointerCapture (no-op stubs).
// These are needed for the engine's beginDrag flow.
if (typeof Element !== 'undefined') {
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = function (): void {}
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = function (): void {}
  }
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = function (): boolean {
      return false
    }
  }
}

// rAF shim: queues callbacks and fires them via setTimeout(0) so test code
// can await their completion with normal async/await. Per-test overrides via
// vi.stubGlobal take precedence over this shim.
const rafQueue: FrameRequestCallback[] = []
let rafIdCounter = 0

globalThis.requestAnimationFrame = ((cb: FrameRequestCallback): number => {
  const id = ++rafIdCounter
  rafQueue.push(cb)
  // Fire async so `await waitFrames(1)` actually completes.
  setTimeout(() => {
    const idx = rafQueue.indexOf(cb)
    if (idx >= 0) {
      rafQueue.splice(idx, 1)
      cb(performance.now())
    }
  }, 0)
  return id
}) as typeof requestAnimationFrame

globalThis.cancelAnimationFrame = ((id: number): void => {
  // No-op: our queue is small and tests are short. Could be improved.
  void id
}) as typeof cancelAnimationFrame

export function flushFrames(): void {
  // Run all currently queued rAFs until the queue is empty.
  let safety = 1000
  while (rafQueue.length > 0 && safety-- > 0) {
    const batch = rafQueue.slice()
    rafQueue.length = 0
    for (const cb of batch) cb(performance.now())
  }
}

afterEach(() => {
  rafQueue.length = 0
  rafIdCounter = 0
  vi.restoreAllMocks()
})
// DragEvent / DataTransfer polyfill for happy-dom.
;(function patchDragDrop() {
  class DataTransferItemListPolyfill {
    private parent: DataTransferPolyfill
    constructor(parent: DataTransferPolyfill) { this.parent = parent }
    add = (data: any, type?: string) => {
      if (data instanceof File) {
        this.parent.files.push(data)
      } else {
        this.parent.setData(type ?? 'text/plain', String(data))
      }
    }
    get length(): number { return this.parent.files.length + Object.keys(this.parent._typeValues()).length }
  }
  class DataTransferPolyfill {
    public dropEffect = 'none'
    public effectAllowed = 'all'
    public files: any[] = []
    private _values = new Map<string, string>()
    public items: DataTransferItemListPolyfill
    constructor() {
      this.items = new DataTransferItemListPolyfill(this)
    }
    _typeValues(): Record<string, string> {
      const out: Record<string, string> = {}
      this._values.forEach((v, k) => { out[k] = v })
      return out
    }
    setData(type: string, value: string): void {
      this._values.set(type, value)
    }
    getData(type: string): string {
      return this._values.get(type) ?? ''
    }
    get types(): string[] {
      return Array.from(this._values.keys())
    }
    setDragImage(_el: Element, _x: number, _y: number): void {}
    clearData(): void { this._values.clear(); this.files.length = 0 }
  }
  ;(globalThis as any).DataTransfer = DataTransferPolyfill

  // Replace global DragEvent entirely with one that wires dataTransfer.
  class DragEventPolyfill extends Event {
    public dataTransfer: any
    constructor(type: string, init: any = {}) {
      super(type, { bubbles: init.bubbles ?? true, cancelable: init.cancelable ?? true })
      this.dataTransfer = init.dataTransfer ?? new DataTransferPolyfill()
    }
  }
  ;(globalThis as any).DragEvent = DragEventPolyfill as any
})()
