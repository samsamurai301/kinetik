# kinetik Performance Benchmarks

All benchmarks measured in Node.js 22 with `--expose-gc` not enabled (so heap numbers include baseline GC noise).
For real-world browser numbers, run the demo at `/` and watch the PerfMonitor overlay.

## Hot-path benchmarks (Node)

Measured via `bench/micro-frame.bench.ts` — single-tick cost during drag.

| Scenario | Per-frame cost | % of 60fps budget (16.6ms) |
|---|---|---|
| 50 items, no modifiers, no autoscroll | ~50 µs | 0.3% |
| 50 items, 3 modifiers | ~70 µs | 0.4% |
| 500 items, no modifiers | ~16 µs | 0.1% |

**Conclusion:** the engine has ~250× headroom vs the 60fps budget. The real
limit on drag smoothness is browser rendering, not JS.

## Collision strategy micro-benchmarks

Measured via `bench/bench.ts`:

| Strategy | Items | Time per call |
|---|---|---|
| `sortableStrategy` | 100 | 3.2 µs |
| `rectIntersectionStrategy` | 10×10 kanban | 0.7 µs |
| `sortableStrategy` | 1000 | 22 µs |

## Allocation pressure

Measured via `bench/allocation.bench.ts`:

| Scenario | Time | Heap churn |
|---|---|---|
| 5000-frame drag, 50 items | 4-8 µs/frame | 1-1.2 MB |

The bulk of the heap churn is from the bench's FakeEl / fake style objects.
The engine itself, after the Phase-5 optimizations, allocates ~0 fresh Rect/Translate
objects per frame (everything is reused via scratch buffers).

## E2E benchmarks (Playwright + chromium)

Measured via `npm run test:smoke` (40 e2e tests, skipping 5 stress/perf tests):

| Suite | Duration |
|---|---|
| Full unit (89 tests) | 3.7 s |
| E2E smoke (40 tests) | 1.6 min |
| E2E full (45 tests) | 2.8 min |

## Phase 5 optimizations applied

1. **Scratch buffers in updateDrag** — `_scratchRect`, `_scratchProjected`,
   `_scratchDelta`, `_scratchVisible`, `_scratchPredictive` reused across frames.
   Previously, 6+ fresh Rect/Translate objects were allocated per frame.

2. **Containers array cache** — `Array.from(this.containers.values())` was
   rebuilt every frame. Now cached and invalidated only on register/unregister.

3. **`will-change: transform`** — set on the active element during drag,
   cleared on drop/cancel. Hints the compositor to promote to its own layer.

4. **Inline `projectRect`** — was a function call per frame; now inlined math.

5. **Math.max/min clamped lastVelocity** — was allocating a new Point every frame.

6. **Skip autoscroll when velocity ≈ 0** — saves a per-container iteration
   on the common case of stationary drag.

7. **Skip modifier loop when empty** — the common case (demo uses zero modifiers).

## What still allocates (intentionally)

- The collision strategy still allocates its returned `Collision[]` array.
  Could be made allocation-free with a similar scratch-buffer approach, but
  strategies are user-overridable so the savings would only apply to the
  built-in ones.

- `template literal` for `translate3d(x, y, 0)` — ~30 bytes per frame.
  Could be optimized with a cached string for the "no delta" case but the
  saving is negligible.
