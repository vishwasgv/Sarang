import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const localesDir = join(__dirname, 'src', 'renderer', 'src', 'i18n', 'locales')

const TARGET_LOCALES = ['hi', 'mr', 'gu', 'kn', 'ta', 'te', 'ml', 'es', 'fr', 'ar', 'pt', 'id']

function mergeKeys(source, target) {
  const result = { ...target }
  for (const key of Object.keys(source)) {
    if (!(key in result)) {
      result[key] = source[key]
    } else if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
      result[key] = mergeKeys(source[key], result[key] ?? {})
    }
  }
  return result
}

const enRaw = readFileSync(join(localesDir, 'en.json'), 'utf8')
const enData = JSON.parse(enRaw)

let added = 0

for (const locale of TARGET_LOCALES) {
  const filePath = join(localesDir, `${locale}.json`)
  const raw = readFileSync(filePath, 'utf8')
  const hasBom = raw.charCodeAt(0) === 0xFEFF
  const clean = hasBom ? raw.slice(1) : raw
  const existing = JSON.parse(clean)

  function countKeys(obj) {
    let n = 0
    for (const v of Object.values(obj)) {
      if (typeof v === 'object' && v !== null) n += countKeys(v)
      else n++
    }
    return n
  }

  const beforeCount = countKeys(existing)
  const merged = mergeKeys(enData, existing)
  const afterCount = countKeys(merged)
  const delta = afterCount - beforeCount
  added += delta

  const output = JSON.stringify(merged, null, 2)
  const final = hasBom ? '﻿' + output : output
  writeFileSync(filePath, final, 'utf8')
  console.log(`${locale}: +${delta} keys (${beforeCount} → ${afterCount})`)
}

console.log(`\nDone. Total new keys added across all locales: ${added}`)
