// Country tax presets: rates are loaded only for the business's own country, idempotently, and never change
// or remove an existing row. A non-India country never gets an India row.
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))
vi.mock('../auth.service', () => ({ getCurrentSession: vi.fn().mockReturnValue({ userId: 'u1' }) }))

import { getPrisma } from '../../database/db'
import { getTaxPresetStatus, loadTaxPresetForBusiness, addMissingPresetRates } from '../tax-preset.service'
import { INDIA_GST_SLABS, INDIA_GST_SPLIT_CONFIGS } from '../india-gst-slabs.service'
import { TAX_PRESETS } from '../../../shared/data/tax-presets'

interface Row { id: string; taxName: string; taxType: string; rate: number; country: string | null; isDefault: boolean; isActive: boolean; isLegacy: boolean }

function matches(row: Row, where: Record<string, any>): boolean {
  return Object.entries(where).every(([k, v]) => (row as any)[k] === v)
}

function makeDb(rows: Row[], country: string | null) {
  let seq = 1
  const db: Record<string, any> = {
    rows,
    businessProfile: { findFirst: vi.fn().mockResolvedValue(country === null ? null : { country }) },
    taxConfiguration: {
      findFirst: vi.fn(async ({ where }: { where: Record<string, any> }) => rows.find((r) => matches(r, where)) ?? null),
      create: vi.fn(async ({ data }: { data: Partial<Row> }) => {
        if (rows.some((r) => r.taxName === data.taxName && r.taxType === data.taxType)) throw new Error('unique violation')
        const r = { id: `n${seq++}`, country: null, isDefault: false, isActive: true, isLegacy: false, ...data } as Row
        rows.push(r)
        return r
      })
    }
  }
  db.$transaction = vi.fn(async (cb: (tx: unknown) => unknown) => cb(db))
  return db
}

const row = (taxName: string, taxType: string, rate: number, extra: Partial<Row> = {}): Row =>
  ({ id: taxName, taxName, taxType, rate, country: null, isDefault: false, isActive: true, isLegacy: false, ...extra })

beforeEach(() => vi.clearAllMocks())

describe('getTaxPresetStatus: only the business country', () => {
  it('reports the preset of the business country and nothing about any other country', async () => {
    const db = makeDb([], 'Australia')
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await getTaxPresetStatus()
    expect(res.success).toBe(true)
    const d = (res as { data: any }).data
    expect(d.hasPreset).toBe(true)
    expect(d.code).toBe('AU')
    expect(d.name).toBe('Australia')
    expect(d.taxLabel).toBe('GST')
    expect(d.totalRates).toBe(TAX_PRESETS['AU'].rates.length)
    expect(d.missingRates).toBe(TAX_PRESETS['AU'].rates.length)
    expect(d.asOf).toBe('2026-09-25')
    expect(JSON.stringify(d)).not.toContain('United Kingdom')
  })

  it('has no preset for a country without one, so no button and no rates are offered', async () => {
    const db = makeDb([], 'Brazil')
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const d = ((await getTaxPresetStatus()) as { data: any }).data
    expect(d.hasPreset).toBe(false)
    expect(d.code).toBeNull()
    expect(d.missingRates).toBe(0)
  })

  it('has no preset before a business exists', async () => {
    const db = makeDb([], null)
    vi.mocked(getPrisma).mockReturnValue(db as never)
    expect(((await getTaxPresetStatus()) as { data: any }).data.hasPreset).toBe(false)
  })

  it('counts only the rates still missing', async () => {
    const db = makeDb([row('VAT 20%', 'VAT', 20, { isDefault: true })], 'UK')
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const d = ((await getTaxPresetStatus()) as { data: any }).data
    expect(d.code).toBe('GB')
    expect(d.missingRates).toBe(2)
  })
})

describe('loadTaxPresetForBusiness', () => {
  it('adds the business country rates with the country code, the model as type and exactly one default', async () => {
    const db = makeDb([], 'Germany')
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await loadTaxPresetForBusiness()
    expect(res.success).toBe(true)
    expect((res as { data: { added: number } }).data.added).toBe(2)
    expect(db.rows.map((r: Row) => [r.taxName, r.rate, r.taxType, r.country, r.isDefault])).toEqual([
      ['VAT 19%', 19, 'VAT', 'DE', true],
      ['VAT 7%', 7, 'VAT', 'DE', false]
    ])
  })

  it('is idempotent: a second load adds nothing and changes nothing', async () => {
    const db = makeDb([], 'France')
    vi.mocked(getPrisma).mockReturnValue(db as never)
    await loadTaxPresetForBusiness()
    const snapshot = JSON.stringify(db.rows)
    const again = await loadTaxPresetForBusiness()
    expect((again as { data: { added: number } }).data.added).toBe(0)
    expect(JSON.stringify(db.rows)).toBe(snapshot)
    expect(db.rows).toHaveLength(4)
  })

  it('never rewrites, renames or re-activates an existing row, and keeps the existing default', async () => {
    const existing = [
      row('Standard rate', 'VAT', 20, { isDefault: true, country: 'GB' }),
      row('Old five', 'VAT', 5, { isActive: false })
    ]
    const before = JSON.stringify(existing)
    const db = makeDb(existing, 'United Kingdom')
    vi.mocked(getPrisma).mockReturnValue(db as never)
    await loadTaxPresetForBusiness()
    expect(JSON.stringify(db.rows.slice(0, 2))).toBe(before)
    expect(db.rows).toHaveLength(3)
    expect(db.rows[2]).toMatchObject({ taxName: 'VAT 0%', rate: 0, isDefault: false })
    expect(db.rows.filter((r: Row) => r.isDefault)).toHaveLength(1)
  })

  it('keeps zero-rated rows apart from other zero rows by name', async () => {
    const db = makeDb([row('No Tax', 'NONE', 0, { isDefault: true })], 'Australia')
    vi.mocked(getPrisma).mockReturnValue(db as never)
    await loadTaxPresetForBusiness()
    expect(db.rows.map((r: Row) => r.taxName).sort()).toEqual(['GST 10%', 'GST-free 0%', 'No Tax'])
  })

  it.each([['Australia', 'AU'], ['New Zealand', 'NZ'], ['Singapore', 'SG'], ['Canada', 'CA']])('%s never gets an India row', async (country, code) => {
    const db = makeDb([], country)
    vi.mocked(getPrisma).mockReturnValue(db as never)
    await loadTaxPresetForBusiness()
    expect(db.rows.length).toBeGreaterThan(0)
    for (const r of db.rows as Row[]) {
      expect(r.country).toBe(code)
      expect(r.taxType).not.toBe('GST')
      expect(['CGST', 'SGST']).not.toContain(r.taxType)
    }
  })

  it('loads nothing for a country without a preset and says how to add rates', async () => {
    const db = makeDb([], 'Brazil')
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await loadTaxPresetForBusiness()
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('TAX-010')
    expect(db.rows).toHaveLength(0)
    expect(db.taxConfiguration.create).not.toHaveBeenCalled()
  })

  it('adds no row for a country with no tax at all (Qatar, Kuwait, Hong Kong)', async () => {
    for (const country of ['Qatar', 'Kuwait', 'Hong Kong']) {
      const db = makeDb([], country)
      vi.mocked(getPrisma).mockReturnValue(db as never)
      const res = await loadTaxPresetForBusiness()
      expect(res.success).toBe(true)
      expect((res as { data: { added: number } }).data.added).toBe(0)
      expect(db.rows).toHaveLength(0)
    }
  })

  it('India: the current GST slabs and split rows, exactly, idempotently', async () => {
    const db = makeDb([], 'India')
    vi.mocked(getPrisma).mockReturnValue(db as never)
    await loadTaxPresetForBusiness()
    const gst = db.rows.filter((r: Row) => r.taxType === 'GST' && r.taxName !== 'GST Exempt')
    expect(gst.map((r: Row) => r.rate).sort((a: number, b: number) => a - b)).toEqual([0, 0.25, 3, 5, 18, 40])
    expect(gst.filter((r: Row) => r.isDefault).map((r: Row) => r.rate)).toEqual([18])
    expect(db.rows).toHaveLength(INDIA_GST_SLABS.length + INDIA_GST_SPLIT_CONFIGS.length)
    const snapshot = JSON.stringify(db.rows)
    await loadTaxPresetForBusiness()
    expect(JSON.stringify(db.rows)).toBe(snapshot)
  })

  it('a preset for another country is never used just because the caller asked for it', async () => {
    const db = makeDb([], 'Germany')
    vi.mocked(getPrisma).mockReturnValue(db as never)
    await (loadTaxPresetForBusiness as unknown as (x: string) => Promise<unknown>)('GB')
    expect(db.rows.every((r: Row) => r.country === 'DE')).toBe(true)
  })
})

describe('addMissingPresetRates', () => {
  it('flags the default only when the type has no active default yet', async () => {
    const withDefault = makeDb([row('Sales Tax 8%', 'SALES_TAX', 8, { isDefault: true })], 'US')
    await addMissingPresetRates(withDefault as never, TAX_PRESETS['US'])
    expect(withDefault.rows.filter((r: Row) => r.isDefault)).toHaveLength(1)
    const without = makeDb([], 'US')
    await addMissingPresetRates(without as never, TAX_PRESETS['US'])
    expect(without.rows).toHaveLength(1)
    expect(without.rows[0]).toMatchObject({ taxType: 'SALES_TAX', rate: 0, isDefault: true })
  })

  it('uses the preset model as the tax type for every country', async () => {
    for (const p of Object.values(TAX_PRESETS)) {
      if (p.taxModel === 'NONE' || p.code === 'IN') continue
      const db = makeDb([], p.name)
      await addMissingPresetRates(db as never, p)
      expect(db.rows.length, p.code).toBe(p.rates.length)
      for (const r of db.rows as Row[]) expect(r.taxType, p.code).toBe(p.taxModel)
      expect(db.rows.filter((r: Row) => r.isDefault), p.code).toHaveLength(1)
    }
  })
})
