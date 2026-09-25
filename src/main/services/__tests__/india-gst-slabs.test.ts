// India GST slabs (structure in force from 22 September 2025): the startup routine adds the current
// slabs to an existing install, marks the withdrawn 12 and 28 percent rows as older rates, and is
// idempotent. It never deletes, renames or re-activates a row.
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))

import { getPrisma } from '../../database/db'
import { INDIA_GST_SLABS, refreshIndiaGstSlabs } from '../india-gst-slabs.service'

interface Row { id: string; taxName: string; taxType: string; rate: number; country: string | null; isDefault: boolean; isActive: boolean; isLegacy: boolean }

function matches(row: Row, where: Record<string, any>): boolean {
  return Object.entries(where).every(([k, v]) => {
    if (k === 'OR') return (v as Array<Record<string, any>>).some(w => matches(row, w))
    const val = (row as any)[k]
    if (v && typeof v === 'object' && 'in' in v) return (v.in as unknown[]).includes(val)
    return val === v
  })
}

function makeDb(rows: Row[], profile: { country: string; taxModel: string } | null = { country: 'IN', taxModel: 'GST' }) {
  let seq = 100
  return {
    rows,
    businessProfile: { findFirst: vi.fn().mockResolvedValue(profile) },
    taxConfiguration: {
      findFirst: vi.fn(async ({ where }: { where: Record<string, any> }) => rows.find(r => matches(r, where)) ?? null),
      create: vi.fn(async ({ data }: { data: Partial<Row> }) => { const r = { id: `n${seq++}`, country: null, isDefault: false, isActive: true, isLegacy: false, ...data } as Row; rows.push(r); return r }),
      updateMany: vi.fn(async ({ where, data }: { where: Record<string, any>; data: Partial<Row> }) => { const hit = rows.filter(r => matches(r, where)); hit.forEach(r => Object.assign(r, data)); return { count: hit.length } })
    }
  }
}

// What an install made before 22 September 2025 holds: the wizard rows plus the startup seed rows.
function oldInstall(): Row[] {
  const mk = (taxName: string, taxType: string, rate: number, isDefault = false): Row => ({ id: taxName, taxName, taxType, rate, country: 'IN', isDefault, isActive: true, isLegacy: false })
  return [
    mk('GST 0%', 'GST', 0), mk('GST 5%', 'GST', 5), mk('GST 12%', 'GST', 12), mk('GST 18%', 'GST', 18, true), mk('GST 28%', 'GST', 28),
    mk('GST Exempt', 'GST', 0),
    mk('CGST @ 2.5%', 'CGST', 2.5), mk('SGST @ 2.5%', 'SGST', 2.5), mk('CGST @ 6%', 'CGST', 6), mk('SGST @ 6%', 'SGST', 6),
    mk('CGST @ 9%', 'CGST', 9), mk('SGST @ 9%', 'SGST', 9), mk('CGST @ 14%', 'CGST', 14), mk('SGST @ 14%', 'SGST', 14)
  ]
}

beforeEach(() => vi.clearAllMocks())

describe('refreshIndiaGstSlabs', () => {
  it('defines the current schedule: 0, 5, 18 (default), 40, 3 and 0.25 percent', () => {
    expect(INDIA_GST_SLABS.map(s => s.rate)).toEqual([0, 5, 18, 40, 3, 0.25])
    expect(INDIA_GST_SLABS.filter(s => s.isDefault).map(s => s.rate)).toEqual([18])
    expect(INDIA_GST_SLABS.map(s => s.rate)).not.toContain(12)
    expect(INDIA_GST_SLABS.map(s => s.rate)).not.toContain(28)
  })

  it('adds 40, 3 and 0.25 percent to an old install and marks 12 and 28 percent (and their CGST/SGST halves) as older rates', async () => {
    const db = makeDb(oldInstall())
    vi.mocked(getPrisma).mockReturnValue(db as never)
    await refreshIndiaGstSlabs()
    const gst = (r: number) => db.rows.find(x => x.taxType === 'GST' && x.rate === r && x.taxName !== 'GST Exempt')
    expect(gst(40)).toBeDefined()
    expect(gst(3)).toBeDefined()
    expect(gst(0.25)).toBeDefined()
    expect(gst(40)!.isLegacy).toBe(false)
    expect(gst(12)!.isLegacy).toBe(true)
    expect(gst(28)!.isLegacy).toBe(true)
    for (const name of ['CGST @ 6%', 'SGST @ 6%', 'CGST @ 14%', 'SGST @ 14%']) expect(db.rows.find(r => r.taxName === name)!.isLegacy).toBe(true)
    // current rows are untouched
    for (const name of ['GST 0%', 'GST 5%', 'GST 18%', 'CGST @ 2.5%', 'SGST @ 9%']) expect(db.rows.find(r => r.taxName === name)!.isLegacy).toBe(false)
    // 18 percent stays the only default
    expect(db.rows.filter(r => r.isDefault).map(r => r.taxName)).toEqual(['GST 18%'])
  })

  it('never deletes, renames or re-activates an existing row', async () => {
    const rows = oldInstall()
    rows.find(r => r.taxName === 'GST 5%')!.isActive = false
    rows.find(r => r.taxName === 'GST 12%')!.taxName = 'My old twelve'
    const before = JSON.parse(JSON.stringify(rows)) as Row[]
    const db = makeDb(rows)
    vi.mocked(getPrisma).mockReturnValue(db as never)
    await refreshIndiaGstSlabs()
    for (const b of before) {
      const now = db.rows.find(r => r.id === b.id)!
      expect(now.taxName).toBe(b.taxName)
      expect(now.isActive).toBe(b.isActive)
      expect(now.rate).toBe(b.rate)
    }
    expect(db.rows.length).toBeGreaterThanOrEqual(before.length)
    // the deactivated 5 percent row is not replaced by a new one
    expect(db.rows.filter(r => r.taxType === 'GST' && r.rate === 5)).toHaveLength(1)
    // a renamed 12 percent row is still recognised by its rate
    expect(db.rows.find(r => r.taxName === 'My old twelve')!.isLegacy).toBe(true)
  })

  it('is idempotent: a second run changes nothing', async () => {
    const db = makeDb(oldInstall())
    vi.mocked(getPrisma).mockReturnValue(db as never)
    await refreshIndiaGstSlabs()
    const after1 = JSON.stringify(db.rows)
    db.taxConfiguration.create.mockClear()
    await refreshIndiaGstSlabs()
    expect(JSON.stringify(db.rows)).toBe(after1)
    expect(db.taxConfiguration.create).not.toHaveBeenCalled()
  })

  it('does nothing for a business outside India or one that does not use GST', async () => {
    for (const profile of [{ country: 'GB', taxModel: 'VAT' }, { country: 'AU', taxModel: 'GST' }, { country: 'IN', taxModel: 'NONE' }, null]) {
      const rows = oldInstall()
      const db = makeDb(rows, profile)
      vi.mocked(getPrisma).mockReturnValue(db as never)
      await refreshIndiaGstSlabs()
      expect(db.rows).toHaveLength(14)
      expect(db.rows.some(r => r.isLegacy)).toBe(false)
    }
  })

  it('a fresh install already holds the current slabs and gets no older-rate rows', async () => {
    const db = makeDb(INDIA_GST_SLABS.map((s, i) => ({ id: `g${i}`, taxName: s.taxName, taxType: 'GST', rate: s.rate, country: 'IN', isDefault: s.isDefault === true, isActive: true, isLegacy: false })))
    vi.mocked(getPrisma).mockReturnValue(db as never)
    await refreshIndiaGstSlabs()
    expect(db.rows).toHaveLength(6)
    expect(db.rows.some(r => r.isLegacy)).toBe(false)
  })
})

import { isOffSlabRate, type ConfiguredTaxRate } from '../../../renderer/src/shared/utils/off-slab-rate.util'

describe('soft warning for a rate that is not a saved slab (gap 3.5)', () => {
  const cfg = (rate: number, taxType = 'GST', isLegacy = false): ConfiguredTaxRate => ({ id: `${taxType}${rate}`, taxName: `${taxType} ${rate}%`, taxType, rate, isDefault: false, isLegacy })
  const saved = [cfg(0), cfg(5), cfg(18), cfg(40), cfg(3), cfg(0.25)]

  it('accepts every configured rate, zero, and the CGST/SGST half of a GST rate', () => {
    for (const r of [0, 5, 18, 40, 3, 0.25, 2.5, 9, 20, 1.5, 0.125]) expect(isOffSlabRate(r, saved), String(r)).toBe(false)
  })
  it('flags a rate that is not configured', () => {
    for (const r of [12, 28, 7, 17.5, 4]) expect(isOffSlabRate(r, saved), String(r)).toBe(true)
  })
  it('a withdrawn rate the owner still has saved is not flagged', () => {
    expect(isOffSlabRate(12, [...saved, cfg(12, 'GST', true)])).toBe(false)
  })
  it('never warns when nothing is configured or the value is not a number', () => {
    expect(isOffSlabRate(12, [])).toBe(false)
    expect(isOffSlabRate(Number.NaN, saved)).toBe(false)
  })
  it('a VAT business is checked against its own saved rates only', () => {
    const vat = [cfg(20, 'VAT'), cfg(5, 'VAT'), cfg(0, 'VAT')]
    expect(isOffSlabRate(20, vat)).toBe(false)
    expect(isOffSlabRate(10, vat)).toBe(true)
    expect(isOffSlabRate(10, [cfg(10, 'VAT')])).toBe(false)
  })
})
