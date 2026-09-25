import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from 'fs'
import { join, relative, resolve } from 'path'

// Ratchet: existing violations are recorded in docs/standards-baseline.json and may only shrink.
// New code (new files, or growth in an existing file) must not add violations.
// After fixing violations, refresh with: SARANG_UPDATE_BASELINE=1 npx vitest run src/shared/__tests__/code-standards.test.ts

const ROOT = resolve(__dirname, '../../..')
const BASELINE_PATH = join(ROOT, 'docs', 'standards-baseline.json')
const MAX_LINES = 600
const MONEY_ALLOWED = ['src/shared/utils/money.ts', 'src/shared/utils/gst-presentation.ts', 'src/shared/data/tax-presets.ts']

type Counts = Record<string, number>
interface Baseline { oversized: Counts; rawMoneyMath: Counts }

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'locales' || name === '__tests__') continue
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.(ts|tsx)$/.test(name) && !/\.(test|spec|d)\.ts$/.test(name)) out.push(full)
  }
  return out
}

const RAW_MONEY = /\b(amount|total|subtotal|price|tax|gst|discount|balance)\w*\s*[*/]\s*\(?\s*\w*(rate|percent|pct)\w*/gi

function scan(): Baseline {
  const result: Baseline = { oversized: {}, rawMoneyMath: {} }
  for (const file of walk(join(ROOT, 'src'))) {
    const rel = relative(ROOT, file).split('\\').join('/')
    const text = readFileSync(file, 'utf8')
    const lines = text.split('\n').length
    if (lines > MAX_LINES) result.oversized[rel] = lines
    if (!MONEY_ALLOWED.includes(rel)) {
      const n = (text.match(RAW_MONEY) ?? []).length
      if (n > 0) result.rawMoneyMath[rel] = n
    }
  }
  return result
}

const current = scan()

if (process.env.SARANG_UPDATE_BASELINE === '1') {
  writeFileSync(BASELINE_PATH, JSON.stringify(current, null, 2) + '\n')
}

const baseline: Baseline = existsSync(BASELINE_PATH)
  ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
  : { oversized: {}, rawMoneyMath: {} }

function grown(now: Counts, base: Counts): string[] {
  return Object.entries(now)
    .filter(([file, n]) => n > (base[file] ?? 0))
    .map(([file, n]) => `${file}: ${n} (allowed ${base[file] ?? 0})`)
}

describe('code standards ratchet', () => {
  it('no source file grows past 600 lines, and already-oversized files do not grow', () => {
    expect(grown(current.oversized, baseline.oversized)).toEqual([])
  })

  it('no new raw money arithmetic (amount * rate) outside @money / @gst / @taxpresets', () => {
    expect(grown(current.rawMoneyMath, baseline.rawMoneyMath)).toEqual([])
  })

})
