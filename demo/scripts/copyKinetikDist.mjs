#!/usr/bin/env node
// Postbuild: copy kinetik-core dist into demo/dist/kinetik-core/
//            and flatten vanilla.html + assets into demo/dist/vanilla.html + assets-vanilla/.
//
// IMPORTANT: must NOT clobber the React demo's index.html / assets/.
import { cpSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { resolve, dirname } from 'node:path'

const root = resolve(dirname(new URL(import.meta.url).pathname), '../..')
const demoDist = resolve(root, 'demo/dist')
const kinetikDist = resolve(root, 'dist')

// 1. Copy kinetik-core dist into demo/dist/kinetik-core/
console.log('[copyKinetikDist] kinetik core →', resolve(demoDist, 'kinetik-core'))
if (existsSync(kinetikDist)) {
  mkdirSync(resolve(demoDist, 'kinetik-core'), { recursive: true })
  for (const entry of readdirSync(kinetikDist)) {
    const src = resolve(kinetikDist, entry)
    const dst = resolve(demoDist, 'kinetik-core', entry)
    if (statSync(src).isDirectory()) cpSync(src, dst, { recursive: true })
  }
}

// 2. Flatten demo/dist/vanilla/* → demo/dist/vanilla.html + demo/dist/assets-vanilla/*
const vanillaDir = resolve(demoDist, 'vanilla')
if (existsSync(vanillaDir)) {
  // index.html → vanilla.html
  const vanillaIndexHtml = resolve(vanillaDir, 'index.html')
  if (existsSync(vanillaIndexHtml)) {
    cpSync(vanillaIndexHtml, resolve(demoDist, 'vanilla.html'))
  }
  // Move everything else in vanilla/ directly under demo/dist/assets-vanilla/
  const assetsVanillaDir = resolve(demoDist, 'assets-vanilla')
  mkdirSync(assetsVanillaDir, { recursive: true })
  for (const entry of readdirSync(vanillaDir)) {
    if (entry === 'index.html') continue
    cpSync(resolve(vanillaDir, entry), resolve(assetsVanillaDir, entry), { recursive: true })
  }
  console.log('[copyKinetikDist] vanilla.html → demo/dist/vanilla.html (with assets-vanilla/)')
}
console.log('[copyKinetikDist] done')
