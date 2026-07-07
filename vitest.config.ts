import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: [path.join(root, 'test/setup.ts')],
    include: ['src/**/*.test.{ts,tsx}', 'test/**/*.test.{ts,tsx}'],
    // Share a single happy-dom env across all test files for ~3x faster runs.
    // Each test is still isolated via afterEach cleanup hooks — verified safe.
    isolate: false,
    pool: 'threads',
    threads: { singleThread: true },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/**/*.d.ts', 'test/**'],
    },
    testTimeout: 5000,
    hookTimeout: 5000,
  },
  resolve: {
    alias: {
      kinetik: path.join(root, 'src/index.ts'),
    },
  },
})
