#!/usr/bin/env node
/**
 * Crops the raw staged brand assets (resources/branding-v2/*.png, full 1536x1024
 * canvases with mostly-transparent padding) down to their real content bounding
 * box, with a small breathing-room margin, and writes the cropped versions used
 * throughout the app. Run once per Phase 39; re-run if the source assets change.
 *
 * Bounding boxes below were measured by direct pixel inspection (see
 * PHASE_39_TECHNICAL_SPEC.md Section 1) — not guessed from canvas size.
 */
const sharp = require('sharp')
const { join } = require('path')
const { mkdirSync, statSync, writeFileSync, readFileSync, copyFileSync } = require('fs')

const DIR = join(__dirname, '..', 'resources', 'branding-v2')
const RENDERER_ASSETS_DIR = join(__dirname, '..', 'src', 'renderer', 'src', 'assets', 'branding')
const RESOURCES_DIR = join(__dirname, '..', 'resources')

const MARGIN = 24 // px of transparent padding kept around the tight content box

const ASSETS = [
  {
    src: 'sarang-wordmark-lockup.png',
    out: 'sarang-wordmark-lockup-cropped.png',
    box: { left: 322, top: 342, width: 1232 - 322 + 1, height: 621 - 342 + 1 }
  },
  {
    src: 'sarang-icon-mark.png',
    out: 'sarang-icon-mark-cropped.png',
    box: { left: 421, top: 215, width: 1116 - 421 + 1, height: 794 - 215 + 1 }
  },
  {
    src: 'aszurex-partnership-mark.png',
    out: 'aszurex-partnership-mark-cropped.png',
    box: { left: 415, top: 339, width: 1126 - 415 + 1, height: 653 - 339 + 1 }
  }
]

async function run() {
  for (const asset of ASSETS) {
    const srcPath = join(DIR, asset.src)
    const outPath = join(DIR, asset.out)
    const srcMeta = await sharp(srcPath).metadata()
    const left = Math.max(0, asset.box.left - MARGIN)
    const top = Math.max(0, asset.box.top - MARGIN)
    const right = Math.min(srcMeta.width, asset.box.left + asset.box.width + MARGIN)
    const bottom = Math.min(srcMeta.height, asset.box.top + asset.box.height + MARGIN)
    const width = right - left
    const height = bottom - top

    // No .trim() here — sharp's trim-after-extract has a known "bad extract
    // area" interaction; the bounding boxes above were already measured by
    // direct pixel inspection (Section 1 of the spec), so the margin-padded
    // extract is already accurate without needing an auto-trim pass.
    await sharp(srcPath)
      .extract({ left, top, width, height })
      .toFile(outPath)

    const meta = await sharp(outPath).metadata()
    console.log(`${asset.out}: ${meta.width}x${meta.height}`)
  }

  // Square, padded version of the icon mark for icon.ico/icon.png generation —
  // icons need a square canvas; pad with transparency (not a solid box) so it
  // still composites cleanly wherever the OS places it.
  const iconCropped = join(DIR, 'sarang-icon-mark-cropped.png')
  const meta = await sharp(iconCropped).metadata()
  const side = Math.max(meta.width, meta.height)
  const padded = join(DIR, 'sarang-icon-mark-square.png')
  await sharp(iconCropped)
    .resize(side, side, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toFile(padded)
  console.log(`sarang-icon-mark-square.png: ${side}x${side}`)

  // Right-sized, compressed variants for actual UI embedding — the cropped
  // sources above are still full AI-generation resolution (600KB-1.2MB each),
  // fine for a one-time icon build but far too heavy to embed repeatedly
  // across the app (sidebar, login, about, disclaimer, print footers).
  //
  // Written DIRECTLY to the real consumption locations (src/renderer's asset
  // folder, imported by Brand.tsx; resources/aszurex-mark.png, read by
  // src/main/utils/branding.ts) — not just resources/branding-v2/ staging —
  // so this script is the single source of truth end to end. A prior version
  // of this pipeline wrote only to branding-v2/ and those files were then
  // copied by hand into place, which meant re-running this script after a
  // future logo update would silently leave the app's actual assets stale.
  mkdirSync(RENDERER_ASSETS_DIR, { recursive: true })
  const UI_VARIANTS = [
    { src: 'sarang-icon-mark-square.png', out: 'icon-mark-256.png', width: 256, rendererName: 'icon-mark.png' },
    { src: 'sarang-wordmark-lockup-cropped.png', out: 'wordmark-lockup-640.png', width: 640, rendererName: 'wordmark-lockup.png' },
    { src: 'aszurex-partnership-mark-cropped.png', out: 'partnership-mark-240.png', width: 240, rendererName: 'partnership-mark.png' }
  ]
  for (const v of UI_VARIANTS) {
    const outPath = join(DIR, v.out)
    await sharp(join(DIR, v.src))
      .resize(v.width, null, { fit: 'inside' })
      .png({ compressionLevel: 9, palette: true })
      .toFile(outPath)
    const stat = statSync(outPath)
    console.log(`${v.out}: ${Math.round(stat.size / 1024)}KB`)

    const rendererPath = join(RENDERER_ASSETS_DIR, v.rendererName)
    copyFileSync(outPath, rendererPath)
    console.log(`  -> copied to src/renderer/src/assets/branding/${v.rendererName}`)
  }

  // The Aszurex mark, at print-footer size, written directly to resources/
  // (read by src/main/utils/branding.ts at runtime via process.resourcesPath).
  const aszurexMarkOut = join(RESOURCES_DIR, 'aszurex-mark.png')
  copyFileSync(join(DIR, 'partnership-mark-240.png'), aszurexMarkOut)
  console.log(`  -> copied to resources/aszurex-mark.png`)

  // Small, explicit base64 constant for the ~12 renderer screens that build
  // print HTML as a raw string for window.open('', '_blank') — those popup
  // documents have no resolvable base URL for a relative asset path (unlike
  // normal in-app JSX, which can just import the PNG and use <AszurexMark>),
  // so they need a genuinely self-contained data URI. Generated explicitly
  // here rather than relying on Vite's size-based auto-inlining threshold,
  // which is undocumented-enough behavior not to depend on silently.
  const tinyMarkPath = join(DIR, 'partnership-mark-tiny.png')
  await sharp(join(DIR, 'aszurex-partnership-mark-cropped.png'))
    .resize(80, null, { fit: 'inside' })
    .png({ compressionLevel: 9, palette: true })
    .toFile(tinyMarkPath)
  const tinyMarkB64 = readFileSync(tinyMarkPath).toString('base64')
  const tsOut = join(RENDERER_ASSETS_DIR, 'partnership-mark-base64.ts')
  writeFileSync(
    tsOut,
    `// Generated by scripts/prepare-brand-assets.js — do not edit by hand.\n` +
    `// Self-contained base64 form of the Aszurex partnership mark, for the renderer\n` +
    `// screens that build print HTML as a raw string (window.open popups have no\n` +
    `// resolvable base URL for a relative asset path).\n` +
    `export const partnershipMarkBase64DataUri = 'data:image/png;base64,${tinyMarkB64}'\n`
  )
  console.log(`partnership-mark-base64.ts: ${Math.round(tinyMarkB64.length / 1024)}KB (base64), written to ${tsOut}`)
}

run().catch((e) => { console.error(e); process.exit(1) })
