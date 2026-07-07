import { defineConfig } from 'vite'
import { resolve } from 'node:path'

export default defineConfig({
  root: resolve(__dirname, 'vanilla-src'),
  // Use a unique base URL prefix so vanilla's assets don't collide with React's /assets/.
  base: '/assets-vanilla/',
  build: {
    // Write files at the root of outDir (no nested assets/ folder).
    outDir: resolve(__dirname, 'dist/vanilla'),
    emptyOutDir: false,
    rollupOptions: {
      input: resolve(__dirname, 'vanilla-src/index.html'),
      external: [/^\/kinetik-core\//],
      output: {
        entryFileNames: '[name]-[hash].js',
        chunkFileNames: '[name]-[hash].js',
        assetFileNames: '[name]-[hash][extname]',
      },
    },
  },
})
