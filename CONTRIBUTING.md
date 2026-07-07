# Contributing to kinetik

Thanks for your interest in kinetik! This document explains how to set up
the project locally, run the tests, and submit a change.

## Local setup

```bash
git clone https://github.com/kinetik/kinetik.git
cd kinetik
npm install
```

## Tests

We have three test layers. Run the fast ones first:

```bash
npm run test:unit          # 89 unit tests via Vitest + happy-dom (~4s)
npm run test:smoke         # 35 e2e tests, skipping the slow ones (~2 min)
npm run test:e2e           # full 40 e2e tests including stress (~3 min)
npm run test:coverage      # unit tests with v8 coverage
```

The smoke profile exists because the perf/stress e2e tests intentionally
spend real time measuring 1-second drags. Run them locally before opening
a PR, but in CI we run them only on `main` and release branches.

## Project layout

```
src/
  core/          # framework-agnostic engine (engine.ts, collision.ts, animator.ts)
  react/         # React adapter (DndContext, hooks)
  modifiers/     # transform post-processors
  adapters/      # native HTML5 drag adapters
  index.ts       # public exports
e2e/             # Playwright specs
demo/            # interactive playground (Vite)
test/            # setup + integration tests
```

## Coding style

- TypeScript strict mode. No `any` in committed code (dev-only `as any` is OK).
- Engine code has zero React imports — keep it framework-agnostic.
- Public API: every exported function has a TSDoc comment with at least one
  usage example.
- One feature = one PR. Don't mix refactors with behavior changes.

## Submitting a PR

1. Open an issue first for non-trivial changes (API surface, new features).
2. Branch from `main`. Use a descriptive name (`fix/esc-cancel-on-pending`,
   `feat/keyboard-sensor`, etc).
3. Add tests for any new behavior. PRs without tests are usually rejected.
4. Run `npm run test:smoke` before requesting review.
5. Reference the issue number in the PR description.

## Reporting bugs

Open a GitHub issue with:
- A minimal reproduction (CodeSandbox is ideal)
- The kinetik version (`npm ls kinetik`)
- Browser + OS
- Expected vs actual behavior
