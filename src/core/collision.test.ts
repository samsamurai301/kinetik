/**
 * Collision detection tests.
 */

import { describe, expect, it } from 'vitest'
import {
  sortableStrategy,
  rectIntersectionStrategy,
  projectRect,
} from './collision.js'
import type { Container, Rect } from './types.js'

function rect(top: number, left: number, w: number, h: number): Rect {
  return { top, left, right: left + w, bottom: top + h, width: w, height: h }
}

function container(id: string, items: (string | number)[]): Container {
  return { id, el: null as any, disabled: false, rect: rect(0, 0, 1000, 1000), items, autoScroll: true }
}

describe('sortableStrategy', () => {
  it('picks the closest item by center distance', () => {
    const c = container('list', ['a', 'b'])
    // a center (25, 25), b center (125, 25), active center (55, 25)
    // a is closer.
    const rects = new Map<string, Rect>([
      ['a', rect(0, 0, 50, 50)],
      ['b', rect(0, 100, 50, 50)],
    ])
    const result = sortableStrategy({
      activeRect: rect(0, 40, 30, 50),
      activeId: 'x',
      activeContainerId: 'list',
      containers: [c],
      rects,
      previousCollision: null,
    })
    expect(result[0].id).toBe('a')
  })

  it('excludes the active id from candidates', () => {
    const c = container('list', ['a', 'b'])
    const rects = new Map<string, Rect>([
      ['a', rect(0, 0, 100, 50)],
      ['b', rect(60, 0, 100, 50)],
    ])
    const result = sortableStrategy({
      activeRect: rect(0, 0, 100, 50),
      activeId: 'a',
      activeContainerId: 'list',
      containers: [c],
      rects,
      previousCollision: null,
    })
    expect(result.map((r) => r.id)).toEqual(['b'])
  })

  it('falls back to activeContainerId when no overlap', () => {
    const c = container('list', ['a', 'b'])
    const rects = new Map<string, Rect>([
      ['a', rect(0, 0, 100, 50)],
      ['b', rect(60, 0, 100, 50)],
    ])
    const result = sortableStrategy({
      activeRect: rect(5000, 5000, 50, 50),
      activeId: 'x',
      activeContainerId: 'list',
      containers: [c],
      rects,
      previousCollision: null,
    })
    expect(result.length).toBe(1)
  })

  it('uses previousCollision item id to stay in the same container for stability', () => {
    const c1 = container('list1', ['a', 'b'])
    const c2 = container('list2', ['c', 'd'])
    const rects = new Map<string, Rect>([
      ['a', rect(0, 0, 100, 50)],
      ['b', rect(60, 0, 100, 50)],
      ['c', rect(500, 0, 100, 50)],
      ['d', rect(560, 0, 100, 50)],
    ])
    // previousCollision is an ITEM id; the strategy should find the container that owns it.
    const previous = { id: 'a', value: 0, rect: rect(0, 0, 100, 50) }
    const result = sortableStrategy({
      activeRect: rect(60, 0, 100, 50),
      activeId: 'x',
      activeContainerId: null,
      containers: [c1, c2],
      rects,
      previousCollision: previous,
    })
    expect(result.length).toBe(1)
    expect(['a', 'b']).toContain(result[0].id)
  })

  it('returns empty for empty container', () => {
    const c = container('list', [])
    const result = sortableStrategy({
      activeRect: rect(0, 0, 50, 50),
      activeId: 'x',
      activeContainerId: 'list',
      containers: [c],
      rects: new Map(),
      previousCollision: null,
    })
    expect(result).toEqual([])
  })
})

describe('rectIntersectionStrategy', () => {
  it('returns all overlapping containers sorted by area (largest first)', () => {
    const big = container('big', [])
    const small = container('small', [])
    // active (60,60,40,40). big (0,0,80,80) overlap = 20*20=400. small (60,60,200,200) overlap = 40*40=1600.
    const rects = new Map<string, Rect>([
      ['big', rect(0, 0, 80, 80)],
      ['small', rect(60, 60, 200, 200)],
    ])
    const result = rectIntersectionStrategy({
      activeRect: rect(60, 60, 40, 40),
      activeId: 'x',
      activeContainerId: null,
      containers: [big, small],
      rects,
      previousCollision: null,
    })
    expect(result.map((r) => r.id)).toEqual(['small', 'big'])
  })

  it('skips disabled containers', () => {
    const c = container('list', [])
    c.disabled = true
    const result = rectIntersectionStrategy({
      activeRect: rect(0, 0, 50, 50),
      activeId: 'x',
      activeContainerId: null,
      containers: [c],
      rects: new Map([['list', rect(0, 0, 100, 100)]]),
      previousCollision: null,
    })
    expect(result).toEqual([])
  })

  it('returns empty when no overlap', () => {
    const c = container('list', [])
    const result = rectIntersectionStrategy({
      activeRect: rect(500, 500, 50, 50),
      activeId: 'x',
      activeContainerId: null,
      containers: [c],
      rects: new Map([['list', rect(0, 0, 100, 100)]]),
      previousCollision: null,
    })
    expect(result).toEqual([])
  })
})

describe('projectRect', () => {
  it('shifts a rect by a translate', () => {
    const r = rect(0, 0, 100, 50)
    const p = projectRect(r, { x: 10, y: 20 })
    expect(p).toEqual({ top: 20, left: 10, right: 110, bottom: 70, width: 100, height: 50 })
  })
})
