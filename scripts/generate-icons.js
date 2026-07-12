#!/usr/bin/env node
/**
 * Generates brand icons for Sarang Business OS Lite from the real logo asset
 * (Phase 39 — replaces the earlier procedural gradient+"S"-glyph placeholder
 * that generate-icons.js drew by hand; see git history / PHASE_39_TECHNICAL_SPEC.md
 * for that version's reasoning, it explicitly called itself an interim asset).
 *
 * Source: resources/branding-v2/sarang-icon-mark-square.png (square, transparent
 * background, produced by scripts/prepare-brand-assets.js from the founder-supplied
 * logo). Resized via sharp to every size Windows actually needs, then packed into
 * a proper multi-size ICO (16/32/48/64/128/256px, Vista+ PNG-in-ICO format).
 *
 * Output:
 *   resources/icon.png  — 256x256 PNG (BrowserWindow icon + extraResource)
 *   resources/icon.ico  — multi-size ICO (NSIS installer icon)
 */
const sharp = require('sharp')
const { writeFileSync, existsSync, mkdirSync } = require('fs')
const { join } = require('path')

const RESOURCES_DIR = join(__dirname, '..', 'resources')
const SOURCE = join(RESOURCES_DIR, 'branding-v2', 'sarang-icon-mark-square.png')
const ICO_SIZES = [16, 32, 48, 64, 128, 256]

// ── Pack multiple PNGs into a proper multi-size ICO (Vista+ PNG-in-ICO format) ──
function createMultiSizeICO(sizedPngs) {
  const count = sizedPngs.length
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(count, 4)

  const entries = []
  const dataBufs = []
  let offset = 6 + count * 16
  for (const { size, png } of sizedPngs) {
    const entry = Buffer.alloc(16)
    entry[0] = size >= 256 ? 0 : size // 0 means 256 per ICO spec
    entry[1] = size >= 256 ? 0 : size
    entry[2] = 0; entry[3] = 0 // no palette
    entry.writeUInt16LE(1, 4); entry.writeUInt16LE(32, 6) // planes, 32bpp
    entry.writeUInt32LE(png.length, 8)
    entry.writeUInt32LE(offset, 12)
    entries.push(entry)
    dataBufs.push(png)
    offset += png.length
  }

  return Buffer.concat([header, ...entries, ...dataBufs])
}

async function run() {
  if (!existsSync(SOURCE)) {
    console.error(`Source asset not found: ${SOURCE}`)
    console.error('Run "node scripts/prepare-brand-assets.js" first.')
    process.exit(1)
  }
  if (!existsSync(RESOURCES_DIR)) mkdirSync(RESOURCES_DIR, { recursive: true })

  const sizedPngs = []
  for (const size of ICO_SIZES) {
    const png = await sharp(SOURCE)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer()
    sizedPngs.push({ size, png })
  }

  writeFileSync(join(RESOURCES_DIR, 'icon.png'), sizedPngs.find((s) => s.size === 256).png)
  writeFileSync(join(RESOURCES_DIR, 'icon.ico'), createMultiSizeICO(sizedPngs))

  console.log('✓ resources/icon.png  (256×256, from real logo asset)')
  console.log(`✓ resources/icon.ico  (multi-size: ${ICO_SIZES.join(', ')}px, from real logo asset)`)
}

run().catch((e) => { console.error(e); process.exit(1) })
