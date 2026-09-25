import { describe, it, expect, vi } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))

import { getPrisma } from '../../database/db'
import { backfillLineTaxCategories } from '../tax-category-backfill.service'

type Row = Record<string, any>

function match(row: Row, where: Row): boolean {
  return Object.entries(where).every(([k, v]) => {
    if (v && typeof v === 'object') {
      if ('lte' in v) return row[k] <= v.lte
      if ('in' in v) return v.in.includes(row[k])
      if ('not' in v) return row[k] !== v.not
    }
    return row[k] === v
  })
}

function table(rows: Row[]) {
  return {
    rows,
    findMany: vi.fn(async ({ where }: any = {}) => rows.filter(r => match(r, where ?? {}))),
    updateMany: vi.fn(async ({ where, data }: any) => { const hit = rows.filter(r => match(r, where)); hit.forEach(r => Object.assign(r, data)); return { count: hit.length } })
  }
}

function makeDb() {
  const settings: Row[] = []
  const product = table([
    { id: 'exempt', taxCategory: 'EXEMPT' }, { id: 'nil', taxCategory: 'NIL_RATED' }, { id: 'zero', taxCategory: 'ZERO_RATED' },
    { id: 'std', taxCategory: 'STANDARD' }, { id: 'red', taxCategory: 'REDUCED' }
  ])
  const line = (id: string, productId: string | null, taxRate: number, extra: Row = {}) => ({ id, productId, taxRate, taxCategory: 'STANDARD', taxAmount: taxRate * 2, lineTotal: 100 + taxRate * 2, unitPrice: 100, ...extra })
  const invoiceItem = table([
    line('i1', 'exempt', 0), line('i2', 'nil', 0), line('i3', 'zero', 0), line('i4', 'std', 0), line('i5', 'red', 0), line('i6', 'exempt', 5),
    line('i7', 'std', 18), line('i8', 'red', 5, { taxCategory: 'REDUCED' }), line('i9', 'exempt', 0, { taxCategory: 'EXEMPT' })
  ])
  const billItem = table([line('b1', 'exempt', 0), line('b2', null, 0), line('b3', 'std', 18)])
  const db = {
    setting: {
      findUnique: vi.fn(async ({ where }: any) => settings.find(s => s.settingKey === where.settingKey) ?? null),
      upsert: vi.fn(async ({ where, create, update }: any) => { const s = settings.find(x => x.settingKey === where.settingKey); if (s) Object.assign(s, update); else settings.push({ ...create }); })
    },
    product, invoiceItem, billItem
  }
  return { db, invoiceItem, billItem, settings }
}

describe('one-time tax category backfill for old lines (row 3.24)', () => {
  it('sets the category from the rate and the product, never touches an amount, and taxed lines stay as they were', async () => {
    const { db, invoiceItem, billItem } = makeDb()
    const amountsBefore = JSON.stringify(invoiceItem.rows.map(r => [r.taxRate, r.taxAmount, r.lineTotal, r.unitPrice]).concat(billItem.rows.map(r => [r.taxRate, r.taxAmount, r.lineTotal, r.unitPrice])))
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await backfillLineTaxCategories()
    const cat = (id: string) => invoiceItem.rows.find(r => r.id === id)!.taxCategory
    expect(cat('i1')).toBe('EXEMPT')
    expect(cat('i2')).toBe('NIL_RATED')
    expect(cat('i3')).toBe('ZERO_RATED')
    expect(cat('i4')).toBe('NIL_RATED')
    expect(cat('i5')).toBe('NIL_RATED')
    expect(cat('i6')).toBe('STANDARD') // taxed: untouched
    expect(cat('i7')).toBe('STANDARD')
    expect(cat('i8')).toBe('REDUCED')
    expect(cat('i9')).toBe('EXEMPT')
    expect(billItem.rows.map(r => r.taxCategory)).toEqual(['EXEMPT', 'NIL_RATED', 'STANDARD'])
    expect(res).toEqual({ invoiceLines: 5, billLines: 2 })
    const amountsAfter = JSON.stringify(invoiceItem.rows.map(r => [r.taxRate, r.taxAmount, r.lineTotal, r.unitPrice]).concat(billItem.rows.map(r => [r.taxRate, r.taxAmount, r.lineTotal, r.unitPrice])))
    expect(amountsAfter).toBe(amountsBefore)
  })

  it('is idempotent: a second run changes nothing and runs no update', async () => {
    const { db, invoiceItem, billItem } = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    await backfillLineTaxCategories()
    const snapshot = JSON.stringify([invoiceItem.rows, billItem.rows])
    invoiceItem.updateMany.mockClear()
    const again = await backfillLineTaxCategories()
    expect(again).toEqual({ invoiceLines: 0, billLines: 0 })
    expect(invoiceItem.updateMany).not.toHaveBeenCalled()
    expect(JSON.stringify([invoiceItem.rows, billItem.rows])).toBe(snapshot)
  })

  it('a re-run without the marker (for example after a failed first attempt) is still a no-op on finished rows', async () => {
    const { db, invoiceItem, settings } = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    await backfillLineTaxCategories()
    const snapshot = JSON.stringify(invoiceItem.rows)
    settings.length = 0
    const again = await backfillLineTaxCategories()
    expect(again).toEqual({ invoiceLines: 0, billLines: 0 })
    expect(JSON.stringify(invoiceItem.rows)).toBe(snapshot)
  })
})
